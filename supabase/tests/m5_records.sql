-- M5 DB 규칙 테스트 (마무리·진척도·사진·트래킹 집계·회고 알림). 한 트랜잭션, 날짜는 "오늘" 기준, 마지막에 되돌림.
-- 실행: scripts/db.sh supabase/tests/m5_records.sql  → 'M5 DB 테스트 통과'
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
select public.complete_onboarding('student', array['어학', '건강'], 'purple', null);

do $$
declare n int; t text; j jsonb; today date; c uuid; g uuid; g2 uuid; g3 uuid; s uuid; p uuid; tk uuid; kw uuid; ttimed uuid;
begin
  select d.today into today from d;
  select id into c from public.categories where name = '어학';
  insert into public.goals (category_id, name, due_month) values (c, '토익 850', '2030-01-01') returning id into g;
  insert into public.goals (category_id, name, due_month) values (c, '회화', '2030-01-01') returning id into g2;
  insert into public.goals (category_id, name, due_month) values (c, '시작 전', '2030-01-01') returning id into g3;
  insert into public.subgoals (goal_id, name) values (g, 'LC') returning id into s;
  insert into public.subgoals (goal_id, name) select g2, '쉐도잉';
  -- 요일 수로 종류가 정해진다 (kind를 반복으로 보내도 요일 1개면 단발)
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, kind, weekdays)
    values (g, s, public.sunday_of(today), 'Part 1', 'repeat', array[extract(isodow from today)::smallint]) returning id into p;
  select kind into t from public.practices where id = p;
  if t <> 'once' then raise exception 'FAIL 요일 1개인데 종류: %', t; end if;
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, kind, weekdays)
    select g2, id, public.sunday_of(today) + 7, '쉐도잉', 'once', '{1,3,5}' from public.subgoals where name = '쉐도잉';
  select kind into t from public.practices where name = '쉐도잉';
  if t <> 'repeat' then raise exception 'FAIL 요일 여러 개인데 종류: %', t; end if;

  -- ── 트래킹 집계 (4.7, R-K1) ──
  select id into kw from public.daily_keywords where name = '휴식';
  insert into public.tasks (date, source, practice_id, done_at) values (today, 'auto', p, now()) returning id into tk;
  insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time, alarm) values (today, 'direct', '치과', kw, true, '15:00', '16:00', true) returning id into ttimed;
  perform public.save_day_blocks(today, 'plan', jsonb_build_array(
    jsonb_build_object('start', 0, 'end', 5, 'task_id', tk, 'key', 'a'),
    jsonb_build_object('start', 10, 'end', 12, 'keyword_id', kw, 'key', 'b'),
    jsonb_build_object('start', 20, 'end', 21, 'label', '장보기', 'key', 'c')));
  perform public.save_day_blocks(today, 'actual', jsonb_build_array(
    jsonb_build_object('start', 0, 'end', 3, 'task_id', tk),
    jsonb_build_object('start', 30, 'end', 34, 'keyword_id', kw)));
  j := public.tracking_summary(today - 6, today);
  -- 계획 = 6(할 일) + 3(키워드) + 2(자유 이름) + 6(예약 1시간) = 17칸, 실제 = 4 + 5 = 9칸
  if (j ->> 'planned')::int <> 17 then raise exception 'FAIL 전체 계획: %', j; end if;
  if (j ->> 'actual')::int <> 9 then raise exception 'FAIL 전체 실제: %', j; end if;
  -- 키워드만 적은 계획은 목표별 계획에 안 들어간다 (4.7-2)
  if (j ->> 'plan_unlinked')::int <> 11 then raise exception 'FAIL 목표에 안 붙은 계획: %', j; end if;
  if jsonb_array_length(j -> 'goals') <> 1 or (j -> 'goals' -> 0 ->> 'planned')::int <> 6 or (j -> 'goals' -> 0 ->> 'actual')::int <> 4 then raise exception 'FAIL 목표별: %', j; end if;
  -- 기간 밖은 안 센다
  j := public.tracking_summary(today + 1, today + 7);
  if (j ->> 'actual')::int <> 0 then raise exception 'FAIL 기간 밖: %', j; end if;
  -- 누적
  select actual_slots, done_tasks into n, n from public.goal_totals() where goal_id = g;
  select count(*) into n from public.goal_totals() where goal_id = g and actual_slots = 4 and done_tasks = 1 and first_day = today;
  if n <> 1 then raise exception 'FAIL 목표 누적'; end if;

  -- ── 진척도 ──
  insert into public.goal_progress (goal_id, percent) values (g, 30), (g, 45);
  begin
    insert into public.goal_progress (goal_id, percent) values (g, 120);
    raise exception 'FAIL 진척도 120';
  exception when check_violation then null; end;

  -- ── 마무리 (R-G5~G8) ──
  begin
    perform public.finish_goal(g3, 'completed', null, '', '', '');
    raise exception 'FAIL 시작 전 목표가 마무리됨';
  exception when raise_exception then if sqlerrm <> 'goal_not_in_progress' then raise; end if; end;
  begin
    perform public.finish_goal(g2, 'dropped', 'a0000000-0000-0000-0000-00000000000a/x.jpg', '', '', '');
    raise exception 'FAIL 중도 마무리에 사진';
  exception when raise_exception then if sqlerrm <> 'finish_photo_invalid' then raise; end if; end;
  begin
    perform public.finish_goal(g, 'completed', 'b0000000-0000-0000-0000-00000000000b/x.jpg', '', '', '');
    raise exception 'FAIL 남의 폴더 사진';
  exception when raise_exception then if sqlerrm <> 'finish_photo_invalid' then raise; end if; end;
  perform public.finish_goal(g, 'completed', 'a0000000-0000-0000-0000-00000000000a/toeic.jpg', ' 850 달성 ', '', '다음엔 RC 먼저');
  select count(*) into n from public.goals where id = g and status = 'completed' and finished_at is not null and table_hidden and retro_achieved = '850 달성' and retro_regret is null;
  if n <> 1 then raise exception 'FAIL 완성 저장'; end if;
  perform public.finish_goal(g2, 'dropped', null, '바빴다', '', '');
  -- R-G7: 다시 열 수 없다
  begin
    perform public.finish_goal(g, 'dropped', null, '', '', '');
    raise exception 'FAIL 마무리한 목표를 다시 마무리';
  exception when raise_exception then if sqlerrm <> 'goal_not_in_progress' then raise; end if; end;
  update public.goals set name = '바뀜' where id = g;
  select count(*) into n from public.goals where id = g and name = '토익 850';
  if n <> 1 then raise exception 'FAIL 마무리한 목표 이름이 바뀜'; end if;
  begin
    update public.goals set status = 'in_progress' where id = g;
    raise exception 'FAIL 상태를 직접 되돌림';
  exception when insufficient_privilege then null; end;
  -- 마무리한 목표에는 진척도를 못 남긴다
  begin
    insert into public.goal_progress (goal_id, percent) values (g, 100);
    raise exception 'FAIL 마무리한 목표 진척도';
  exception when insufficient_privilege then null; end;
