-- M4. 모바일 하루 플래너: tasks(할 일), time_blocks(10분 시간표), day_journals(하루 기록)
-- 규칙: 4.3 할 일이 생기는 방법, R-D1 사용자 기준 날짜, R-D2 지난 날은 서버에서도 수정 불가,
--       4.4 날짜별 권한(체크·실제 칠하기·하루 기록 = 오늘 / 담기·직접 추가·계획 그리기 = 오늘·내일)
-- 할 일은 "필요할 때 만든다": 반복·자동 배정 할 일은 화면에서 계산하고, 체크하거나 칠하거나 이름을 붙일 때 행을 만든다.
-- 기획 결정(2026-10-01): 못 한 일은 끝낼 때까지 넘어간다. 오늘·내일 직접 추가한 일은 지울 수 있다.

-- ───────── 일상 키워드: 지우면 보관(지난 기록이 가리키므로) ─────────
alter table public.daily_keywords add column archived boolean not null default false;
grant update (archived) on table public.daily_keywords to authenticated;
revoke delete on table public.daily_keywords from authenticated;

-- ───────── 할 일 ─────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 이 행이 속한 날 (사용자 기준 날짜)
  date date not null,
  source text not null check (source in ('repeat', 'auto', 'picked', 'direct')),
  practice_id uuid references public.practices (id) on delete cascade,
  -- 직접 추가
  name text check (char_length(btrim(name)) between 1 and 40),
  daily_keyword_id uuid references public.daily_keywords (id),
  -- 예약 (직접 추가 + 시간 지정)
  is_timed boolean not null default false,
  start_time time,
  end_time time,
  alarm boolean not null default false,
  alarm_sent_at timestamptz,
  -- 넘어온 일: 처음 날짜 / (직접 추가) 처음 행
  carried_from_date date,
  carried_task_id uuid references public.tasks (id) on delete cascade,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  check ((source = 'direct') = (practice_id is null)),
  check (source = 'direct' or (name is null and daily_keyword_id is null and not is_timed)),
  check (source <> 'direct' or carried_task_id is not null or (name is not null and daily_keyword_id is not null)),
  check (not is_timed or (start_time is not null and end_time is not null and end_time > start_time and extract(minute from start_time)::int % 10 = 0 and extract(minute from end_time)::int % 10 = 0)),
  check (carried_from_date is null or carried_from_date < date),
  check (carried_task_id is null or (source = 'direct' and carried_from_date is not null))
);
create unique index tasks_practice_day on public.tasks (practice_id, date, source) where practice_id is not null;
create unique index tasks_carried_day on public.tasks (carried_task_id, date) where carried_task_id is not null;
create index tasks_user_date on public.tasks (user_id, date);

-- ───────── 10분 시간표 ─────────
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  layer text not null check (layer in ('plan', 'actual')),
  -- 하루 시작 시각 기준 10분 칸 0~143, 끝 포함
  start_slot smallint not null check (start_slot between 0 and 143),
  end_slot smallint not null check (end_slot between 0 and 143),
  task_id uuid references public.tasks (id) on delete cascade,
  daily_keyword_id uuid references public.daily_keywords (id),
  label text check (char_length(btrim(label)) between 1 and 20),
  -- 같은 계획 블록(이름 하나)이 여러 행으로 나뉠 때 묶는 번호
  block_key text,
  created_at timestamptz not null default now(),
  check (end_slot >= start_slot),
  -- 연결 대상은 하나: 할 일 | 일상 키워드 | 자유 키워드(계획만) | 없음(계획만)
  check (num_nonnulls(task_id, daily_keyword_id, label) <= 1),
  check (layer = 'plan' or (label is null and num_nonnulls(task_id, daily_keyword_id) = 1)),
  -- 같은 날·같은 층에서 구간은 겹치지 않는다
  constraint time_blocks_no_overlap exclude using gist (user_id with =, date with =, layer with =, int4range(start_slot, end_slot, '[]') with &&)
);
create index time_blocks_user_date on public.time_blocks (user_id, date);

-- ───────── 하루 기록 ─────────
create table public.day_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  score smallint check (score between 1 and 5),
  reason text not null default '' check (char_length(reason) <= 100),
  thanks text[] not null default array['', '', ''] check (cardinality(thanks) = 3),
  memo text not null default '' check (char_length(memo) <= 2000),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ───────── 날짜 권한 (R-D2) ─────────
-- 0 = 오늘, 1 = 내일, 음수 = 지난 날
create function public.day_offset(d date) returns int
language sql stable set search_path = '' as $$
  select d - public.user_today();
$$;
revoke execute on function public.day_offset(date) from public, anon;
grant execute on function public.day_offset(date) to authenticated;

