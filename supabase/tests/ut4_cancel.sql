-- UT 4차 DB 규칙 (2026-10-03): 할 일 취소
-- 실행: scripts/db.sh supabase/tests/ut4_cancel.sql → 'UT 4차 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding('student', array['건강'], 'purple', null);

do $$
declare today date := public.user_today(); kw uuid; t uuid; n int;
begin
  select id into kw from public.daily_keywords where name = '생활';
  insert into public.tasks (date, source, name, daily_keyword_id) values (today, 'direct', '은행 서류', kw) returning id into t;
  -- 오늘은 취소·풀기 가능
  update public.tasks set canceled_at = now() where id = t;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 오늘 할 일 취소'; end if;
  -- 완료와 취소는 함께일 수 없다
  begin
    update public.tasks set done_at = now() where id = t;
    raise exception 'FAIL 취소한 채로 완료';
  exception when check_violation then null; end;
  update public.tasks set canceled_at = null, done_at = now() where id = t;
  -- 내일 할 일은 취소된 채로 만들 수 없다 (체크처럼 오늘만)
  begin
    insert into public.tasks (date, source, name, daily_keyword_id, canceled_at) values (today + 1, 'direct', '내일 일', kw, now());
    raise exception 'FAIL 내일 할 일을 취소된 채로 만듦';
  exception when insufficient_privilege then null; end;
end $$;

-- 지난 날 할 일은 취소할 수 없다 (R-D2) — 어제 행은 관리자 권한으로 만든다
reset role;
insert into public.tasks (user_id, date, source, name, daily_keyword_id)
  select 'a0000000-0000-0000-0000-00000000000a', public.user_day_at('a0000000-0000-0000-0000-00000000000a', now()) - 1, 'direct', '어제 일', id
  from public.daily_keywords where user_id = 'a0000000-0000-0000-0000-00000000000a' and name = '생활';
set local role authenticated;
do $$
declare n int;
begin
  update public.tasks set canceled_at = now() where name = '어제 일';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 지난 날 할 일 취소'; end if;
end $$;

-- 알람: 취소한 예약 할 일은 울리지 않는다 (관리자 시점)
reset role;
do $$
declare A uuid := 'a0000000-0000-0000-0000-00000000000a'; d date; st time; n int; tz text; kw uuid;
begin
  select timezone into tz from public.profiles where id = A;
  d := public.user_day_at(A, now());
  st := date_trunc('hour', (now() at time zone tz)::time) + make_interval(mins => (extract(minute from (now() at time zone tz))::int / 10) * 10);
  if st >= '23:50' or st < '05:00' then return; end if;
  select id into kw from public.daily_keywords where user_id = A and name = '생활';
  insert into public.tasks (user_id, date, source, name, daily_keyword_id, is_timed, start_time, end_time, alarm, canceled_at)
    values (A, d, 'direct', '취소한 예약', kw, true, st, st + interval '10 minutes', true, now());
  select count(*) into n from public.claim_due_alarms() c where c.user_id = A;
  if n <> 0 then raise exception 'FAIL 취소한 예약 할 일에 알람'; end if;
end $$;

select 'UT 4차 DB 테스트 통과' as result;
rollback;
