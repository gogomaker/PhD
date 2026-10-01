-- M2 DB 규칙 테스트. 한 트랜잭션에서 돌리고 마지막에 되돌린다.
-- 실행: scripts/db.sh supabase/tests/m2_goals.sql  → 'M2 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"이다라"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.complete_onboarding('student', array['건강', '어학'], 'purple', null);

do $$
declare n int; t text; health uuid; lang uuid; daily uuid; g uuid; g2 uuid;
begin
  select id into health from public.categories where name = '건강';
  select id into lang from public.categories where name = '어학';
  select id into daily from public.categories where kind = 'daily';

  -- 목표 추가 (기한 필수)
  insert into public.goals (category_id, name, due_month) values (health, '체력 만들기', '2027-09-01') returning id into g;
  begin
    insert into public.goals (category_id, name) values (health, '기한 없음');
    raise exception 'FAIL 기한 없는 목표가 저장됨';
  exception when not_null_violation then null; end;
  begin
    insert into public.goals (category_id, name, due_month) values (health, '이상한 기한', '2027-09-15');
    raise exception 'FAIL 1일이 아닌 기한이 저장됨';
  exception when check_violation then null; end;

  -- R-C2: 일상 카테고리에는 목표를 못 단다
  begin
    insert into public.goals (category_id, name, due_month) values (daily, '일상 목표', '2027-01-01');
    raise exception 'FAIL 일상 카테고리에 목표가 생김';
  exception when raise_exception then
    if sqlerrm <> 'goal_category_invalid' then raise; end if;
  end;
  begin
    update public.goals set category_id = daily where id = g;
    raise exception 'FAIL 목표를 일상 카테고리로 옮김';
  exception when raise_exception then
    if sqlerrm <> 'goal_category_invalid' then raise; end if;
  end;

  -- 다른 목표 카테고리로 옮기기는 된다
  update public.goals set category_id = lang where id = g;
  update public.goals set category_id = health where id = g;

  -- 세부목표 (R-G1)
  insert into public.subgoals (goal_id, name, position) values (g, '매일 운동', 0), (g, '하프 마라톤', 1), (g, '식단', 2);
  perform public.reorder_subgoals(array(select id from public.subgoals where goal_id = g order by position desc));
  select string_agg(name, ',' order by position) into t from public.subgoals where goal_id = g;
  if t is distinct from '식단,하프 마라톤,매일 운동' then raise exception 'FAIL 세부목표 순서: %', t; end if;

  -- 사용자는 상태를 직접 못 바꾼다
  begin
    update public.goals set status = 'in_progress' where id = g;
    raise exception 'FAIL 상태를 직접 바꿈';
  exception when insufficient_privilege then null; end;

  -- 목표가 든 카테고리는 못 지운다 (기획 결정)
  begin
    delete from public.categories where id = health;
    raise exception 'FAIL 목표가 든 카테고리가 지워짐';
  exception when foreign_key_violation then null; end;

  -- R-G4: 시작 전 목표는 지울 수 있고, 세부목표도 함께 지워진다
  insert into public.goals (category_id, name, due_month) values (lang, '토익 850', '2027-03-01') returning id into g2;
  insert into public.subgoals (goal_id, name) values (g2, 'LC');
  delete from public.goals where id = g2;
  select count(*) into n from public.subgoals where goal_id = g2;
  if n <> 0 then raise exception 'FAIL 목표 삭제 후 세부목표가 남음'; end if;

  -- 목표가 없어진 카테고리는 지울 수 있다
  delete from public.categories where id = lang;
  select count(*) into n from public.categories where id = lang;
  if n <> 0 then raise exception 'FAIL 빈 카테고리 삭제 안 됨'; end if;
end $$;

