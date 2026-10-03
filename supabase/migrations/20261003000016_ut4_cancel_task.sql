-- 2026-10-03 UT 4차 (기획 결정): 할 일 '취소' — 완료와 따로.
-- 더 안 하기로 한 일을 취소하면 그날 목록에 줄을 그어 남고(완료와 다른 표시), 다음 날부터 넘어오지 않는다.
-- 취소도 체크처럼 오늘만 하고 풀 수 있다 (R-D2). 완료와 취소는 함께일 수 없다.

alter table public.tasks add column canceled_at timestamptz;
alter table public.tasks add constraint tasks_done_or_canceled check (done_at is null or canceled_at is null);
grant insert (canceled_at), update (canceled_at) on table public.tasks to authenticated;

-- 취소된 채로 만드는 것도 체크처럼 오늘만
drop policy "tasks: 오늘·내일만 추가" on public.tasks;
create policy "tasks: 오늘·내일만 추가" on public.tasks for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.day_offset(date) between 0 and 1
    and (done_at is null or public.day_offset(date) = 0)
    and (canceled_at is null or public.day_offset(date) = 0)
    and (carried_from_date is null or public.day_offset(date) = 0)
    and public.task_refs_ok(practice_id, daily_keyword_id, carried_task_id)
    and public.subgoal_open(subgoal_id)
  );

-- 알람: 취소한 할 일은 울리지 않는다
create or replace function public.claim_due_alarms() returns table (task_id uuid, user_id uuid, name text, start_time time, end_time time)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  -- 예약한 직접 추가 할 일
  return query
  with u as (
    update public.tasks t set alarm_sent_at = now()
    where t.is_timed and t.alarm and t.alarm_sent_at is null and t.done_at is null and t.canceled_at is null
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
      do update set alarm_sent_at = now() where t.alarm_sent_at is null and t.done_at is null and t.canceled_at is null
    returning t.id, t.practice_id
  )
  select ins.id, due.user_id, due.name, due.start_time, due.end_time
  from ins join due on due.practice_id = ins.practice_id;
end $$;
revoke execute on function public.claim_due_alarms() from public, anon, authenticated;
grant execute on function public.claim_due_alarms() to service_role;
