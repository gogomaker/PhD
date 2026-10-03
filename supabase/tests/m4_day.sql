-- M4 DB 규칙 테스트 (할 일·시간표·하루 기록). 한 트랜잭션, 날짜는 "오늘" 기준 상대 계산, 마지막에 되돌림.
-- 실행: scripts/db.sh supabase/tests/m4_day.sql  → 'M4 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"이다라"}');

-- 실제 칠하기는 지금 칸까지만이라(2026-10-03), 테스트 사용자의 '지금'을 그날 22시쯤으로 맞춘다
update public.profiles set timezone = (
  select case when o > 0 then 'Etc/GMT-' || o when o < 0 then 'Etc/GMT+' || -o else 'UTC' end
  from (select ((22 - extract(hour from now() at time zone 'UTC')::int + 36) % 24) - 12 as o) x)
where id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
create temp table d on commit drop as select public.user_today() as today;
grant select on d to authenticated;

set local role authenticated;
select public.complete_onboarding('student', array['어학'], 'purple', null);

do $$
declare n int; t text; today date; g uuid; s uuid; p_once uuid; p_rep uuid; kw uuid; t1 uuid; t2 uuid; t3 uuid;
begin
  select d.today into today from d;
  insert into public.goals (category_id, name, due_month) select id, '토익 850', '2030-01-01' from public.categories where kind = 'goal' returning id into g;
  insert into public.subgoals (goal_id, name) values (g, 'LC') returning id into s;
  -- 오늘 요일 단발, 매일 반복 (다음 주 것도 하나)
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, kind, weekdays)
    values (g, s, public.sunday_of(today), 'Part 1', 'once', array[extract(isodow from today)::smallint]) returning id into p_once;
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, kind, weekdays)
    values (g, s, public.sunday_of(today) + 7, '단어', 'repeat', '{1,2,3,4,5,6,7}') returning id into p_rep;
  select id into kw from public.daily_keywords where name = '생활';

  -- ── 할 일: 오늘·내일만 만든다 (4.4) ──
  insert into public.tasks (date, source, name, daily_keyword_id) values (today, 'direct', '장보기', kw) returning id into t1;
  insert into public.tasks (date, source, name, daily_keyword_id) values (today + 1, 'direct', '은행', kw) returning id into t2;
  begin
    insert into public.tasks (date, source, name, daily_keyword_id) values (today + 2, 'direct', '모레', kw);
    raise exception 'FAIL 모레 할 일 추가';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks (date, source, name, daily_keyword_id) values (today - 1, 'direct', '어제', kw);
    raise exception 'FAIL 어제 할 일 추가';
  exception when insufficient_privilege then null; end;
  -- 내일 할 일은 체크된 채로 못 만든다
  begin
    insert into public.tasks (date, source, name, daily_keyword_id, done_at) values (today + 1, 'direct', '미리 체크', kw, now());
    raise exception 'FAIL 내일 할 일을 체크';
  exception when insufficient_privilege then null; end;

  -- 체크는 오늘만
  update public.tasks set done_at = now() where id = t1;
  select count(*) into n from public.tasks where id = t1 and done_at is not null;
  if n <> 1 then raise exception 'FAIL 오늘 체크 안 됨'; end if;
  update public.tasks set done_at = now() where id = t2;
  select count(*) into n from public.tasks where id = t2 and done_at is not null;
  if n <> 0 then raise exception 'FAIL 내일 할 일이 체크됨'; end if;
  -- 이름 등은 못 고친다
  begin
    update public.tasks set name = '바뀜' where id = t1;
    raise exception 'FAIL 할 일 이름이 바뀜';
  exception when insufficient_privilege then null; end;

  -- 예약 할 일: 10분 단위, 끝 > 시작
  insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time, alarm)
    values (today, 'direct', '치과', kw, true, '15:00', '16:00', true);
  begin
    insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time) values (today, 'direct', '이상한 시각', kw, true, '15:05', '16:00');
    raise exception 'FAIL 10분 단위가 아닌 예약';
  exception when check_violation then null; end;

  -- 반복·자동 배정 할 일은 필요할 때 행을 만든다 (같은 날 하나)
  insert into public.tasks (date, source, practice_id, done_at) values (today, 'auto', p_once, now()) returning id into t3;
  begin
    insert into public.tasks (date, source, practice_id) values (today, 'auto', p_once);
    raise exception 'FAIL 같은 날 같은 실천 할 일이 둘';
  exception when unique_violation then null; end;
  -- 넘어온 일은 오늘만, 처음 날짜는 그 전
  begin
    insert into public.tasks (date, source, practice_id, carried_from_date) values (today + 1, 'repeat', p_rep, today);
    raise exception 'FAIL 내일로 넘어온 일';
  exception when insufficient_privilege then null; end;

  -- 직접 추가 삭제: 오늘·내일 (기획 결정)
  delete from public.tasks where id = t2;
  select count(*) into n from public.tasks where id = t2;
  if n <> 0 then raise exception 'FAIL 내일 할 일 삭제 안 됨'; end if;

  -- ── 시간표 ──
  perform public.save_day_blocks(today, 'plan', jsonb_build_array(
    jsonb_build_object('start', 12, 'end', 17, 'task_id', t3, 'key', 'p1'),
    jsonb_build_object('start', 54, 'end', 59, 'label', '장보기', 'key', 'p2'),
    jsonb_build_object('start', 60, 'end', 61, 'key', 'p3')));
  perform public.save_day_blocks(today, 'actual', jsonb_build_array(
    jsonb_build_object('start', 12, 'end', 15, 'task_id', t3),
    jsonb_build_object('start', 16, 'end', 18, 'keyword_id', kw)));
  perform public.save_day_blocks(today + 1, 'plan', jsonb_build_array(jsonb_build_object('start', 0, 'end', 5, 'keyword_id', kw)));
  select count(*) into n from public.time_blocks;
  if n <> 6 then raise exception 'FAIL 블록 수: %', n; end if;
  -- 다시 저장하면 통째로 바뀐다
  perform public.save_day_blocks(today, 'actual', jsonb_build_array(jsonb_build_object('start', 20, 'end', 25, 'task_id', t3)));
  select count(*) into n from public.time_blocks where layer = 'actual';
  if n <> 1 then raise exception 'FAIL 실제 층 다시 저장: %', n; end if;
  -- 실제 칠하기는 오늘만, 계획은 오늘·내일만
  begin
    perform public.save_day_blocks(today + 1, 'actual', jsonb_build_array(jsonb_build_object('start', 0, 'end', 1, 'keyword_id', kw)));
    raise exception 'FAIL 내일 실제 칠하기';
  exception when raise_exception then if sqlerrm <> 'day_locked' then raise; end if; end;
  begin
    perform public.save_day_blocks(today - 1, 'plan', '[]'::jsonb);
    raise exception 'FAIL 어제 계획 바꾸기';
  exception when raise_exception then if sqlerrm <> 'day_locked' then raise; end if; end;
  begin
    perform public.save_day_blocks(today + 2, 'plan', '[]'::jsonb);
    raise exception 'FAIL 모레 계획 그리기';
  exception when raise_exception then if sqlerrm <> 'day_locked' then raise; end if; end;
  -- 함수를 거치지 않고 지난 날 블록 넣기
  begin
    insert into public.time_blocks (date, layer, start_slot, end_slot, daily_keyword_id) values (today - 1, 'actual', 0, 1, kw);
    raise exception 'FAIL 어제 블록 직접 추가';
  exception when insufficient_privilege then null; end;
  -- 겹침 금지, 실제는 할 일·키워드 중 하나 필수, 자유 키워드는 계획만
  begin
    insert into public.time_blocks (date, layer, start_slot, end_slot, label) values (today, 'plan', 13, 14, '겹침');
    raise exception 'FAIL 계획 블록 겹침';
  exception when exclusion_violation then null; end;
  begin
    insert into public.time_blocks (date, layer, start_slot, end_slot, label) values (today, 'actual', 100, 101, '자유');
    raise exception 'FAIL 실제 층 자유 키워드';
  exception when check_violation then null; end;
  -- 실제는 지금 칸(+1 여유)까지만 (2026-10-03 UT)
  begin
    perform public.save_day_blocks(today, 'actual', jsonb_build_array(jsonb_build_object('start', 20, 'end', public.user_now_slot() + 3, 'task_id', t3)));
    raise exception 'FAIL 아직 오지 않은 시간 칠하기';
  exception when raise_exception then if sqlerrm <> 'future_time' then raise; end if; end;
  begin
    insert into public.time_blocks (date, layer, start_slot, end_slot, task_id) values (today, 'actual', public.user_now_slot() + 2, public.user_now_slot() + 2, t3);
    raise exception 'FAIL 아직 오지 않은 시간 직접 추가';
  exception when insufficient_privilege then null; end;
  perform public.save_day_blocks(today, 'actual', jsonb_build_array(jsonb_build_object('start', 20, 'end', 25, 'task_id', t3)));

  -- ── 하루 기록: 오늘만 ──
  insert into public.day_journals (date, score, reason, thanks) values (today, 4, '단어를 다 외웠다', array['친구', '', '']);
  update public.day_journals set memo = '메모' where date = today;
  begin
    insert into public.day_journals (date, score) values (today + 1, 5);
    raise exception 'FAIL 내일 하루 기록';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.day_journals (date, score) values (today - 1, 5);
    raise exception 'FAIL 어제 하루 기록';
  exception when insufficient_privilege then null; end;

  -- ── 키워드: 지우지 않고 보관 ──
  begin
    delete from public.daily_keywords where id = kw;
    raise exception 'FAIL 키워드를 지움';
  exception when insufficient_privilege then null; end;
  update public.daily_keywords set archived = true where name = '휴식';
  select count(*) into n from public.daily_keywords where archived;
  if n <> 1 then raise exception 'FAIL 키워드 보관'; end if;
