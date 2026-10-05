-- 2026-10-05 기획 요청: 일상 카테고리 키워드는 최대 6개 (보관한 것은 세지 않음).
-- 새로 만들 때와, 지운(보관한) 키워드를 되살릴 때 막는다
create function public.daily_keywords_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.archived and (select count(*) from public.daily_keywords k where k.user_id = new.user_id and not k.archived and k.id <> new.id) >= 6 then
    raise exception 'keyword_limit' using hint = '일상 키워드는 최대 6개예요';
  end if;
  return new;
end $$;
revoke execute on function public.daily_keywords_limit() from public, anon, authenticated;
create trigger daily_keywords_limit before insert or update of archived on public.daily_keywords
  for each row execute function public.daily_keywords_limit();
