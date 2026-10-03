-- UT 5·8·9 DB 규칙 (2026-10-03): 실천 시간·알람, 직접 추가 ↔ 세부목표, 새 목표 표에 기본
-- 실행: scripts/db.sh supabase/tests/ut_time_link.sql → 'UT 5·8·9 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"이다라"}');
-- 실제 칠하기가 '지금'에 묶여 있어 테스트 사용자의 지금을 그날 22시쯤으로
update public.profiles set timezone = (
  select case when o > 0 then 'Etc/GMT-' || o when o < 0 then 'Etc/GMT+' || -o else 'UTC' end
  from (select ((22 - extract(hour from now() at time zone 'UTC')::int + 36) % 24) - 12 as o) x)
where id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding('student', array['건강'], 'purple', null);
do $$
declare g uuid;
begin
  insert into public.goals (category_id, name, due_month) select id, 'B 목표', '2030-01-01' from public.categories where kind = 'goal' returning id into g;
  insert into public.subgoals (goal_id, name) values (g, 'B 세부');
end $$;
reset role;
create temp table bsub on commit drop as select id from public.subgoals where user_id = 'b0000000-0000-0000-0000-00000000000b';
grant select on bsub to authenticated;

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding('student', array['어학'], 'purple', null);

do $$
declare n int; today date := public.user_today(); g uuid; g2 uuid; s uuid; s2 uuid; kw uuid; t1 uuid; t2 uuid; j jsonb; hidden boolean;
begin
  -- ── 8. 새 목표는 표에 올린 채로 ──
  insert into public.goals (category_id, name, due_month) select id, '토익', '2030-01-01' from public.categories where kind = 'goal' returning id, table_hidden into g, hidden;
  if hidden then raise exception 'FAIL 새 목표가 표에 숨겨져 있음'; end if;
  insert into public.subgoals (goal_id, name) values (g, 'LC') returning id into s;
  select id into kw from public.daily_keywords where name = '생활';

  -- ── 5. 실천 시간 ──
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays, start_time, end_time)
    values (g, s, public.sunday_of(today) + 7, '시간 있는 실천', '{1}', '19:00', '20:00');
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays)
    values (g, s, public.sunday_of(today) + 7, '시간 없는 실천', '{2}');
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays, start_time, end_time) values (g, s, public.sunday_of(today) + 7, 'x', '{3}', '19:00', '18:00');
    raise exception 'FAIL 끝이 시작보다 이른 실천 시간';
  exception when check_violation then null; end;
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays, start_time, end_time) values (g, s, public.sunday_of(today) + 7, 'x', '{3}', '19:05', '20:00');
    raise exception 'FAIL 10분 단위가 아닌 실천 시간';
  exception when check_violation then null; end;
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays, start_time) values (g, s, public.sunday_of(today) + 7, 'x', '{3}', '19:00');
    raise exception 'FAIL 시작만 있는 실천 시간';
  exception when check_violation then null; end;

  -- 시간을 정한 실천은 그 목표의 계획 시간 (다음 주 월 19~20시 = 6칸)
  j := public.tracking_summary(public.sunday_of(today) + 7, public.sunday_of(today) + 13);
  if (j ->> 'planned')::int <> 6 or (j -> 'goals' -> 0 ->> 'planned')::int <> 6 then raise exception 'FAIL 실천 시간이 계획에: %', j; end if;

  -- ── 9. 직접 추가 ↔ 세부목표 ──
  insert into public.goals (category_id, name, due_month) select id, '아직 시작 전', '2030-01-01' from public.categories where kind = 'goal' returning id into g2;
  insert into public.subgoals (goal_id, name) values (g2, '첫 세부') returning id into s2;
  insert into public.tasks (date, source, name, subgoal_id) values (today, 'direct', '기출 1회', s2) returning id into t1;
  select count(*) into n from public.goals where id = g2 and status = 'in_progress';
  if n <> 1 then raise exception 'FAIL 목표에 연결한 할 일을 만들어도 진행 중이 아님'; end if;
  begin
    insert into public.tasks (date, source, name, subgoal_id, daily_keyword_id) values (today, 'direct', '둘 다', s2, kw);
    raise exception 'FAIL 키워드와 세부목표를 둘 다';
  exception when check_violation then null; end;
  begin
    insert into public.tasks (date, source, name) values (today, 'direct', '아무것도');
    raise exception 'FAIL 키워드도 세부목표도 없음';
  exception when check_violation then null; end;
  begin
    insert into public.tasks (date, source, name, subgoal_id) select today, 'direct', '남의 세부', id from bsub;
    raise exception 'FAIL 남의 세부목표에 연결';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks (date, source, practice_id, subgoal_id) select today, 'repeat', id, s from public.practices limit 1;
    raise exception 'FAIL 실천 할 일에 세부목표';
  exception when check_violation then null; end;
  -- 칠한 시간이 그 목표에 쌓인다
  perform public.save_day_blocks(today, 'actual', jsonb_build_array(jsonb_build_object('start', 10, 'end', 15, 'task_id', t1), jsonb_build_object('start', 20, 'end', 21, 'keyword_id', kw)));
  update public.tasks set done_at = now() where id = t1;
  j := public.tracking_summary(today, today);
  if (j ->> 'actual')::int <> 8 then raise exception 'FAIL 전체 실제: %', j; end if;
  if jsonb_array_length(j -> 'goals') <> 1 or (j -> 'goals' -> 0 ->> 'goal_id')::uuid <> g2 or (j -> 'goals' -> 0 ->> 'actual')::int <> 6 then raise exception 'FAIL 목표별 실제: %', j; end if;
  select count(*) into n from public.goal_totals() where goal_id = g2 and actual_slots = 6 and done_tasks = 1 and first_day = today;
  if n <> 1 then raise exception 'FAIL 목표 누적'; end if;
  -- 기록에 쓰인 세부목표는 지울 수 없다
  begin
    delete from public.subgoals where id = s2;
    raise exception 'FAIL 기록에 쓰인 세부목표 삭제';
  exception when foreign_key_violation then null; end;