end $$;

-- ── 지난 날 기록은 바꿀 수 없다 (R-D2): 관리자가 어제 날짜로 만들어 둔 기록 ──
reset role;
insert into public.tasks (user_id, date, source, name, daily_keyword_id)
  select 'a0000000-0000-0000-0000-00000000000a', d.today - 1, 'direct', '어제 할 일', k.id from d, public.daily_keywords k where k.user_id = 'a0000000-0000-0000-0000-00000000000a' and k.name = '업무';
insert into public.time_blocks (user_id, date, layer, start_slot, end_slot, daily_keyword_id)
  select 'a0000000-0000-0000-0000-00000000000a', d.today - 1, 'actual', 0, 5, k.id from d, public.daily_keywords k where k.user_id = 'a0000000-0000-0000-0000-00000000000a' and k.name = '업무';
insert into public.day_journals (user_id, date, score, reason) select 'a0000000-0000-0000-0000-00000000000a', d.today - 1, 2, '어제' from d;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.tasks set done_at = now() where name = '어제 할 일';
  delete from public.tasks where name = '어제 할 일';
  delete from public.time_blocks where date < (select today from d);
  update public.day_journals set score = 5, reason = '바뀜' where date < (select today from d);
  select (select count(*) from public.tasks where name = '어제 할 일' and done_at is null)
       + (select count(*) from public.time_blocks where date < (select today from d))
       + (select count(*) from public.day_journals where reason = '어제') into n;
  if n <> 3 then raise exception 'FAIL 지난 날 기록이 바뀜: %', n; end if;
