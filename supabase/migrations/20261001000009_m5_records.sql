-- M5. 기록과 회고: 목표 마무리(R-G6~G8), 진척도, 인증사진, 트래킹 집계(4.7, R-K1), 회고 알림
-- 기획 결정(2026-10-01): 마무리한 목표의 실천은 마무리한 다음 날부터 할 일로 나오지 않는다(화면 계산), 회고 알림을 보낸다.

-- ───────── 목표 마무리 ─────────
alter table public.goals
  add column finished_at timestamptz,
  add column finish_photo_path text,
  add column retro_achieved text check (char_length(retro_achieved) <= 1000),
  add column retro_regret text check (char_length(retro_regret) <= 1000),
  add column retro_next text check (char_length(retro_next) <= 1000),
  -- 인증사진은 완성일 때만 (R-G6)
  add constraint goals_photo_only_completed check (finish_photo_path is null or status = 'completed'),
  add constraint goals_finished_has_time check ((status in ('completed', 'dropped')) = (finished_at is not null));

-- R-G5: 진행 중 목표만 마무리. R-G7: 마무리한 목표는 다시 열 수 없다(상태는 이 함수만 바꾼다)
create function public.finish_goal(p_goal uuid, p_kind text, p_photo text, p_achieved text, p_regret text, p_next text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if p_kind not in ('completed', 'dropped') then
    raise exception 'finish_kind_invalid';
  end if;
  if p_photo is not null and (p_kind <> 'completed' or p_photo not like uid::text || '/%') then
    raise exception 'finish_photo_invalid' using hint = '인증사진은 완성일 때만 올릴 수 있어요';
  end if;
  update public.goals
    set status = p_kind, finished_at = now(), finish_photo_path = p_photo,
        retro_achieved = nullif(btrim(p_achieved), ''), retro_regret = nullif(btrim(p_regret), ''), retro_next = nullif(btrim(p_next), ''),
        table_hidden = true
    where id = p_goal and user_id = uid and status = 'in_progress';
  if not found then
    raise exception 'goal_not_in_progress' using hint = '진행 중인 목표만 마무리할 수 있어요';
  end if;
end $$;
revoke execute on function public.finish_goal(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.finish_goal(uuid, text, text, text, text, text) to authenticated;

-- ───────── 진척도 (사용자가 직접, 바뀐 기록을 남긴다) ─────────
create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  percent smallint not null check (percent between 0 and 100),
  created_at timestamptz not null default now()
);
create index goal_progress_goal on public.goal_progress (goal_id, created_at desc);
alter table public.goal_progress enable row level security;
revoke all on table public.goal_progress from anon, authenticated;
grant select on table public.goal_progress to authenticated;
grant insert (goal_id, percent) on table public.goal_progress to authenticated;
create policy "goal_progress: 본인만 읽기" on public.goal_progress for select to authenticated using (user_id = auth.uid());
create policy "goal_progress: 열린 목표에만 기록" on public.goal_progress for insert to authenticated
  with check (user_id = auth.uid() and public.goal_is_open(goal_id));

-- ───────── 인증사진 저장소 (본인 폴더만) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('goal-photos', 'goal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "goal-photos: 본인 폴더 읽기" on storage.objects for select to authenticated
  using (bucket_id = 'goal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "goal-photos: 본인 폴더에 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'goal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "goal-photos: 본인 폴더에서 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'goal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── 트래킹 집계 (4.7) ─────────
-- 계획 시간은 할 일과 연결된 계획 블록만 목표별로 센다. 키워드·자유 이름·이름 없는 계획, 예약(직접 추가)은 전체 계획에만.
-- R-K1: 실제 시간은 실제 블록 → 할 일 → 실천 → 목표. 일상 키워드 블록은 전체 실제 시간에만.
-- 단위: 10분 칸 수
create function public.tracking_summary(p_from date, p_to date) returns jsonb
language sql stable set search_path = '' as $$
  with b as (
    select tb.layer, tb.end_slot - tb.start_slot + 1 as n, p.goal_id
    from public.time_blocks tb
    left join public.tasks t on t.id = tb.task_id
    left join public.practices p on p.id = t.practice_id
    where tb.user_id = auth.uid() and tb.date between p_from and p_to
  ),
  timed as (
    select coalesce(sum(extract(epoch from (t.end_time - t.start_time)) / 600), 0)::int as n
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
revoke execute on function public.tracking_summary(date, date) from public, anon;
grant execute on function public.tracking_summary(date, date) to authenticated;

-- 목표별 누적: 실제 시간(10분 칸 수), 완료한 할 일 수, 처음 기록한 날
create function public.goal_totals() returns table (goal_id uuid, actual_slots int, done_tasks int, first_day date)
language sql stable set search_path = '' as $$
  select g.id,
    coalesce((select sum(tb.end_slot - tb.start_slot + 1) from public.time_blocks tb join public.tasks t on t.id = tb.task_id join public.practices p on p.id = t.practice_id
              where tb.layer = 'actual' and p.goal_id = g.id), 0)::int,
    coalesce((select count(*) from public.tasks t join public.practices p on p.id = t.practice_id where p.goal_id = g.id and t.done_at is not null), 0)::int,
    (select min(tb.date) from public.time_blocks tb join public.tasks t on t.id = tb.task_id join public.practices p on p.id = t.practice_id
      where tb.layer = 'actual' and p.goal_id = g.id)
  from public.goals g
  where g.user_id = auth.uid();
$$;
revoke execute on function public.goal_totals() from public, anon;
grant execute on function public.goal_totals() to authenticated;

-- ───────── 회고 알림: 매일 정한 시각, 그날 하루 기록을 아직 안 썼으면 ─────────
alter table public.profiles add column review_notified_on date;

create function public.claim_due_reviews() returns table (user_id uuid)
language sql security definer set search_path = '' as $$
  update public.profiles p set review_notified_on = public.user_day_at(p.id, now())
  where p.review_notify_enabled
    and p.review_notified_on is distinct from public.user_day_at(p.id, now())
    and (now() at time zone p.timezone)::time >= p.review_notify_time
    and (now() at time zone p.timezone)::time < p.review_notify_time + interval '15 minutes'
    and not exists (select 1 from public.day_journals j where j.user_id = p.id and j.date = public.user_day_at(p.id, now()))
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  returning p.id;
$$;
revoke execute on function public.claim_due_reviews() from public, anon, authenticated;
grant execute on function public.claim_due_reviews() to service_role;
