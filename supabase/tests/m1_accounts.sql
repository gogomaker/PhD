-- M1 DB 규칙 테스트. 한 트랜잭션에서 돌리고 마지막에 되돌린다(실제 데이터에 흔적 없음).
-- 실행: scripts/db-test.sh supabase/tests/m1_accounts.sql  → 마지막 결과가 'M1 DB 테스트 통과'이면 성공
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"이다라"}');

-- ── A로 로그인 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare n int; t text;
begin
  -- 가입 때 자동 생성: 프로필, 일상 카테고리(보라), 기본 키워드 4개
  select name into t from public.profiles;
  if t is distinct from '김가나' then raise exception 'FAIL 프로필 이름: %', t; end if;
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL 프로필은 본인 것만 보여야 함: %', n; end if;
  select count(*) into n from public.categories where kind = 'daily' and color = 'purple' and name = '일상';
  if n <> 1 then raise exception 'FAIL 일상 카테고리 자동 생성'; end if;
  select string_agg(name, ',' order by position) into t from public.daily_keywords;
  if t is distinct from '업무,생활,이동,휴식' then raise exception 'FAIL 기본 키워드: %', t; end if;

  -- 일상 카테고리는 직접 추가 불가
  begin
    insert into public.categories (kind, name, color) values ('daily', '일상2', 'red');
    raise exception 'FAIL 일상 카테고리 두 번째 추가가 됨';
  exception when insufficient_privilege then null; end;

  -- 가입 단계: 목표 카테고리 0개는 거절
  begin
    perform public.complete_onboarding('student', array[]::text[], 'purple', null);
    raise exception 'FAIL 목표 카테고리 0개로 가입 완료됨';
  exception when raise_exception then
    if sqlerrm <> 'need_goal_category' then raise; end if;
  end;

  -- R-C1: 7개는 거절
  begin
    perform public.complete_onboarding('student', array['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'purple', null);
    raise exception 'FAIL 목표 카테고리 7개로 가입 완료됨';
  exception when raise_exception then
    if sqlerrm <> 'goal_category_limit' then raise; end if;
  end;

  -- 정상 가입 완료 (꿈 건너뛰기)
  perform public.complete_onboarding('military', array['건강', '어학', '전공'], 'orange', '  ');
  set constraints public.categories_user_color_key immediate;
  set constraints public.categories_user_color_key deferred;
  select count(*) into n from public.profiles where onboarded_at is not null and life_stage = 'military' and dream is null;
  if n <> 1 then raise exception 'FAIL 가입 완료 저장'; end if;
  select string_agg(name || ':' || color, ',' order by position) into t from public.categories where kind = 'goal';
  -- 색은 순서대로, 일상 색(주황)은 건너뜀
  if t is distinct from '건강:red,어학:yellow,전공:green' then raise exception 'FAIL 목표 카테고리 저장: %', t; end if;
  select color into t from public.categories where kind = 'daily';
  if t <> 'orange' then raise exception 'FAIL 일상 색 저장: %', t; end if;

  -- 가입 완료는 한 번만
  begin
    perform public.complete_onboarding('student', array['x'], 'green', null);
    raise exception 'FAIL 가입 완료가 두 번 됨';
  exception when raise_exception then
    if sqlerrm <> 'already_onboarded' then raise; end if;
  end;

  -- R-C1: 목표 카테고리 6개까지, 7번째는 거절
  insert into public.categories (kind, name, color, position) values ('goal', '취미', 'red', 3), ('goal', '재정', 'red', 4), ('goal', '관계', 'red', 5);
  set constraints public.categories_user_color_key immediate;
  set constraints public.categories_user_color_key deferred;
  select string_agg(color, ',' order by position) into t from public.categories where kind = 'goal';
  if t is distinct from 'red,yellow,green,blue,purple,pink' then raise exception 'FAIL 추가하면 순서대로 색: %', t; end if;
  begin
    insert into public.categories (kind, name, color, position) values ('goal', '일곱', 'red', 6);
    raise exception 'FAIL 7번째 목표 카테고리가 추가됨';
  exception when raise_exception then
    if sqlerrm <> 'goal_category_limit' then raise; end if;
  end;

  -- 목표 카테고리 색을 직접 바꿔도 순서 색으로 되돌아간다
  update public.categories set color = 'orange' where name = '건강';
  select color into t from public.categories where name = '건강';
  if t <> 'red' then raise exception 'FAIL 목표 색 직접 변경이 남음: %', t; end if;

  -- 일상 색을 바꾸면 목표 색이 다시 매겨진다 (일상=빨강 → 목표는 주황부터)
  update public.categories set color = 'red' where kind = 'daily';
  set constraints public.categories_user_color_key immediate;
  set constraints public.categories_user_color_key deferred;
  select string_agg(color, ',' order by position) into t from public.categories where kind = 'goal';
  if t is distinct from 'orange,yellow,green,blue,purple,pink' then raise exception 'FAIL 일상 색 변경 후 다시 매기기: %', t; end if;

  -- 일상 카테고리는 삭제 불가 (지워지지 않음)
  delete from public.categories where kind = 'daily';
  select count(*) into n from public.categories where kind = 'daily';
  if n <> 1 then raise exception 'FAIL 일상 카테고리가 삭제됨'; end if;

  -- 카테고리 종류(kind)는 못 바꿈
  begin
    update public.categories set kind = 'goal' where kind = 'daily';
    raise exception 'FAIL kind가 바뀜';
  exception when insufficient_privilege then null; end;

  -- 가입 완료 시각은 사용자가 못 바꿈
  begin
    update public.profiles set onboarded_at = null;
    raise exception 'FAIL onboarded_at이 바뀜';
  exception when insufficient_privilege then null; end;

  -- 설정 값 범위
  update public.profiles set day_start_hour = 6, week_start = 'sun';
  begin
    update public.profiles set day_start_hour = 7;
    raise exception 'FAIL 하루 시작 7시가 저장됨';
  exception when check_violation then null; end;

  -- 순서 바꾸기
  perform public.reorder_categories(array(select id from public.categories where kind = 'goal' order by position desc));
  select string_agg(name, ',' order by position) into t from public.categories where kind = 'goal';
  if t is distinct from '관계,재정,취미,전공,어학,건강' then raise exception 'FAIL 순서 바꾸기: %', t; end if;
  -- 순서를 바꾸면 색도 바뀐다
  select string_agg(name || ':' || color, ',' order by position) into t from public.categories where kind = 'goal';
  if t is distinct from '관계:orange,재정:yellow,취미:green,전공:blue,어학:purple,건강:pink' then raise exception 'FAIL 순서 = 색: %', t; end if;

  -- 지우면 뒤의 카테고리가 한 칸씩 당겨지고 색도 따라간다
  delete from public.categories where name = '재정';
  select string_agg(name || ':' || color || ':' || position, ',' order by position) into t from public.categories where kind = 'goal';
  if t is distinct from '관계:orange:0,취미:yellow:1,전공:green:2,어학:blue:3,건강:purple:4' then raise exception 'FAIL 삭제 후 다시 매기기: %', t; end if;

  -- 키워드 추가·삭제
  insert into public.daily_keywords (category_id, name, position)
    select id, '운동', 4 from public.categories where kind = 'daily';
  delete from public.daily_keywords where name = '이동';
  select string_agg(name, ',' order by position) into t from public.daily_keywords;
  if t is distinct from '업무,생활,휴식,운동' then raise exception 'FAIL 키워드 추가·삭제: %', t; end if;
end $$;

-- ── B로 로그인: A의 데이터는 안 보이고 못 바꾼다 ──
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare n int; a_daily uuid;
begin
  select count(*) into n from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'FAIL B가 A의 카테고리를 봄'; end if;
  select count(*) into n from public.daily_keywords where user_id = 'a0000000-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'FAIL B가 A의 키워드를 봄'; end if;
  select count(*) into n from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'FAIL B가 A의 프로필을 봄'; end if;

  update public.categories set name = '해킹' where user_id = 'a0000000-0000-0000-0000-00000000000a';
  update public.profiles set name = '해킹' where id = 'a0000000-0000-0000-0000-00000000000a';
  delete from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a';
  delete from public.daily_keywords where user_id = 'a0000000-0000-0000-0000-00000000000a';

  -- A의 일상 카테고리에 키워드 끼워 넣기 시도
  begin
    insert into public.daily_keywords (category_id, name) values (
      (select id from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a' and kind = 'daily'), '해킹');
    raise exception 'FAIL B가 A 카테고리에 키워드 추가';
  exception when insufficient_privilege or not_null_violation then null; end;

  -- user_id를 직접 지정해 A 행 만들기 시도
  begin
    insert into public.categories (user_id, kind, name, color) values ('a0000000-0000-0000-0000-00000000000a', 'goal', '해킹', 'blue');
    raise exception 'FAIL B가 A 이름으로 카테고리 추가';
  exception when insufficient_privilege then null; end;

  -- B 자기 순서 바꾸기로 A 카테고리 건드리기 시도
  perform public.reorder_categories(array['a0000000-0000-0000-0000-00000000000a'::uuid]);
end $$;

-- ── 로그인 안 한 사람(anon)은 아무것도 못 읽는다 ──
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.profiles;
    raise exception 'FAIL anon이 profiles를 읽음';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.categories;
    raise exception 'FAIL anon이 categories를 읽음';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_my_account();
    raise exception 'FAIL anon이 계정 삭제 함수를 부름';
  exception when insufficient_privilege then null; end;
end $$;

-- ── 관리자 시점에서 확인: B의 시도가 A 데이터에 아무 영향이 없었다 ──
reset role;
do $$
declare n int; t text;
begin
  select name into t from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a';
  if t <> '김가나' then raise exception 'FAIL A 프로필이 바뀜: %', t; end if;
  select count(*) into n from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a' and name = '해킹';
  if n <> 0 then raise exception 'FAIL A 카테고리 이름이 바뀜'; end if;
  select count(*) into n from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a';
  if n <> 6 then raise exception 'FAIL A 카테고리 수: %', n; end if;
end $$;

-- ── 계정 삭제: A의 모든 데이터가 함께 지워진다 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
do $$
declare n int;
begin
  select (select count(*) from auth.users where id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.categories where user_id = 'a0000000-0000-0000-0000-00000000000a')
       + (select count(*) from public.daily_keywords where user_id = 'a0000000-0000-0000-0000-00000000000a') into n;
  if n <> 0 then raise exception 'FAIL 계정 삭제 후 남은 행: %', n; end if;
  select count(*) into n from public.categories where user_id = 'b0000000-0000-0000-0000-00000000000b';
  if n <> 1 then raise exception 'FAIL A 삭제가 B에 영향'; end if;
end $$;

select 'M1 DB 테스트 통과' as result;
rollback;