-- ── 관리자 시점: 진행 중 / 마무리 상태를 만들어 본다 (M3·M5에서 서버가 바꾸는 값) ──
reset role;
update public.goals set status = 'in_progress', started_at = now() where name = '체력 만들기' and user_id = 'a0000000-0000-0000-0000-00000000000a';
insert into public.goals (user_id, category_id, name, due_month, status, finished_at)
  select 'a0000000-0000-0000-0000-00000000000a', id, '6시 기상', '2026-09-01', 'completed', now() from public.categories where name = '건강' and user_id = 'a0000000-0000-0000-0000-00000000000a';
insert into public.subgoals (user_id, goal_id, name)
  select 'a0000000-0000-0000-0000-00000000000a', id, '기상 기록' from public.goals where name = '6시 기상' and user_id = 'a0000000-0000-0000-0000-00000000000a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  -- R-G5: 진행 중 목표는 삭제 불가 (지워지지 않음)
  delete from public.goals where name = '체력 만들기';
  select count(*) into n from public.goals where name = '체력 만들기';
  if n <> 1 then raise exception 'FAIL 진행 중 목표가 삭제됨'; end if;
  -- 진행 중 목표는 고칠 수 있다
  update public.goals set name = '체력 만들기!' where name = '체력 만들기';
  select count(*) into n from public.goals where name = '체력 만들기!';
  if n <> 1 then raise exception 'FAIL 진행 중 목표 이름 바꾸기'; end if;

  -- R-G7: 마무리한 목표는 고치기·삭제·세부목표 변경 불가
  update public.goals set name = '바뀜' where name = '6시 기상';
  delete from public.goals where name = '6시 기상';
  select count(*) into n from public.goals where name = '6시 기상';
  if n <> 1 then raise exception 'FAIL 마무리한 목표가 바뀌거나 지워짐'; end if;
  update public.subgoals set name = '바뀜' where name = '기상 기록';
  delete from public.subgoals where name = '기상 기록';
  select count(*) into n from public.subgoals where name = '기상 기록';
  if n <> 1 then raise exception 'FAIL 마무리한 목표의 세부목표가 바뀜'; end if;
  begin
    insert into public.subgoals (goal_id, name) select id, '새 세부' from public.goals where name = '6시 기상';
    raise exception 'FAIL 마무리한 목표에 세부목표 추가';
  exception when insufficient_privilege then null; end;
end $$;

-- ── B: A의 목표는 안 보이고 못 건드린다 ──
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.goals;
  if n <> 0 then raise exception 'FAIL B가 A 목표를 봄'; end if;
  select count(*) into n from public.subgoals;
  if n <> 0 then raise exception 'FAIL B가 A 세부목표를 봄'; end if;
  update public.goals set name = '해킹';
  delete from public.subgoals;
  -- A의 카테고리에 목표 달기 시도
  begin
    insert into public.goals (category_id, name, due_month)
      values ((select id from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a' limit 1), '해킹', '2027-01-01');
    raise exception 'FAIL B가 A 카테고리에 목표 추가';
  exception when not_null_violation or raise_exception then null; end;
  -- A의 목표에 세부목표 달기 시도
  begin
    insert into public.subgoals (goal_id, name) values ((select id from public.goals limit 1), '해킹');
    raise exception 'FAIL B가 A 목표에 세부목표 추가';
  exception when not_null_violation or insufficient_privilege then null; end;
end $$;

reset role;
do $$
declare n int;
begin
  select count(*) into n from public.goals where name = '해킹';
  if n <> 0 then raise exception 'FAIL B가 A 목표를 바꿈'; end if;
  select count(*) into n from public.subgoals where user_id = 'a0000000-0000-0000-0000-00000000000a';
  if n <> 4 then raise exception 'FAIL A 세부목표 수: %', n; end if;
end $$;

-- ── 계정 삭제: 목표가 있어도 함께 지워진다 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
do $$
declare n int;
begin
  select (select count(*) from public.goals where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.subgoals where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 0 then raise exception 'FAIL 계정 삭제 후 남은 행: %', n; end if;
end $$;

select 'M2 DB 테스트 통과' as result;
rollback;
