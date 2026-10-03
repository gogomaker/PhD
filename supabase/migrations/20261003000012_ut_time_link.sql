-- 2026-10-03 UT 5~9 (기획 결정)
--  5. 실천에 시간(선택): 그날 시간표에 계획으로 놓이고 알람이 울린다
--  8. PC에서 새 목표는 계획 표에 바로 나온다 (표에 올림이 기본)
--  9. 직접 추가한 할 일을 목표의 세부목표와 연결할 수 있다 → 칠한 시간이 그 목표에 쌓인다

-- ───────── 8. 새 목표는 표에 올린 채로 ─────────
alter table public.goals alter column table_hidden set default false;

-- ───────── 5. 실천 시간 ─────────
alter table public.practices
  add column start_time time,
  add column end_time time,
  add constraint practices_time_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time
        and extract(minute from start_time)::int % 10 = 0 and extract(minute from end_time)::int % 10 = 0)
  );
grant insert (start_time, end_time) on table public.practices to authenticated;

-- ───────── 9. 직접 추가 ↔ 세부목표 ─────────
alter table public.tasks add column subgoal_id uuid references public.subgoals (id);
create index tasks_subgoal on public.tasks (subgoal_id) where subgoal_id is not null;
alter table public.tasks drop constraint tasks_check1, drop constraint tasks_check2;
alter table public.tasks
  add constraint tasks_check1 check (source = 'direct' or (name is null and daily_keyword_id is null and subgoal_id is null and not is_timed)),
  -- 직접 추가(처음 행)는 이름 + (일상 키워드 | 세부목표) 하나
  add constraint tasks_check2 check (source <> 'direct' or carried_task_id is not null or (name is not null and num_nonnulls(daily_keyword_id, subgoal_id) = 1));
grant insert (subgoal_id) on table public.tasks to authenticated;

-- 세부목표가 내 것이고, 그 목표가 아직 마무리 전인지
create function public.subgoal_open(p_subgoal uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_subgoal is null or exists (
    select 1 from public.subgoals s join public.goals g on g.id = s.goal_id
    where s.id = p_subgoal and g.user_id = auth.uid() and g.status in ('not_started', 'in_progress')
  );
$$;
revoke execute on function public.subgoal_open(uuid) from public, anon;
grant execute on function public.subgoal_open(uuid) to authenticated;

drop policy "tasks: 오늘·내일만 추가" on public.tasks;
create policy "tasks: 오늘·내일만 추가" on public.tasks for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.day_offset(date) between 0 and 1
    and (done_at is null or public.day_offset(date) = 0)
    and (carried_from_date is null or public.day_offset(date) = 0)
    and public.task_refs_ok(practice_id, daily_keyword_id, carried_task_id)
    and public.subgoal_open(subgoal_id)
  );

-- 목표에 연결한 할 일을 만들면 그 목표는 '진행 중' (실천을 만들 때와 같이)
create function public.tasks_goal_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.goals g set status = 'in_progress', started_at = coalesce(g.started_at, now())
    from public.subgoals s
    where s.id = new.subgoal_id and g.id = s.goal_id and g.status = 'not_started';
  return null;
end $$;
revoke execute on function public.tasks_goal_status() from public, anon, authenticated;
create trigger tasks_goal_status after insert on public.tasks
  for each row when (new.subgoal_id is not null) execute function public.tasks_goal_status();

-- ───────── 집계: 할 일 → (실천 | 직접 추가의 세부목표) → 목표 ─────────
-- 넘어온 직접 추가는 처음 행의 세부목표를 따른다
create or replace function public.task_goal(p_task uuid) returns uuid
language sql stable set search_path = '' as $$
  select coalesce(p.goal_id, s.goal_id)
  from public.tasks t
  left join public.practices p on p.id = t.practice_id
  left join public.tasks o on o.id = coalesce(t.carried_task_id, t.id)
  left join public.subgoals s on s.id = o.subgoal_id
  where t.id = p_task;
$$;
revoke execute on function public.task_goal(uuid) from public, anon;
grant execute on function public.task_goal(uuid) to authenticated;

create or replace function public.tracking_summary(p_from date, p_to date) returns jsonb
language sql stable set search_path = '' as $$
  with b as (
    select tb.layer, tb.end_slot - tb.start_slot + 1 as n, public.task_goal(tb.task_id) as goal_id
    from public.time_blocks tb
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

create or replace function public.goal_totals() returns table (goal_id uuid, actual_slots int, done_tasks int, first_day date)
language sql stable set search_path = '' as $$
  with blocks as (
    select tb.date, tb.end_slot - tb.start_slot + 1 as n, public.task_goal(tb.task_id) as goal_id
    from public.time_blocks tb where tb.user_id = auth.uid() and tb.layer = 'actual' and tb.task_id is not null
  ),
  done as (
    select public.task_goal(t.id) as goal_id from public.tasks t where t.user_id = auth.uid() and t.done_at is not null
  )
  select g.id,
    coalesce((select sum(n) from blocks where blocks.goal_id = g.id), 0)::int,
    (select count(*) from done where done.goal_id = g.id)::int,
    (select min(date) from blocks where blocks.goal_id = g.id)
  from public.goals g
  where g.user_id = auth.uid();
$$;

-- ───────── 5. 실천 알람: 시간을 정한 실천도 그 시각에 알린다 ─────────
-- 실천 할 일 행은 평소엔 필요할 때 만드는데, 알람을 보낼 때 만들고 "보냄"을 적어 두 번 보내지 않는다
create or replace function public.claim_due_alarms() returns table (task_id uuid, user_id uuid, name text, start_time time, end_time time)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  -- 예약한 직접 추가 할 일 (예전과 같음)
  return query
  with u as (
    update public.tasks t set alarm_sent_at = now()
    where t.is_timed and t.alarm and t.alarm_sent_at is null and t.done_at is null
      and t.date between current_date - 2 and current_date + 2
      and public.task_alarm_at(t) <= now() and public.task_alarm_at(t) > now() - interval '15 minutes'
    returning t.id, t.user_id, t.name, t.start_time, t.end_time
  )
  select u.id, u.user_id, u.name, u.start_time, u.end_time from u;

  -- 시간을 정한 실천

  return query
  with due as (
    select p.id as practice_id, p.user_id, p.name, p.start_time, p.end_time, d.day,
           case when p.kind = 'repeat' then 'repeat' else 'auto' end as source
    from public.practices p
    join public.goals g on g.id = p.goal_id and g.status in ('not_started', 'in_progress')
    join public.profiles pr on pr.id = p.user_id
    cross join lateral (
      select p.week_start_date + ((w - extract(isodow from p.week_start_date)::int + 7) % 7) as day from unnest(p.weekdays) w
    ) d
    where p.start_time is not null
      and d.day between current_date - 2 and current_date + 2
      and ((d.day + case when extract(hour from p.start_time) < pr.day_start_hour then 1 else 0 end) + p.start_time) at time zone pr.timezone
          between now() - interval '15 minutes' and now()
  ),
  ins as (
    insert into public.tasks as t (user_id, date, source, practice_id, alarm_sent_at)
    select due.user_id, due.day, due.source, due.practice_id, now() from due
    on conflict (practice_id, date, source) where practice_id is not null
      do update set alarm_sent_at = now() where t.alarm_sent_at is null and t.done_at is null
    returning t.id, t.practice_id
  )
  select ins.id, due.user_id, due.name, due.start_time, due.end_time
  from ins join due on due.practice_id = ins.practice_id;
end $$;
revoke execute on function public.claim_due_alarms() from public, anon, authenticated;
grant execute on function public.claim_due_alarms() to service_role;
