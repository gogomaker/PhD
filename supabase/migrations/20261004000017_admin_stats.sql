-- 2026-10-04 기획 요청: 서비스 관리 페이지 (가입자 수, DAU, WAU)
-- 활동 = 그날 앱을 연 것. 앱이 하루 한 번 touch_active()로 남긴다 (사용자 시간대와 무관하게 한국 날짜 기준).
-- 관리자만 집계를 본다. 개인 데이터는 내보내지 않고 숫자만.

create table public.daily_active (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.daily_active enable row level security;
revoke all on table public.daily_active from anon, authenticated;

-- 지난 활동 채우기: 기록을 남긴 날(할 일·시간표·하루 기록)을 그날 연 것으로 본다
insert into public.daily_active (user_id, day)
select distinct user_id, (created_at at time zone 'Asia/Seoul')::date from public.time_blocks
union select distinct user_id, (created_at at time zone 'Asia/Seoul')::date from public.tasks where alarm_sent_at is null
union select distinct user_id, (updated_at at time zone 'Asia/Seoul')::date from public.day_journals
on conflict do nothing;

-- 오늘 앱을 열었음 (같은 날 여러 번 불러도 한 줄)
create function public.touch_active() returns void
language sql security definer set search_path = '' as $$
  insert into public.daily_active (user_id, day)
  select auth.uid(), (now() at time zone 'Asia/Seoul')::date where auth.uid() is not null
  on conflict do nothing;
$$;
revoke execute on function public.touch_active() from public, anon;
grant execute on function public.touch_active() to authenticated;

-- 관리자 (기획자 계정). 화면에서는 읽지도 고치지도 못한다
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;
insert into public.admins (user_id) select id from auth.users where lower(email) = 'daseulgi100@gmail.com' on conflict do nothing;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 집계 (테스트 계정 제외). 날짜는 한국 날짜
create function public.admin_stats(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  n int := least(greatest(p_days, 1), 90);
begin
  if not public.is_admin() then
    raise exception 'not_admin' using hint = '관리자만 볼 수 있어요';
  end if;
  return (
    with real_users as (
      select id, (created_at at time zone 'Asia/Seoul')::date as joined
      from auth.users where email not like '%@phd-test.dev'
    ),
    act as (
      select a.user_id, a.day from public.daily_active a join real_users u on u.id = a.user_id
    ),
    days as (
      select (today - i)::date as day from generate_series(0, n - 1) i
    )
    select jsonb_build_object(
      'today', today,
      'users', (select count(*) from real_users),
      'joined_today', (select count(*) from real_users where joined = today),
      'onboarded', (select count(*) from public.profiles p join real_users u on u.id = p.id where p.onboarded_at is not null),
      'dau', (select count(distinct user_id) from act where day = today),
      'wau', (select count(distinct user_id) from act where day > today - 7),
      'mau', (select count(distinct user_id) from act where day > today - 30),
      'daily', (
        select jsonb_agg(jsonb_build_object(
          'day', d.day,
          'dau', (select count(distinct user_id) from act where act.day = d.day),
          'wau', (select count(distinct user_id) from act where act.day > d.day - 7 and act.day <= d.day),
          'joined', (select count(*) from real_users where joined = d.day),
          'users', (select count(*) from real_users where joined <= d.day)
        ) order by d.day desc)
        from days d
      )
    )
  );
end $$;
revoke execute on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;
