-- M3 DB 규칙 테스트. 한 트랜잭션에서 돌리고 마지막에 되돌린다. 날짜는 모두 "오늘" 기준으로 계산.
-- 실행: scripts/db.sh supabase/tests/m3_plans.sql  → 'M3 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"이다라"}');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 날짜 기준점 (사용자 기준 오늘)
create temp table d on commit drop as
select t as today,
       public.sunday_of(t) as sun,                                   -- 이번 주 일요일
       date_trunc('month', t)::date as this_m,                        -- 이번 달 1일
       (date_trunc('year', t) + interval '1 year')::date as ny        -- 내년 1월 1일
from (select public.user_today() as t) x;
grant select on d to authenticated;

set local role authenticated;
select public.complete_onboarding('student', array['어학', '건강'], 'purple', null);

do $$
declare n int; t text; lang uuid; g uuid; g2 uuid; s_lc uuid; s_rc uuid; s_other uuid; c uuid; p uuid; p2 uuid;
  today date; sun date; this_m date; ny date; ny_feb date; ny_mar date;
begin
  select d.today, d.sun, d.this_m, d.ny into today, sun, this_m, ny from d;
  ny_feb := (ny + interval '1 month')::date; ny_mar := (ny + interval '2 month')::date;

  -- 한 주 시작은 일요일 고정
  select week_start into t from public.profiles;
  if t <> 'sun' then raise exception 'FAIL 한 주 시작: %', t; end if;
  begin
    update public.profiles set week_start = 'mon';
    raise exception 'FAIL 한 주 시작을 바꿈';
  exception when insufficient_privilege then null; end;

  select id into lang from public.categories where name = '어학';
  insert into public.goals (category_id, name, due_month) values (lang, '토익 850', ny_mar) returning id into g;
  insert into public.goals (category_id, name, due_month) values (lang, '영어 회화', ny_mar) returning id into g2;
  insert into public.subgoals (goal_id, name) values (g, 'LC') returning id into s_lc;
  insert into public.subgoals (goal_id, name) values (g, 'RC') returning id into s_rc;
  insert into public.subgoals (goal_id, name) values (g2, '쉐도잉') returning id into s_other;
  update public.goals set table_hidden = false, table_position = 0 where id = g;

  -- 연간 표 (내년): 넣기·병합(R-P2), 겹침 금지(R-P1)
  insert into public.year_cells (goal_id, subgoal_id, start_month, end_month, memo) values (g, s_lc, ny, ny_feb, 'LC 집중') returning id into c;
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, ny_feb, ny_mar);
    raise exception 'FAIL 연간 칸이 겹침';
  exception when exclusion_violation then null; end;
  insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, ny_mar, ny_mar);
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, (ny + interval '11 month')::date, (ny + interval '12 month')::date);
    raise exception 'FAIL 해를 넘는 칸';
  exception when check_violation then null; end;
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_other, (ny + interval '5 month')::date, (ny + interval '5 month')::date);
    raise exception 'FAIL 다른 목표의 세부목표가 들어감';
  exception when foreign_key_violation then null; end;

  -- 잠금: 지난달 칸은 못 넣는다, 이번 달은 된다
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g, s_rc, (this_m - interval '1 month')::date, (this_m - interval '1 month')::date);
    raise exception 'FAIL 지난달 연간 칸이 생김';
  exception when insufficient_privilege or check_violation then null; end;
  insert into public.year_cells (goal_id, subgoal_id, start_month, end_month) values (g2, s_other, this_m, this_m);

  -- 월간 표 (내년 1월): R-P4 연간과 따로
  insert into public.month_cells (goal_id, subgoal_id, year_month, start_week, end_week, comment) values (g, s_rc, ny, 0, 1, 'RC 먼저');
  begin
    insert into public.month_cells (goal_id, subgoal_id, year_month, start_week, end_week) values (g, s_lc, ny, 1, 2);
    raise exception 'FAIL 월간 칸이 겹침';
  exception when exclusion_violation then null; end;
  select memo into t from public.year_cells where id = c;
  if t <> 'LC 집중' then raise exception 'FAIL 월간이 연간을 바꿈'; end if;
  -- 잠금: 지난달 월간 칸
  begin
    insert into public.month_cells (goal_id, subgoal_id, year_month, start_week, end_week) values (g, s_lc, (this_m - interval '1 month')::date, 0, 0);
    raise exception 'FAIL 지난달 월간 칸이 생김';
  exception when insufficient_privilege then null; end;

  -- 참고사항: 다음 주는 되고, 지난주는 안 된다. 일요일이 아닌 주 시작은 거절
  insert into public.notes (scope, period_key, start_index, end_index, text) values ('week', sun + 7, 0, 4, '출근 9–6');
  begin
    insert into public.notes (scope, period_key, start_index, end_index, text) values ('week', sun + 7, 4, 5, '겹침');
    raise exception 'FAIL 참고사항이 겹침';
  exception when exclusion_violation then null; end;
  begin
    insert into public.notes (scope, period_key, start_index, end_index, text) values ('week', sun - 7, 0, 0, '지난주');
    raise exception 'FAIL 지난주 참고사항이 생김';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.notes (scope, period_key, start_index, end_index, text) values ('week', sun + 8, 0, 0, '월요일 시작');
    raise exception 'FAIL 일요일이 아닌 주';
  exception when check_violation then null; end;

  -- R-G9: 배치된 세부목표는 삭제 불가
  begin
    delete from public.subgoals where id = s_lc;
    raise exception 'FAIL 배치된 세부목표가 지워짐';
  exception when foreign_key_violation then null; end;

  -- 실천: 요일 검사
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, sun + 7, '빈 요일', '{}');
    raise exception 'FAIL 요일 없는 실천';
  exception when check_violation or insufficient_privilege then null; end;
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, sun + 7, '중복 요일', '{1,1}');
    raise exception 'FAIL 중복 요일';
  exception when check_violation then null; end;

  -- 잠금: 지난주 실천, 어제가 들어간 실천은 못 넣는다. 오늘은 된다
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, sun - 7, '지난주', '{3}');
    raise exception 'FAIL 지난주 실천이 생김';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays)
      values (g, s_lc, public.sunday_of(today - 1), '어제', array[extract(isodow from today - 1)::smallint]);
    raise exception 'FAIL 어제 실천이 생김';
  exception when insufficient_privilege then null; end;

  -- R-G4: 시작 전 목표를 지우면 칸도 함께 지워진다
  delete from public.goals where id = g2;
  select count(*) into n from public.year_cells where goal_id = g2;
  if n <> 0 then raise exception 'FAIL 목표 삭제 후 칸이 남음'; end if;

  -- R-G3: 실천을 처음 놓으면 진행 중 (오늘 + 다음 주)
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, kind, weekdays)
    values (g, s_lc, sun, '오늘 단어', 'repeat', array[extract(isodow from today)::smallint]) returning id into p;
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_rc, sun + 7, 'Part 5', '{4}') returning id into p2;
  select status into t from public.goals where id = g;
  if t <> 'in_progress' then raise exception 'FAIL 실천 배치 후 상태: %', t; end if;
  delete from public.goals where id = g;
  select count(*) into n from public.goals where id = g;
  if n <> 1 then raise exception 'FAIL 진행 중 목표가 지워짐'; end if;

  -- 실천 하나 지워도 진행 중, 모두 지우면 시작 전
  delete from public.practices where id = p2;
  select status into t from public.goals where id = g;
  if t <> 'in_progress' then raise exception 'FAIL 하나 지운 뒤 상태: %', t; end if;
  delete from public.practices where id = p;
  select status into t from public.goals where id = g;
  if t <> 'not_started' then raise exception 'FAIL 모두 지운 뒤 상태: %', t; end if;

  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays) values (g, s_lc, sun + 7, 'Part 1', '{1}');
