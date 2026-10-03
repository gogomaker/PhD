-- 2026-10-03 UT 3차
--  1. 두 기기에서 같은 날 시간표를 열어 두고 칠하면, 새로 읽지 않은 쪽이 다른 기기에서 칠한 것을 지웠다
--     → 저장할 때 "내가 알고 있던 서버 상태(p_base)"를 함께 보내고, 그 사이 바뀌었으면 거절(stale_day)
--  2. 하루 시작 시각을 늦추면(예: 새벽 5시 반에 5시 → 6시) 어제가 다시 '오늘'이 되어 지난 기록을 고칠 수 있었다 (R-D2)
--     → 오늘이 뒤로 가는 변경은 거절(day_start_back)
--  3. 하루 시작 시각을 바꾸면 지난 시간표가 1~2시간 밀려 보였다 (칸 번호가 하루 시작 기준이라)
--     → 기획 결정: 칠한 기록은 실제 시각 그대로. 칸 번호를 옮기고, 하루 경계를 넘는 부분은 앞날·다음 날로 옮긴다
--  4. 자정을 넘는 시간(예: 밤 11시 ~ 새벽 1시)을 예약할 수 없었다 — 하루 시작 시각 기준 순서로 본다 (R-D1)

-- ───────── 1. 시간표 저장: 그 사이 바뀌었으면 거절 ─────────
-- 한 층의 하루치 블록을 비교할 수 있는 한 줄로
create function public.day_layer_sig(p_date date, p_layer text) returns text
language sql stable set search_path = '' as $$
  select coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', start_slot, end_slot, task_id, daily_keyword_id, label, block_key), ',' order by start_slot), '')
  from public.time_blocks where user_id = auth.uid() and date = p_date and layer = p_layer;
$$;
revoke execute on function public.day_layer_sig(date, text) from public, anon;
grant execute on function public.day_layer_sig(date, text) to authenticated;

-- 저장할 때와 같은 방식으로 다듬어 같은 모양으로
create function public.blocks_sig(p_blocks jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', s, e, t, k, l, bk), ',' order by s), '')
  from (
    select (b ->> 'start')::smallint s, (b ->> 'end')::smallint e, nullif(b ->> 'task_id', '')::uuid t,
           nullif(b ->> 'keyword_id', '')::uuid k, nullif(btrim(b ->> 'label'), '') l, b ->> 'key' bk
    from jsonb_array_elements(p_blocks) b
  ) x;
$$;
revoke execute on function public.blocks_sig(jsonb) from public, anon;
grant execute on function public.blocks_sig(jsonb) to authenticated;

drop function public.save_day_blocks(date, text, jsonb);
-- p_base: 이 기기가 마지막으로 본 서버 상태. 없으면(예전 앱) 비교하지 않는다
create function public.save_day_blocks(p_date date, p_layer text, p_blocks jsonb, p_base jsonb default null) returns void
language plpgsql set search_path = '' as $$
declare
  off int := public.day_offset(p_date);
begin
  if off < 0 or off > 1 or (p_layer = 'actual' and off <> 0) then
    raise exception 'day_locked' using hint = '이 날은 시간표를 바꿀 수 없어요';
  end if;
  if p_layer = 'actual' and exists (
    select 1 from jsonb_array_elements(p_blocks) b where (b ->> 'end')::int > public.user_now_slot() + 1
  ) then
    raise exception 'future_time' using hint = '아직 오지 않은 시간은 칠할 수 없어요';
  end if;
  -- 같은 날을 두 기기에서 고칠 때 동시에 들어와도 차례로
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || p_date::text || p_layer));
  if p_base is not null and public.day_layer_sig(p_date, p_layer) <> public.blocks_sig(p_base) then
    raise exception 'stale_day' using hint = '다른 기기에서 이 날 시간표를 바꿨어요';
  end if;
  delete from public.time_blocks where user_id = auth.uid() and date = p_date and layer = p_layer;
  insert into public.time_blocks (date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key)
    select p_date, p_layer, (b ->> 'start')::smallint, (b ->> 'end')::smallint,
           nullif(b ->> 'task_id', '')::uuid, nullif(b ->> 'keyword_id', '')::uuid, nullif(btrim(b ->> 'label'), ''), b ->> 'key'
    from jsonb_array_elements(p_blocks) b;
