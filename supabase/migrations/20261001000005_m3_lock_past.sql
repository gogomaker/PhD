-- M3 수정 (2026-10-01 기획 결정)
-- 1) 한 주의 시작은 일요일로 고정한다.
-- 2) 지난 기간의 계획은 무조건 잠근다 — 화면뿐 아니라 DB 권한에서도 (R-D2를 계획 표에 확장, R-P12)
--    연간 칸: 지난달에 걸친 칸 / 월간 칸·월간 참고사항: 지난주에 걸친 칸 /
--    주간 참고사항·실천: 지난 날에 걸친 것 → 추가·수정·삭제 불가. "오늘"은 사용자 시간대 + 하루 시작 시각 기준 (R-D1)

-- ───────── 한 주 시작 = 일요일 ─────────
update public.profiles set week_start = 'sun';
alter table public.profiles alter column week_start set default 'sun';
alter table public.profiles drop constraint profiles_week_start_check;
alter table public.profiles add constraint profiles_week_start_check check (week_start = 'sun');
revoke update (week_start) on table public.profiles from authenticated;

-- ───────── 날짜 도우미 ─────────
-- R-D1: 사용자 기준 오늘
create function public.user_today() returns date
language sql stable security definer set search_path = '' as $$
  select ((now() at time zone p.timezone) - make_interval(hours => p.day_start_hour))::date
  from public.profiles p where p.id = auth.uid();
$$;

-- 그 날이 속한 주의 일요일
create function public.sunday_of(d date) returns date
language sql immutable set search_path = '' as $$
  select d - extract(dow from d)::int;
$$;

-- 그 달의 idx번째 주(0부터) 첫날. 두 달에 걸친 주는 날이 많은 달(4번째 날이 있는 달)의 주 (src/lib/plan.ts와 같은 규칙)
create function public.month_week_start(ym date, idx int) returns date
language sql immutable set search_path = '' as $$
  select case when extract(month from public.sunday_of(ym) + 3) = extract(month from ym)
              then public.sunday_of(ym) else public.sunday_of(ym) + 7 end + 7 * idx;
$$;

-- 실천의 가장 이른 날짜 (요일 1=월 … 7=일)
create function public.practice_first_date(week_start date, weekdays smallint[]) returns date
language sql immutable set search_path = '' as $$
  select week_start + min(((w - extract(isodow from week_start)::int + 7) % 7))::int
  from unnest(weekdays) w;
$$;

-- 지난 기간인지 (잠금)
create function public.plan_locked(kind text, d date) returns boolean
language sql stable security definer set search_path = '' as $$
  select case kind
    when 'month' then d < date_trunc('month', public.user_today())::date
    when 'week' then d < public.sunday_of(public.user_today())
    else d < public.user_today()
  end;
$$;

revoke execute on function public.user_today() from public, anon;
revoke execute on function public.plan_locked(text, date) from public, anon;
grant execute on function public.user_today() to authenticated;
grant execute on function public.plan_locked(text, date) to authenticated;

-- ───────── 연간 칸: 지난달에 걸치면 잠금 ─────────
drop policy "year_cells: 열린 목표에만 추가" on public.year_cells;
drop policy "year_cells: 열린 목표만 고치기" on public.year_cells;
drop policy "year_cells: 열린 목표만 삭제" on public.year_cells;
create policy "year_cells: 열린 목표, 지나지 않은 달에만 추가" on public.year_cells for insert to authenticated
  with check (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('month', start_month));
create policy "year_cells: 열린 목표, 지나지 않은 칸만 고치기" on public.year_cells for update to authenticated
  using (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('month', start_month))
  with check (user_id = auth.uid() and not public.plan_locked('month', start_month));
create policy "year_cells: 열린 목표, 지나지 않은 칸만 삭제" on public.year_cells for delete to authenticated
  using (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('month', start_month));

-- ───────── 월간 칸: 지난주에 걸치면 잠금 ─────────
drop policy "month_cells: 열린 목표에만 추가" on public.month_cells;
drop policy "month_cells: 열린 목표만 고치기" on public.month_cells;
drop policy "month_cells: 열린 목표만 삭제" on public.month_cells;
create policy "month_cells: 열린 목표, 지나지 않은 주에만 추가" on public.month_cells for insert to authenticated
  with check (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('week', public.month_week_start(year_month, start_week)));
create policy "month_cells: 열린 목표, 지나지 않은 칸만 고치기" on public.month_cells for update to authenticated
  using (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('week', public.month_week_start(year_month, start_week)))
  with check (user_id = auth.uid() and not public.plan_locked('week', public.month_week_start(year_month, start_week)));
create policy "month_cells: 열린 목표, 지나지 않은 칸만 삭제" on public.month_cells for delete to authenticated
  using (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('week', public.month_week_start(year_month, start_week)));

-- ───────── 참고사항: 월간은 지난주, 주간은 지난 날에 걸치면 잠금 ─────────
create function public.note_locked(scope text, period_key date, start_index smallint) returns boolean
language sql stable set search_path = '' as $$
  select case scope
    when 'month' then public.plan_locked('week', public.month_week_start(period_key, start_index))
    else public.plan_locked('day', period_key + start_index)
  end;
$$;
revoke execute on function public.note_locked(text, date, smallint) from public, anon;
grant execute on function public.note_locked(text, date, smallint) to authenticated;

drop policy "notes: 본인만 추가" on public.notes;
drop policy "notes: 본인만 고치기" on public.notes;
drop policy "notes: 본인만 삭제" on public.notes;
create policy "notes: 지나지 않은 칸에만 추가" on public.notes for insert to authenticated
  with check (user_id = auth.uid() and not public.note_locked(scope, period_key, start_index));
create policy "notes: 지나지 않은 칸만 고치기" on public.notes for update to authenticated
  using (user_id = auth.uid() and not public.note_locked(scope, period_key, start_index))
  with check (user_id = auth.uid() and not public.note_locked(scope, period_key, start_index));
create policy "notes: 지나지 않은 칸만 삭제" on public.notes for delete to authenticated
  using (user_id = auth.uid() and not public.note_locked(scope, period_key, start_index));

-- ───────── 실천: 지난 날이 하나라도 있으면 잠금 ─────────
-- 주 첫날은 일요일이어야 한다
alter table public.practices add constraint practices_week_starts_sunday check (extract(dow from week_start_date) = 0);
alter table public.notes add constraint notes_week_starts_sunday check (scope <> 'week' or extract(dow from period_key) = 0);

drop policy "practices: 열린 목표에만 추가" on public.practices;
drop policy "practices: 열린 목표만 삭제" on public.practices;
create policy "practices: 열린 목표, 오늘 이후 날짜만 추가" on public.practices for insert to authenticated
  with check (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('day', public.practice_first_date(week_start_date, weekdays)));
create policy "practices: 열린 목표, 지난 날 없는 것만 삭제" on public.practices for delete to authenticated
  using (user_id = auth.uid() and public.goal_is_open(goal_id) and not public.plan_locked('day', public.practice_first_date(week_start_date, weekdays)));
