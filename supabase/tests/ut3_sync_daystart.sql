-- UT 3차 DB 규칙 (2026-10-03): 두 기기 덮어쓰기 막기, 하루 시작 시각 바꾸기, 자정을 넘는 시간
-- 실행: scripts/db.sh supabase/tests/ut3_sync_daystart.sql → 'UT 3차 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}');
-- 지금을 그날 22시쯤으로 (실제 칠하기가 '지금'에 묶여 있어서)
update public.profiles set timezone = (
  select case when o > 0 then 'Etc/GMT-' || o when o < 0 then 'Etc/GMT+' || -o else 'UTC' end
  from (select ((22 - extract(hour from now() at time zone 'UTC')::int + 36) % 24) - 12 as o) x), day_start_hour = 5
where id = 'a0000000-0000-0000-0000-00000000000a';

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding('student', array['건강'], 'purple', null);

-- ── 1. 그 사이 바뀌었으면 거절 ──
do $$
declare today date := public.user_today(); kw uuid; b1 jsonb; b2 jsonb;
begin
  select id into kw from public.daily_keywords where name = '생활';
  b1 := jsonb_build_array(jsonb_build_object('start', 0, 'end', 2, 'keyword_id', kw));
  b2 := jsonb_build_array(jsonb_build_object('start', 0, 'end', 2, 'keyword_id', kw), jsonb_build_object('start', 10, 'end', 11, 'keyword_id', kw));
  -- 기기 A: 빈 날에서 칠함
  perform public.save_day_blocks(today, 'actual', b1, '[]'::jsonb);
  -- 기기 B: 새로 안 읽은 채(빈 날로 알고) 칠함 → 거절
  begin
    perform public.save_day_blocks(today, 'actual', jsonb_build_array(jsonb_build_object('start', 20, 'end', 21, 'keyword_id', kw)), '[]'::jsonb);
    raise exception 'FAIL 낡은 상태로 덮어씀';
  exception when raise_exception then
    if sqlerrm <> 'stale_day' then raise; end if;
  end;
  if public.day_layer_sig(today, 'actual') <> public.blocks_sig(b1) then raise exception 'FAIL A의 기록이 지워짐'; end if;
  -- 바르게 알고 있으면 저장됨
  perform public.save_day_blocks(today, 'actual', b2, b1);
  -- 예전 앱(비교 없이)도 그대로 됨
  perform public.save_day_blocks(today, 'actual', b1);
  -- 계획: 이름 앞뒤 빈칸·빈 키워드 글자는 저장할 때처럼 다듬어 비교
  perform public.save_day_blocks(today, 'plan', jsonb_build_array(jsonb_build_object('start', 30, 'end', 32, 'label', ' 공부 ', 'task_id', '', 'key', 'k1')), '[]'::jsonb);
  perform public.save_day_blocks(today, 'plan', '[]'::jsonb, jsonb_build_array(jsonb_build_object('start', 30, 'end', 32, 'label', ' 공부 ', 'task_id', '', 'key', 'k1')));
end $$;

-- ── 4. 자정을 넘는 시간 (5시 시작) ──
do $$
declare today date := public.user_today(); kw uuid; g uuid; s uuid; j jsonb;
begin
  select id into kw from public.daily_keywords where name = '생활';
  insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time) values (today + 1, 'direct', '밤 공부', kw, true, '23:00', '01:00');
  insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time) values (today + 1, 'direct', '새벽까지', kw, true, '02:00', '05:00');
  begin
    insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time) values (today + 1, 'direct', '하루를 넘음', kw, true, '04:00', '06:00');
    raise exception 'FAIL 하루 경계를 넘는 시간';
  exception when check_violation then null; end;
  begin
    insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time) values (today + 1, 'direct', '거꾸로', kw, true, '20:00', '19:00');
    raise exception 'FAIL 끝이 시작보다 앞';
  exception when check_violation then null; end;
  begin
    insert into public.tasks (date, source, name, daily_keyword_id, is_timed, start_time, end_time) values (today + 1, 'direct', '같음', kw, true, '20:00', '20:00');
    raise exception 'FAIL 시작 = 끝';
  exception when check_violation then null; end;
  insert into public.goals (category_id, name, due_month) select id, '토익', '2030-01-01' from public.categories where kind = 'goal' returning id into g;
  insert into public.subgoals (goal_id, name) values (g, 'LC') returning id into s;
  insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays, start_time, end_time)
    values (g, s, public.sunday_of(today) + 7, '밤 실천', '{1}', '23:30', '00:30');
  begin
    insert into public.practices (goal_id, subgoal_id, week_start_date, name, weekdays, start_time, end_time) values (g, s, public.sunday_of(today) + 7, 'x', '{2}', '04:30', '05:30');
    raise exception 'FAIL 실천이 하루 경계를 넘음';
  exception when check_violation then null; end;
  -- 트래킹: 밤 공부 2시간 = 12칸 + 새벽까지 3시간 = 18칸
  j := public.tracking_summary(today + 1, today + 1);
  if (j ->> 'planned')::int <> 30 then raise exception 'FAIL 자정을 넘는 예약 시간 합계: %', j; end if;
  j := public.tracking_summary(public.sunday_of(today) + 7, public.sunday_of(today) + 13);
  if (j -> 'goals' -> 0 ->> 'planned')::int <> 6 then raise exception 'FAIL 자정을 넘는 실천 시간: %', j; end if;
