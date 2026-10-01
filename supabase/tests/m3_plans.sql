-- M3 DB 규칙 테스트. 한 트랜잭션에서 돌리고 마지막에 되돌린다.
-- 실행: scripts/db.sh supabase/tests/m3_plans.sql  → 'M3 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"이다라"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.complete_onboarding('student', array['어학', '건강'], 'purple', null);

do $$
declare n int; t text; lang uuid; g uuid; g2 uuid; s_lc uuid; s_rc uuid; s_other uuid; c uuid; p uuid; p2 uuid;
begin
  select id into lang from public.categories where name = '어학';
  insert into public.goals (category_id, name, due_month) values (lang, '토익 850', '2027-03-01') returning id into g;
  insert into public.goals (category_id, name, due_month) values (lang, '영어 회화', '2027-06-01') returning id into g2;
  insert into public.subgoals (goal_id, name) values (g, 'LC') returning id into s_lc;
  insert into public.subgoals (goal_id, name) values (g, 'RC') returning id into s_rc;
  insert into public.subgoals (goal_id, name) values (g2, '쉐도잉') returning id into s_other;

  -- 열 보이기·순서
  update public.goals set table_hidden = false, table_position = 0 where id = g;

  -- 연간 표: 칸 넣기, 병합(R-P2)
  insert into public.year_cells (goal_id, subgoal_id, start_month, end_month, memo) values (g, s_lc, '2027-01-01', '2027-02-01', 'LC 집중') returning id into c;
  -- R-P1: 같은 열에서 겹치면 거절
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, '2027-02-01', '2027-03-01');
    raise exception 'FAIL 연간 칸이 겹침';
  exception when exclusion_violation then null; end;
  begin
    update public.year_cells set end_month = '2027-05-01' where id = c;
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, '2027-04-01', '2027-04-01');
    raise exception 'FAIL 늘린 칸과 겹침';
  exception when exclusion_violation then null; end;
  insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, '2027-03-01', '2027-03-01');
  -- 해를 넘는 병합은 거절
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, '2027-12-01', '2028-01-01');
    raise exception 'FAIL 해를 넘는 칸';
  exception when check_violation then null; end;
  -- 다른 목표의 세부목표는 못 넣는다
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_other, '2027-06-01', '2027-06-01');
    raise exception 'FAIL 다른 목표의 세부목표가 들어감';
  exception when foreign_key_violation then null; end;

  -- 월간 표 (R-P4: 연간과 따로 저장)
  insert into public.month_cells (goal_id, subgoal_id, year_month, start_week, end_week, comment) values (g, s_rc, '2027-01-01', 0, 1, 'RC 먼저');
  begin
    insert into public.month_cells (goal_id, subgoal_id, year_month, start_week, end_week) values (g, s_lc, '2027-01-01', 1, 2);
    raise exception 'FAIL 월간 칸이 겹침';
  exception when exclusion_violation then null; end;
  select memo into t from public.year_cells where id = c;
  if t <> 'LC 집중' then raise exception 'FAIL 월간이 연간을 바꿈'; end if;

  -- 참고사항
  insert into public.notes (scope, period_key, start_index, end_index, text) values ('week', '2026-09-28', 0, 4, '출근 9–6');
  begin
    insert into public.notes (scope, period_key, start_index, end_index, text) values ('week', '2026-09-28', 4, 5, '겹침');
    raise exception 'FAIL 참고사항이 겹침';
  exception when exclusion_violation then null; end;

  -- R-G9: 계획 표에 배치된 세부목표는 삭제 불가
  begin
    delete from public.subgoals where id = s_lc;
    raise exception 'FAIL 배치된 세부목표가 지워짐';
  exception when foreign_key_violation then null; end;

  -- 실천: 요일 검사
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, '2026-09-28', '빈 요일', '{}');
    raise exception 'FAIL 요일 없는 실천';
  exception when check_violation then null; end;
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, '2026-09-28', '중복 요일', '{1,1}');
    raise exception 'FAIL 중복 요일';
  exception when check_violation then null; end;
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, '2026-09-28', '8요일', '{8}');
    raise exception 'FAIL 없는 요일';
  exception when check_violation then null; end;

  -- R-G3: 시작 전 목표를 지우면 연간·월간 칸도 함께 지워진다 (R-G4)
  insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g2, s_other, '2027-01-01', '2027-01-01');
  delete from public.goals where id = g2;
  select count(*) into n from public.year_cells where goal_id = g2;
  if n <> 0 then raise exception 'FAIL 목표 삭제 후 칸이 남음'; end if;

  -- R-G3: 실천을 처음 놓으면 진행 중
  select status into t from public.goals where id = g;
  if t <> 'not_started' then raise exception 'FAIL 처음 상태: %', t; end if;
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, kind, weekdays) values (g, s_lc, '2026-09-28', '매일 단어 40개', 'repeat', '{1,2,3,4,5,6,7}') returning id into p;
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_rc, '2026-09-28', 'Part 5', '{4}') returning id into p2;
  select status into t from public.goals where id = g;
  if t <> 'in_progress' then raise exception 'FAIL 실천 배치 후 상태: %', t; end if;
  select count(*) into n from public.goals where id = g and started_at is not null;
  if n <> 1 then raise exception 'FAIL started_at 없음'; end if;
  -- 진행 중이면 목표 삭제 불가 (R-G5)
  delete from public.goals where id = g;
  select count(*) into n from public.goals where id = g;
  if n <> 1 then raise exception 'FAIL 진행 중 목표가 지워짐'; end if;

  -- 실천을 하나 지워도 진행 중, 모두 지우면 다시 시작 전 (기획 결정)
  delete from public.practices where id = p;
  select status into t from public.goals where id = g;
  if t <> 'in_progress' then raise exception 'FAIL 실천 하나 지운 뒤 상태: %', t; end if;
  delete from public.practices where id = p2;
  select status into t from public.goals where id = g;
  if t <> 'not_started' then raise exception 'FAIL 실천 모두 지운 뒤 상태: %', t; end if;

  -- 다시 놓아 두기 (아래 B 테스트용)
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, '2026-09-28', 'Part 1', '{1}');
end $$;

