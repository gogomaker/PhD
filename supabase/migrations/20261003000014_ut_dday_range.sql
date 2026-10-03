-- 2026-10-03 UT: D-day 날짜는 2000~2100년 안에서만 (0001년처럼 말이 안 되는 날짜 막기)
alter table public.profiles add constraint profiles_dday_date_range check (dday_date is null or dday_date between '2000-01-01' and '2100-12-31');