end $$;

-- ── B: A의 기록은 안 보이고, A의 실천·키워드를 가리킬 수 없다 ──
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select (select count(*) from public.tasks) + (select count(*) from public.time_blocks) + (select count(*) from public.day_journals) into n;
  if n <> 0 then raise exception 'FAIL B가 A 기록을 봄: %', n; end if;
  begin
    insert into public.tasks (date, source, name, daily_keyword_id)
      values ((select today from d), 'direct', '해킹', (select id from public.daily_keywords k where k.user_id = 'a0000000-0000-0000-0000-00000000000a' limit 1));
    raise exception 'FAIL B가 A 키워드로 할 일';
  exception when insufficient_privilege or not_null_violation or check_violation then null; end;
  delete from public.tasks;
  begin
    delete from public.day_journals;
    raise exception 'FAIL 하루 기록 삭제 권한';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.tasks where user_id = 'a0000000-0000-0000-0000-00000000000a';
  if n < 4 then raise exception 'FAIL B가 A 할 일을 지움: %', n; end if;
end $$;

-- ── R-D1 날짜 경계와 알람 (관리자 시점) ──
do $$
declare A uuid := 'a0000000-0000-0000-0000-00000000000a'; d0 date; n int; ok boolean; kw uuid; st time; tid uuid;
begin
  -- 이 부분은 서울 시간 기준으로 본다 (위에서 바꾼 테스트용 시간대를 되돌림)
  update public.profiles set timezone = 'Asia/Seoul' where id = A;
  -- 05시 시작: 10.2 새벽 1시는 아직 10.1
  if public.user_day_at(A, '2026-10-02 01:00+09') <> '2026-10-01' then raise exception 'FAIL 새벽 1시가 전날이 아님'; end if;
  if public.user_day_at(A, '2026-10-02 05:00+09') <> '2026-10-02' then raise exception 'FAIL 05시부터 새 날'; end if;
  -- 새벽 시각 예약은 달력으로 다음 날 울린다
  select id into kw from public.daily_keywords where user_id = A and name = '업무';
  insert into public.tasks (user_id, date, source, name, daily_keyword_id, is_timed, start_time, end_time, alarm)
    values (A, '2026-10-01', 'direct', '새벽 예약', kw, true, '01:00', '01:30', true) returning id into tid;
  select public.task_alarm_at(t) = '2026-10-02 01:00+09'::timestamptz into ok from public.tasks t where id = tid;
  if ok is distinct from true then raise exception 'FAIL 새벽 예약 알람 시각'; end if;
  -- 지금 시각 예약 → 한 번만 골라진다
  d0 := public.user_day_at(A, now());
  st := date_trunc('hour', (now() at time zone 'Asia/Seoul')::time) + make_interval(mins => (extract(minute from (now() at time zone 'Asia/Seoul'))::int / 10) * 10);
  if st >= '23:50' then st := '23:40'; end if;
  insert into public.tasks (user_id, date, source, name, daily_keyword_id, is_timed, start_time, end_time, alarm)
    values (A, d0, 'direct', '지금 예약', kw, true, st, st + interval '10 minutes', true) returning id into tid;
  select count(*) into n from public.claim_due_alarms() c where c.task_id = tid;
  if n <> 1 then raise exception 'FAIL 지금 예약 알람이 안 골라짐'; end if;
  select count(*) into n from public.claim_due_alarms() c where c.task_id = tid;
  if n <> 0 then raise exception 'FAIL 알람이 두 번 골라짐'; end if;
end $$;

-- 알람 고르기는 사용자가 부를 수 없다
set local role authenticated;
do $$
begin
  perform public.claim_due_alarms();
  raise exception 'FAIL 사용자가 알람 고르기를 부름';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ── 계정 삭제: 기록도 함께 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
do $$
declare n int;
begin
  select (select count(*) from public.tasks where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.time_blocks where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.day_journals where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.daily_keywords where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 0 then raise exception 'FAIL 계정 삭제 후 남은 행: %', n; end if;
end $$;

select 'M4 DB 테스트 통과' as result;
rollback;