-- ── 마무리한 목표에는 계획을 못 쓴다 (R-G7) ──
reset role;
update public.goals set status = 'completed' where name = '토익 850' and user_id = 'a0000000-0000-0000-0000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month)
      select g.id, s.id, '2027-08-01', '2027-08-01' from public.goals g join public.subgoals s on s.goal_id = g.id where g.name = '토익 850' limit 1;
    raise exception 'FAIL 마무리한 목표에 연간 칸 추가';
  exception when insufficient_privilege then null; end;
  delete from public.practices;
  select count(*) into n from public.practices;
  if n <> 1 then raise exception 'FAIL 마무리한 목표의 실천이 지워짐'; end if;
  update public.year_cells set memo = '바뀜';
  select count(*) into n from public.year_cells where memo = '바뀜';
  if n <> 0 then raise exception 'FAIL 마무리한 목표의 칸이 바뀜'; end if;
end $$;
reset role;
update public.goals set status = 'in_progress' where name = '토익 850' and user_id = 'a0000000-0000-0000-0000-00000000000a';

-- ── B: A의 계획은 안 보이고 못 건드린다 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select (select count(*) from public.year_cells) + (select count(*) from public.month_cells)
       + (select count(*) from public.notes) + (select count(*) from public.practices) into n;
  if n <> 0 then raise exception 'FAIL B가 A 계획을 봄: %', n; end if;
  update public.year_cells set memo = '해킹';
  delete from public.notes;
  delete from public.practices;
  -- A의 목표 id를 알아도 칸을 못 만든다
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month)
      values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2027-01-01', '2027-01-01');
    raise exception 'FAIL B가 남의 목표에 칸 추가';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare n int;
begin
  select (select count(*) from public.year_cells where memo = '해킹') into n;
  if n <> 0 then raise exception 'FAIL B가 A 칸을 바꿈'; end if;
  select (select count(*) from public.notes where user_id = 'a0000000-0000-0000-0000-00000000000a') + (select count(*) from public.practices where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 2 then raise exception 'FAIL B가 A 계획을 지움: %', n; end if;
end $$;

-- ── 계정 삭제: 계획도 함께 지워진다 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
do $$
declare n int;
begin
  select (select count(*) from public.year_cells where user_id = 'a0000000-0000-0000-0000-00000000000a') + (select count(*) from public.month_cells where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.notes where user_id = 'a0000000-0000-0000-0000-00000000000a') + (select count(*) from public.practices where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.goals where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 0 then raise exception 'FAIL 계정 삭제 후 남은 행: %', n; end if;
end $$;

select 'M3 DB 테스트 통과' as result;
rollback;
