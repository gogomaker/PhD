-- 2026-10-03 UT 5: 시간을 정한 실천은 그날 계획 시간이다 (오늘 화면의 '계획'과 트래킹이 같게)
-- 실천 시간은 그 목표의 계획으로 센다 (예약한 직접 추가는 예전처럼 전체 계획에만)
create or replace function public.tracking_summary(p_from date, p_to date) returns jsonb
language sql stable set search_path = '' as $$
  with b as (
    select tb.layer, tb.end_slot - tb.start_slot + 1 as n, public.task_goal(tb.task_id) as goal_id
    from public.time_blocks tb
    where tb.user_id = auth.uid() and tb.date between p_from and p_to
    union all
    -- 시간을 정한 실천: 그 주 고른 요일마다
    select 'plan', (extract(epoch from (p.end_time - p.start_time)) / 600)::int, p.goal_id
    from public.practices p
    cross join lateral unnest(p.weekdays) w
    where p.user_id = auth.uid() and p.start_time is not null
      and p.week_start_date + ((w - extract(isodow from p.week_start_date)::int + 7) % 7) between p_from and p_to
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