end $$;
revoke execute on function public.save_day_blocks(date, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_day_blocks(date, text, jsonb, jsonb) to authenticated;

-- ───────── 2·3. 하루 시작 시각 바꾸기 ─────────
create function public.profiles_day_start_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- 오늘이 어제로 돌아가면 지난 날이 다시 열린다 (R-D2)
  if ((now() at time zone new.timezone) - make_interval(hours => new.day_start_hour))::date
     < ((now() at time zone old.timezone) - make_interval(hours => old.day_start_hour))::date then
    raise exception 'day_start_back' using hint = format('지금은 바꿀 수 없어요. %s시가 지나면 바꿀 수 있어요', new.day_start_hour);
  end if;
  return new;
end $$;
revoke execute on function public.profiles_day_start_guard() from public, anon, authenticated;
create trigger profiles_day_start_guard before update of day_start_hour on public.profiles
  for each row when (new.day_start_hour is distinct from old.day_start_hour) execute function public.profiles_day_start_guard();

-- 칠한 기록은 실제 시각 그대로: 칸 = (시각 - 하루 시작) / 10분 이므로 (옛 시작 - 새 시작) × 6칸 옮긴다.
-- 하루 밖으로 나간 부분은 앞날(음수) / 다음 날(143 넘음)로. 같은 시각은 원래 비어 있던 자리라 겹치지 않는다
create function public.profiles_day_start_shift() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d int := (old.day_start_hour - new.day_start_hour) * 6;
  rows jsonb;
begin
  select jsonb_agg(to_jsonb(tb)) into rows from public.time_blocks tb where tb.user_id = new.id;
  if rows is null then
    return null;
  end if;
  delete from public.time_blocks where user_id = new.id;
  insert into public.time_blocks (user_id, date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key, created_at)
    select r.user_id, r.date + p.day_shift, r.layer,
           greatest(r.start_slot + d, p.lo) - p.day_shift * 144, least(r.end_slot + d, p.hi) - p.day_shift * 144,
           r.task_id, r.daily_keyword_id, r.label, r.block_key, r.created_at
    from jsonb_populate_recordset(null::public.time_blocks, rows) r
    cross join (values (-1, -144, -1), (0, 0, 143), (1, 144, 287)) p (day_shift, lo, hi)
    where r.start_slot + d <= p.hi and r.end_slot + d >= p.lo;
  return null;
end $$;
revoke execute on function public.profiles_day_start_shift() from public, anon, authenticated;
create trigger profiles_day_start_shift after update of day_start_hour on public.profiles
  for each row when (new.day_start_hour is distinct from old.day_start_hour) execute function public.profiles_day_start_shift();

-- ───────── 4. 자정을 넘는 시간 ─────────
-- 하루 시작 시각부터 몇 번째 10분 칸인지 (끝 시각이 하루 시작과 같으면 하루의 끝 = 144)
create function public.time_slot(t time, p_day_start int, p_is_end boolean default false) returns int
language sql immutable set search_path = '' as $$
  select case when p_is_end and r = 0 then 144 else r end
  from (select (((extract(hour from t)::int * 60 + extract(minute from t)::int) - p_day_start * 60 + 1440) % 1440) / 10 as r) x;
$$;
revoke execute on function public.time_slot(time, int, boolean) from public, anon;
grant execute on function public.time_slot(time, int, boolean) to authenticated;

-- 시작~끝이 몇 칸인지 (자정을 넘어도)
create function public.time_span_slots(s time, e time) returns int
language sql immutable set search_path = '' as $$
  select ((extract(epoch from (e - s))::int / 600) + 144) % 144;
$$;
revoke execute on function public.time_span_slots(time, time) from public, anon;
grant execute on function public.time_span_slots(time, time) to authenticated;

alter table public.tasks drop constraint tasks_check3;
alter table public.tasks add constraint tasks_check3 check (not is_timed or (
  start_time is not null and end_time is not null and start_time <> end_time
  and extract(minute from start_time)::int % 10 = 0 and extract(minute from end_time)::int % 10 = 0));
alter table public.practices drop constraint practices_time_check;
alter table public.practices add constraint practices_time_check check (
  (start_time is null and end_time is null)
  or (start_time is not null and end_time is not null and start_time <> end_time
      and extract(minute from start_time)::int % 10 = 0 and extract(minute from end_time)::int % 10 = 0));

-- 끝이 시작보다 하루 시작 시각 기준으로 뒤인지 (예: 5시 시작이면 23:00~01:00은 됨, 04:00~06:00은 하루를 넘어 안 됨)
create function public.time_order_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ds int;
begin
  if new.start_time is null or new.end_time is null then
    return new;
  end if;
  select day_start_hour into ds from public.profiles where id = new.user_id;
  if public.time_slot(new.end_time, coalesce(ds, 5), true) <= public.time_slot(new.start_time, coalesce(ds, 5)) then
    raise exception 'time_order' using errcode = 'check_violation', hint = '끝 시각이 시작보다 뒤여야 해요';
  end if;
  return new;
end $$;
revoke execute on function public.time_order_guard() from public, anon, authenticated;
create trigger tasks_time_order before insert or update of start_time, end_time on public.tasks
  for each row execute function public.time_order_guard();
create trigger practices_time_order before insert or update of start_time, end_time on public.practices
  for each row execute function public.time_order_guard();

-- 트래킹: 시간 길이를 자정을 넘어도 바르게
create or replace function public.tracking_summary(p_from date, p_to date) returns jsonb
language sql stable set search_path = '' as $$
  with b as (
    select tb.layer, tb.end_slot - tb.start_slot + 1 as n, public.task_goal(tb.task_id) as goal_id
    from public.time_blocks tb
    where tb.user_id = auth.uid() and tb.date between p_from and p_to
    union all
    -- 시간을 정한 실천: 그 주 고른 요일마다
    select 'plan', public.time_span_slots(p.start_time, p.end_time), p.goal_id
    from public.practices p
    cross join lateral unnest(p.weekdays) w
    where p.user_id = auth.uid() and p.start_time is not null
      and p.week_start_date + ((w - extract(isodow from p.week_start_date)::int + 7) % 7) between p_from and p_to
  ),
  timed as (
    select coalesce(sum(public.time_span_slots(t.start_time, t.end_time)), 0)::int as n
    from public.tasks t
    where t.user_id = auth.uid() and t.is_timed and t.date between p_from and p_to
  )
  select jsonb_build_object(
    'planned', (select coalesce(sum(n), 0) from b where layer = 'plan') + (select n from timed),
    'actual', (select coalesce(sum(n), 0) from b where layer = 'actual'),
    'plan_unlinked', (select coalesce(sum(n), 0) from b where layer = 'plan' and goal_id is null) + (select n from timed),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', goal_id, 'planned', planned, 'actual', actual))
      from (
        select goal_id, coalesce(sum(n) filter (where layer = 'plan'), 0) as planned, coalesce(sum(n) filter (where layer = 'actual'), 0) as actual
        from b where goal_id is not null group by goal_id
      ) x
    ), '[]'::jsonb)
  );
$$;
