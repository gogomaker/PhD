-- MV: D-day 하나 (2026-10-03 기획 결정). 계획 탭에서 이름 + 날짜를 정하고, 기록 › 오늘 탭 줄에 보인다
alter table public.profiles
  add column dday_name text check (dday_name is null or char_length(dday_name) between 1 and 30),
  add column dday_date date;
grant update (dday_name, dday_date) on table public.profiles to authenticated;
