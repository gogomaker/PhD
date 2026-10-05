-- 계획 칸에 세부목표 여러 개 (2026-10-05). 실행: scripts/db.sh supabase/tests/cell_multi_subgoals.sql → '칸 세부목표 DB 테스트 통과'
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding('student', array['건강', '어학'], 'purple', null);

do $$
declare g uuid; g2 uuid; s1 uuid; s2 uuid; s3 uuid; o1 uuid; c uuid; m uuid; y int := extract(year from public.user_today())::int + 1;
begin
  insert into public.goals (category_id, name, due_month) select id, '신앙 매일 지키기', '2030-01-01' from public.categories where name = '건강' returning id into g;
  insert into public.subgoals (goal_id, name) values (g, '기도') returning id into s1;
  insert into public.subgoals (goal_id, name) values (g, '성경') returning id into s2;
  insert into public.subgoals (goal_id, name) values (g, '묵상') returning id into s3;
  insert into public.goals (category_id, name, due_month) select id, '토익', '2030-01-01' from public.categories where name = '어학' returning id into g2;
  insert into public.subgoals (goal_id, name) values (g2, 'LC') returning id into o1;

  -- 한 칸에 세 개 (내년 1~12월, 지난 칸 잠금과 무관하게)
  insert into public.year_cells (goal_id, subgoal_id, extra_subgoal_ids, start_month, end_month)
    values (g, s1, array[s2, s3], make_date(y, 1, 1), make_date(y, 12, 1)) returning id into c;
  insert into public.month_cells (goal_id, subgoal_id, extra_subgoal_ids, year_month, start_week, end_week)
    values (g, s2, array[s3], make_date(y, 1, 1), 0, 3) returning id into m;

  -- 다른 목표의 세부목표, 겹침, 첫 세부목표와 같음 → 거절
  begin
    update public.year_cells set extra_subgoal_ids = array[s2, o1] where id = c;
    raise exception 'FAIL 다른 목표의 세부목표';
  exception when check_violation then null; end;
  begin
    update public.year_cells set extra_subgoal_ids = array[s2, s2] where id = c;
    raise exception 'FAIL 같은 세부목표 두 번';
  exception when check_violation then null; end;
  begin
    update public.year_cells set extra_subgoal_ids = array[s1] where id = c;
    raise exception 'FAIL 첫 세부목표와 같음';
  exception when check_violation then null; end;

  -- 칸에 들어 있는 세부목표는 지울 수 없다 (나머지 칸에 있어도)
  begin
    delete from public.subgoals where id = s3;
    raise exception 'FAIL 칸에 든 세부목표 삭제';
  exception when foreign_key_violation then null; end;

  -- 첫 세부목표를 빼면 다음 것이 첫 자리로 (화면이 하는 방식)
  update public.year_cells set subgoal_id = s2, extra_subgoal_ids = array[s3] where id = c;
  update public.month_cells set extra_subgoal_ids = '{}' where id = m;
  -- 이제 기도(s1)는 어디에도 없어 지울 수 있다
  delete from public.subgoals where id = s1;

  -- 목표째 지우면 칸도 함께 지워진다 (세부목표 막기에 걸리지 않음)
  delete from public.goals where id = g;
  if exists (select 1 from public.year_cells where id = c) then raise exception 'FAIL 목표 지워도 칸이 남음'; end if;
end $$;

select '칸 세부목표 DB 테스트 통과' as result;
rollback;
