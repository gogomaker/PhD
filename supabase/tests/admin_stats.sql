-- 관리 페이지 집계 (2026-10-04): 관리자만, 숫자만, 테스트 계정 제외
-- 실행: scripts/db.sh supabase/tests/admin_stats.sql → '관리 DB 테스트 통과'
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"관리"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"일반"}');
insert into public.admins (user_id) values ('a0000000-0000-0000-0000-00000000000a');
create temp table r (k text, v jsonb) on commit drop;
grant all on r to authenticated;

-- 일반 사용자는 집계·표를 볼 수 없다
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.admin_stats();
    raise exception 'FAIL 일반 사용자가 집계를 봄';
  exception when raise_exception then
    if sqlerrm <> 'not_admin' then raise; end if;
  end;
  begin
    perform count(*) from public.daily_active;
    raise exception 'FAIL 일반 사용자가 활동 표를 읽음';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admins (user_id) values (auth.uid());
    raise exception 'FAIL 스스로 관리자가 됨';
  exception when insufficient_privilege then null; end;
  if public.is_admin() then raise exception 'FAIL 일반 사용자가 관리자로 보임'; end if;
end $$;

-- 관리자: 처음 숫자
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into r select 's1', public.admin_stats();

-- 일반 사용자가 앱을 열면(두 번 열어도 한 번) 오늘 활동
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.touch_active();
select public.touch_active();

-- 테스트 계정은 세지 않는다
reset role;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('c0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@phd-test.dev', '{"name":"테스트"}');
insert into public.daily_active values ('c0000000-0000-0000-0000-00000000000c', (now() at time zone 'Asia/Seoul')::date);

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare s1 jsonb := (select v from r where k = 's1'); s2 jsonb := public.admin_stats(7);
begin
  if not public.is_admin() then raise exception 'FAIL 관리자인데 아님'; end if;
  if (s2 ->> 'dau')::int <> (s1 ->> 'dau')::int + 1 then raise exception 'FAIL DAU: % → %', s1 ->> 'dau', s2 ->> 'dau'; end if;
  if (s2 ->> 'wau')::int <> (s1 ->> 'wau')::int + 1 then raise exception 'FAIL WAU'; end if;
  if (s2 ->> 'users')::int <> (s1 ->> 'users')::int then raise exception 'FAIL 테스트 계정이 가입자에 들어감'; end if;
  if jsonb_array_length(s2 -> 'daily') <> 7 then raise exception 'FAIL 날짜별 줄 수'; end if;
  if (s2 -> 'daily' -> 0 ->> 'day')::date <> (now() at time zone 'Asia/Seoul')::date then raise exception 'FAIL 첫 줄이 오늘이 아님'; end if;
  if (s2 -> 'daily' -> 0 ->> 'dau')::int <> (s2 ->> 'dau')::int then raise exception 'FAIL 오늘 줄 DAU'; end if;
end $$;

select '관리 DB 테스트 통과' as result;
rollback;