end $$;

-- ── 3. 하루 시작 시각을 바꿔도 기록은 실제 시각 그대로 ──
reset role;
do $$
declare A uuid := 'a0000000-0000-0000-0000-00000000000a'; d date; kw uuid; sig text;
begin
  d := public.user_day_at(A, now()) - 3;
  select id into kw from public.daily_keywords where user_id = A and name = '생활';
  delete from public.time_blocks where user_id = A;
  -- 5시 시작 기준: 05:00~06:00, 15:00~16:00, (다음 날 새벽) 03:00~05:00
  insert into public.time_blocks (user_id, date, layer, start_slot, end_slot, daily_keyword_id) values
    (A, d, 'actual', 0, 5, kw), (A, d, 'actual', 60, 65, kw), (A, d, 'actual', 132, 143, kw);
  perform set_config('app.d', d::text, true);
end $$;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
-- 5 → 6시: 칸이 6칸 당겨지고, 05:00~06:00은 앞날 끝으로
update public.profiles set day_start_hour = 6 where id = auth.uid();
do $$
declare d date := current_setting('app.d')::date; got text;
begin
  select string_agg((date - d) || ':' || start_slot || '-' || end_slot, ' ' order by date, start_slot) into got from public.time_blocks where layer = 'actual';
  if got <> '-1:138-143 0:54-59 0:126-137' then raise exception 'FAIL 5→6시 옮기기: %', got; end if;
end $$;
-- 6 → 4시: 8칸(2시간 × 6 = 12칸) 밀리고, 넘친 새벽은 다음 날 처음으로
update public.profiles set day_start_hour = 4 where id = auth.uid();
do $$
declare d date := current_setting('app.d')::date; got text;
begin
  select string_agg((date - d) || ':' || start_slot || '-' || end_slot, ' ' order by date, start_slot) into got from public.time_blocks where layer = 'actual';
  -- 05:00~06:00 → 그날 6~11, 15:00~16:00 → 66~71, 03:00~05:00 → 그날 138~143 (03~04시) + 다음 날 0~5 (04~05시)
  if got <> '0:6-11 0:66-71 0:138-143 1:0-5' then raise exception 'FAIL 6→4시 옮기기: %', got; end if;
end $$;
-- 되돌리면 처음 그대로
update public.profiles set day_start_hour = 5 where id = auth.uid();
do $$
declare d date := current_setting('app.d')::date; got text;
begin
  select string_agg((date - d) || ':' || start_slot || '-' || end_slot, ' ' order by date, start_slot) into got from public.time_blocks where layer = 'actual';
  if got <> '0:0-5 0:60-65 0:132-137 0:138-143' then raise exception 'FAIL 다시 5시: %', got; end if;
end $$;

-- ── 2. 오늘이 어제로 돌아가는 변경은 거절 (지금을 새벽 5시대로) ──
reset role;
update public.profiles set day_start_hour = 5, timezone = (
  select case when o > 0 then 'Etc/GMT-' || o when o < 0 then 'Etc/GMT+' || -o else 'UTC' end
  from (select ((5 - extract(hour from now() at time zone 'UTC')::int + 36) % 24) - 12 as o) x)
where id = 'a0000000-0000-0000-0000-00000000000a';
set local role authenticated;
do $$
begin
  begin
    update public.profiles set day_start_hour = 6 where id = auth.uid();
    raise exception 'FAIL 오늘이 어제로 돌아감';
  exception when raise_exception then
    if sqlerrm <> 'day_start_back' then raise; end if;
  end;
  -- 앞으로 가는 변경은 됨
  update public.profiles set day_start_hour = 4 where id = auth.uid();
end $$;

select 'UT 3차 DB 테스트 통과' as result;
rollback;