-- 할 일이 본인 것을 가리키는지
create function public.task_refs_ok(p_practice uuid, p_keyword uuid, p_carried uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (p_practice is null or exists (select 1 from public.practices p where p.id = p_practice and p.user_id = auth.uid()))
     and (p_keyword is null or exists (select 1 from public.daily_keywords k where k.id = p_keyword and k.user_id = auth.uid()))
     and (p_carried is null or exists (select 1 from public.tasks t where t.id = p_carried and t.user_id = auth.uid() and t.source = 'direct'));
$$;
revoke execute on function public.task_refs_ok(uuid, uuid, uuid) from public, anon;
grant execute on function public.task_refs_ok(uuid, uuid, uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.time_blocks enable row level security;
alter table public.day_journals enable row level security;
revoke all on table public.tasks, public.time_blocks, public.day_journals from anon, authenticated;

grant select, delete on table public.tasks to authenticated;
grant insert (date, source, practice_id, name, daily_keyword_id, is_timed, start_time, end_time, alarm, carried_from_date, carried_task_id, done_at) on table public.tasks to authenticated;
grant update (done_at) on table public.tasks to authenticated;

create policy "tasks: 본인만 읽기" on public.tasks for select to authenticated using (user_id = auth.uid());
-- 오늘·내일만 만든다. 체크된 채로 만드는 건 오늘만. 넘어온 일은 오늘만
create policy "tasks: 오늘·내일만 추가" on public.tasks for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.day_offset(date) between 0 and 1
    and (done_at is null or public.day_offset(date) = 0)
    and (carried_from_date is null or public.day_offset(date) = 0)
    and public.task_refs_ok(practice_id, daily_keyword_id, carried_task_id)
  );
-- 체크(완료)는 오늘만
create policy "tasks: 오늘만 체크" on public.tasks for update to authenticated
  using (user_id = auth.uid() and public.day_offset(date) = 0)
  with check (user_id = auth.uid() and public.day_offset(date) = 0);
-- 지우기(담기 취소, 직접 추가 삭제)는 오늘·내일만
create policy "tasks: 오늘·내일만 삭제" on public.tasks for delete to authenticated
  using (user_id = auth.uid() and public.day_offset(date) between 0 and 1);

grant select on table public.time_blocks to authenticated;
grant insert (date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key) on table public.time_blocks to authenticated;
grant delete on table public.time_blocks to authenticated;

create function public.block_refs_ok(p_task uuid, p_keyword uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (p_task is null or exists (select 1 from public.tasks t where t.id = p_task and t.user_id = auth.uid()))
     and (p_keyword is null or exists (select 1 from public.daily_keywords k where k.id = p_keyword and k.user_id = auth.uid()));
$$;
revoke execute on function public.block_refs_ok(uuid, uuid) from public, anon;
grant execute on function public.block_refs_ok(uuid, uuid) to authenticated;

create policy "time_blocks: 본인만 읽기" on public.time_blocks for select to authenticated using (user_id = auth.uid());
-- 계획 = 오늘·내일, 실제 = 오늘
create policy "time_blocks: 허용된 날만 추가" on public.time_blocks for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.block_refs_ok(task_id, daily_keyword_id)
    and case layer when 'plan' then public.day_offset(date) between 0 and 1 else public.day_offset(date) = 0 end
  );
create policy "time_blocks: 허용된 날만 삭제" on public.time_blocks for delete to authenticated
  using (user_id = auth.uid() and case layer when 'plan' then public.day_offset(date) between 0 and 1 else public.day_offset(date) = 0 end);

grant select on table public.day_journals to authenticated;
grant insert (date, score, reason, thanks, memo) on table public.day_journals to authenticated;
grant update (score, reason, thanks, memo, updated_at) on table public.day_journals to authenticated;
create policy "day_journals: 본인만 읽기" on public.day_journals for select to authenticated using (user_id = auth.uid());
create policy "day_journals: 오늘만 쓰기" on public.day_journals for insert to authenticated
  with check (user_id = auth.uid() and public.day_offset(date) = 0);
create policy "day_journals: 오늘만 고치기" on public.day_journals for update to authenticated
  using (user_id = auth.uid() and public.day_offset(date) = 0)
  with check (user_id = auth.uid() and public.day_offset(date) = 0);

-- 한 층(계획 또는 실제)의 하루치 블록을 통째로 바꾼다. 권한 검사는 위 정책이 한다(security invoker)
create function public.save_day_blocks(p_date date, p_layer text, p_blocks jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  off int := public.day_offset(p_date);
begin
  if off < 0 or off > 1 or (p_layer = 'actual' and off <> 0) then
    raise exception 'day_locked' using hint = '이 날은 시간표를 바꿀 수 없어요';
  end if;
  delete from public.time_blocks where user_id = auth.uid() and date = p_date and layer = p_layer;
  insert into public.time_blocks (date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key)
    select p_date, p_layer, (b ->> 'start')::smallint, (b ->> 'end')::smallint,
           nullif(b ->> 'task_id', '')::uuid, nullif(b ->> 'keyword_id', '')::uuid, nullif(btrim(b ->> 'label'), ''), b ->> 'key'
    from jsonb_array_elements(p_blocks) b;
end $$;
revoke execute on function public.save_day_blocks(date, text, jsonb) from public, anon;
grant execute on function public.save_day_blocks(date, text, jsonb) to authenticated;

-- 할 일 기록이 있으면 실천을 모두 지워도 목표를 시작 전으로 되돌리지 않는다 (M3 결정 보완)
create or replace function public.practices_goal_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'INSERT' then
    update public.goals set status = 'in_progress', started_at = coalesce(started_at, now())
      where id = new.goal_id and status = 'not_started';
  else
    if not exists (select 1 from public.practices where goal_id = old.goal_id) then
      update public.goals set status = 'not_started', started_at = null
        where id = old.goal_id and status = 'in_progress';
    end if;
  end if;
  return null;
end $$;
