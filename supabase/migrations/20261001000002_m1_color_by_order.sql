-- M1 수정: 목표 카테고리 색은 순서대로 자동으로 정해진다 (2026-10-01 기획 결정, R-C1)
-- 빨강 → 주황 → 노랑 → 초록 → 파랑 → 보라 → 분홍 순서에서 일상 카테고리 색을 건너뛰고 1번부터 차례로.
-- 순서를 바꾸거나, 지우거나, 일상 색을 바꾸면 목표 카테고리 색이 다시 매겨진다. position도 0,1,2…로 정리한다.

create function public.recolor_goal_categories(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  with pal as (
    select c, row_number() over (order by ord) as rn
    from unnest(array['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']) with ordinality as p(c, ord)
    where c not in (select color from public.categories where user_id = p_user and kind = 'daily')
  ),
  goals as (
    select id, row_number() over (order by position, created_at, id) as rn
    from public.categories where user_id = p_user and kind = 'goal'
  )
  update public.categories cat
    set color = pal.c, position = (goals.rn - 1)::int
    from goals join pal using (rn)
    where cat.id = goals.id and (cat.color is distinct from pal.c or cat.position <> goals.rn - 1);
$$;

create function public.categories_recolor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 다시 매기는 UPDATE가 이 트리거를 또 부르지 않도록
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  perform public.recolor_goal_categories(coalesce(new.user_id, old.user_id));
  return null;
end $$;

-- 행 단위 AFTER 트리거는 문장이 끝난 뒤 실행되므로 여러 줄을 한 번에 바꿔도 최종 상태를 본다
create trigger categories_recolor after insert or delete or update of position, color on public.categories
  for each row execute function public.categories_recolor();

revoke execute on function public.recolor_goal_categories(uuid) from public, anon, authenticated;
revoke execute on function public.categories_recolor() from public, anon, authenticated;

-- 가입 단계: 목표 카테고리 색은 넘겨받지 않고 순서로 정한다 (p_categories = 이름 배열)
drop function public.complete_onboarding(text, jsonb, text, text);

create function public.complete_onboarding(p_life_stage text, p_categories text[], p_daily_color text, p_dream text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if (select onboarded_at from public.profiles where id = uid) is not null then
    raise exception 'already_onboarded';
  end if;
  if coalesce(array_length(p_categories, 1), 0) < 1 then
    raise exception 'need_goal_category' using hint = '목표 카테고리를 1개 이상 골라 주세요';
  end if;

  update public.profiles
    set life_stage = p_life_stage, dream = nullif(btrim(p_dream), ''), onboarded_at = now()
    where id = uid;
  update public.categories set color = p_daily_color where user_id = uid and kind = 'daily';
  -- 색은 임시값. 문장이 끝나면 트리거가 순서대로 다시 매긴다
  insert into public.categories (user_id, kind, name, color, position)
    select uid, 'goal', btrim(n), 'red', (i - 1)::int
    from unnest(p_categories) with ordinality as t(n, i);
end $$;

revoke execute on function public.complete_onboarding(text, text[], text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text[], text, text) to authenticated;

-- 이미 있는 계정도 규칙에 맞춘다
select public.recolor_goal_categories(id) from auth.users;