end $$;

-- 넘어온 직접 추가도 처음 행의 세부목표를 따른다 (어제 행은 관리자 권한으로)
reset role;
do $$
declare A uuid := 'a0000000-0000-0000-0000-00000000000a'; today date; s uuid; o uuid;
begin
  select public.user_day_at(A, now()) into today;
  select id into s from public.subgoals where user_id = A and name = 'LC';
  insert into public.tasks (user_id, date, source, name, subgoal_id) values (A, today - 1, 'direct', '어제 못 한 일', s) returning id into o;
  perform set_config('app.carried', o::text, true);
end $$;
set local role authenticated;
do $$
declare today date := public.user_today(); c uuid; g uuid; j jsonb;
begin
  insert into public.tasks (date, source, carried_task_id, carried_from_date) values (today, 'direct', current_setting('app.carried')::uuid, today - 1) returning id into c;
  perform public.save_day_blocks(today, 'actual', jsonb_build_array(jsonb_build_object('start', 30, 'end', 32, 'task_id', c)));
  select id into g from public.goals where name = '토익';
  j := public.tracking_summary(today, today);
  if not exists (select 1 from jsonb_array_elements(j -> 'goals') e where (e ->> 'goal_id')::uuid = g and (e ->> 'actual')::int = 3) then raise exception 'FAIL 넘어온 할 일의 목표: %', j; end if;
end $$;

-- ── 5. 실천 알람 (관리자 시점) ──
reset role;
do $$
declare A uuid := 'a0000000-0000-0000-0000-00000000000a'; g uuid; s uuid; d date; st time; n int; tz text; ds int;
begin
  update public.profiles set timezone = 'Asia/Seoul' where id = A;
  select timezone, day_start_hour into tz, ds from public.profiles where id = A;
  d := public.user_day_at(A, now());
  st := date_trunc('hour', (now() at time zone tz)::time) + make_interval(mins => (extract(minute from (now() at time zone tz))::int / 10) * 10);
  if st >= '23:50' then return; end if;  -- 끝 시각이 다음 날로 넘어가는 경우는 건너뜀
  select id into g from public.goals where user_id = A and name = '토익';
  select id into s from public.subgoals where goal_id = g;
  insert into public.practices (user_id, goal_id, subgoal_id, week_start_date, name, weekdays, start_time, end_time)
    values (A, g, s, d - extract(dow from d)::int, '지금 알람 실천', array[extract(isodow from d)::smallint], st, st + interval '10 minutes');
  select count(*) into n from public.claim_due_alarms() c where c.user_id = A and c.name = '지금 알람 실천';
  if n <> 1 then raise exception 'FAIL 실천 알람이 안 골라짐 (st %, d %)', st, d; end if;
  select count(*) into n from public.tasks t join public.practices p on p.id = t.practice_id where p.name = '지금 알람 실천' and t.alarm_sent_at is not null and t.date = d;
  if n <> 1 then raise exception 'FAIL 알람 보낸 실천 할 일 행'; end if;
  select count(*) into n from public.claim_due_alarms() c where c.user_id = A;
  if n <> 0 then raise exception 'FAIL 실천 알람이 두 번'; end if;
end $$;

select 'UT 5·8·9 DB 테스트 통과' as result;
rollback;
