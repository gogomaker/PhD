-- 일상 키워드 최대 6개 (2026-10-05). 실행: scripts/db.sh supabase/tests/keyword_limit.sql → '키워드 DB 테스트 통과'
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"name":"김가나"}');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding('student', array['건강'], 'purple', null);
do $$
declare c uuid; n int; i int; first uuid;
begin
  select id into c from public.categories where kind = 'daily';
  select count(*) into n from public.daily_keywords where not archived;
  for i in n + 1 .. 6 loop
    insert into public.daily_keywords (category_id, name, position) values (c, '키워드' || i, i);
  end loop;
  begin
    insert into public.daily_keywords (category_id, name, position) values (c, '일곱째', 7);
    raise exception 'FAIL 7번째 키워드';
  exception when raise_exception then
    if sqlerrm <> 'keyword_limit' then raise; end if;
  end;
  -- 하나 지우면(보관) 새로 하나 가능, 그 상태에서 지운 것을 되살리면 막힘
  select id into first from public.daily_keywords where not archived order by position limit 1;
  update public.daily_keywords set archived = true where id = first;
  insert into public.daily_keywords (category_id, name, position) values (c, '새것', 8);
  begin
    update public.daily_keywords set archived = false where id = first;
    raise exception 'FAIL 되살려서 7개';
  exception when raise_exception then
    if sqlerrm <> 'keyword_limit' then raise; end if;
  end;
  -- 이름만 바꾸는 건 그대로 된다
  update public.daily_keywords set position = 9 where name = '새것';
end $$;
select '키워드 DB 테스트 통과' as result;
rollback;