end $$;

-- ── 회고 알림 (관리자 시점) ──
reset role;
do $$
declare A uuid := 'a0000000-0000-0000-0000-00000000000a'; B uuid := 'b0000000-0000-0000-0000-00000000000b'; n int; nowt time;
begin
  nowt := date_trunc('minute', (now() at time zone (select timezone from public.profiles where id = A))::time);
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (A, 'https://example.invalid/a', 'k', 'a'), (B, 'https://example.invalid/b', 'k', 'a');
  update public.profiles set review_notify_enabled = true, review_notify_time = nowt where id in (A, B);
  -- B는 오늘 하루 기록을 이미 썼다 → 안 보냄
  insert into public.day_journals (user_id, date, score) values (B, public.user_day_at(B, now()), 4);
  select count(*) into n from public.claim_due_reviews() r where r.user_id = A;
  if n <> 1 then raise exception 'FAIL 회고 알림이 안 골라짐'; end if;
  select count(*) into n from public.claim_due_reviews() r where r.user_id in (A, B);
  if n <> 0 then raise exception 'FAIL 회고 알림이 두 번 / 기록 쓴 사람에게'; end if;
end $$;

-- ── B: A의 기록·진척도는 안 보이고, A 목표에 진척도·마무리 못 함 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int; j jsonb;
begin
  select count(*) into n from public.goal_progress;
  if n <> 0 then raise exception 'FAIL B가 A 진척도를 봄'; end if;
  j := public.tracking_summary((select today from d) - 6, (select today from d));
  if (j ->> 'actual')::int <> 0 or jsonb_array_length(j -> 'goals') <> 0 then raise exception 'FAIL B 집계에 A 기록: %', j; end if;
  select count(*) into n from public.goal_totals();
  if n <> 0 then raise exception 'FAIL B 누적에 A 목표'; end if;
  begin
    insert into public.goal_progress (goal_id, percent) select id, 10 from public.goals limit 1;
    insert into public.goal_progress (goal_id, percent) values ('00000000-0000-0000-0000-000000000001', 10);
    raise exception 'FAIL B가 남의 목표에 진척도';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_due_reviews();
    raise exception 'FAIL 사용자가 회고 알림 고르기를 부름';
  exception when insufficient_privilege then null; end;
end $$;

select 'M5 DB 테스트 통과' as result;
rollback;