end $$;

-- ── 지난 기록은 사용자가 못 고친다 (관리자가 과거 날짜로 만들어 둔 것) ──
reset role;
insert into public.year_cells (user_id, goal_id, subgoal_id, start_month, end_month, memo)
  select 'a0000000-0000-0000-0000-00000000000a', g.id, s.id, (d.this_m - interval '1 month')::date, d.this_m, '지난달부터'
  from public.goals g join public.subgoals s on s.goal_id = g.id and s.name = 'RC', d where g.name = '토익 850';
insert into public.notes (user_id, scope, period_key, start_index, end_index, text)
  select 'a0000000-0000-0000-0000-00000000000a', 'week', d.sun - 7, 0, 0, '지난주 메모' from d;
insert into public.practices (user_id, goal_id, subgoal_id, week_start_date, name, weekdays)
  select 'a0000000-0000-0000-0000-00000000000a', g.id, s.id, d.sun - 7, '지난주 실천', '{3}'
  from public.goals g join public.subgoals s on s.goal_id = g.id and s.name = 'LC', d where g.name = '토익 850';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.year_cells set memo = '바뀜' where memo = '지난달부터';
  delete from public.year_cells where memo = '지난달부터';
  update public.notes set text = '바뀜' where text = '지난주 메모';
  delete from public.notes where text = '지난주 메모';
  delete from public.practices where name = '지난주 실천';
  select (select count(*) from public.year_cells where memo = '지난달부터')
       + (select count(*) from public.notes where text = '지난주 메모')
       + (select count(*) from public.practices where name = '지난주 실천') into n;
  if n <> 3 then raise exception 'FAIL 지난 계획이 바뀌거나 지워짐: %', n; end if;
  -- 지난 날짜로 옮기기도 못 한다
  begin
    update public.year_cells set start_month = (select this_m - interval '1 month' from d)::date where memo = 'LC 집중';
    if found then raise exception 'FAIL 칸을 지난달로 옮김'; end if;
  exception when insufficient_privilege or exclusion_violation or check_violation then null; end;
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
      select g.id, s.id, d.ny + interval '8 month', d.ny + interval '8 month' from public.goals g join public.subgoals s on s.goal_id = g.id, d where g.name = '토익 850' limit 1;
    raise exception 'FAIL 마무리한 목표에 연간 칸 추가';
  exception when insufficient_privilege then null; end;
  delete from public.practices where name = 'Part 1';
  select count(*) into n from public.practices where name = 'Part 1';
  if n <> 1 then raise exception 'FAIL 마무리한 목표의 실천이 지워짐'; end if;
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
  begin
    insert into public.year_cells (goal_id, subgoal_id, start_month, end_month)
      values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', (select ny from d), (select ny from d));
    raise exception 'FAIL B가 남의 목표에 칸 추가';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.year_cells where memo = '해킹';
  if n <> 0 then raise exception 'FAIL B가 A 칸을 바꿈'; end if;
  select (select count(*) from public.notes where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.practices where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 4 then raise exception 'FAIL B가 A 계획을 지움: %', n; end if;
end $$;

-- ── 계정 삭제: 지난 기록까지 함께 지워진다 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
do $$
declare n int;
begin
  select (select count(*) from public.year_cells where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.month_cells where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.notes where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.practices where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.goals where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 0 then raise exception 'FAIL 계정 삭제 후 남은 행: %', n; end if;
end $$;

select 'M3 DB 테스트 통과' as result;
rollback;
