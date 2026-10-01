-- M1. 계정과 설정: profiles, categories, daily_keywords
-- 규칙: 모든 데이터는 본인만 읽고 쓴다(행 단위 권한). R-C1 (목표 카테고리 ≤6, 색 중복 불가), 일상 카테고리 정확히 1개.

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  -- student 대학생 / examinee 수험생 / worker 직장인 / military 군 복무 중 / other 그 외
  life_stage text check (life_stage in ('student', 'examinee', 'worker', 'military', 'other')),
  dream text check (char_length(dream) <= 200),
  dream_why text check (char_length(dream_why) <= 2000),
  dream_day text check (char_length(dream_day) <= 2000),
  day_start_hour smallint not null default 5 check (day_start_hour in (4, 5, 6)),
  week_start text not null default 'mon' check (week_start in ('mon', 'sun')),
  review_notify_enabled boolean not null default false,
  review_notify_time time not null default '22:00',
  timezone text not null default 'Asia/Seoul',
  -- 가입 4단계를 마친 시각. null이면 가입 2~4단계로 보낸다
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (name, life_stage, dream, dream_why, dream_day, day_start_hour, week_start, review_notify_enabled, review_notify_time)
  on table public.profiles to authenticated;

create policy "profiles: 본인만 읽기" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: 본인만 고치기" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ───────────────────────── categories ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('goal', 'daily')),
  name text not null check (char_length(btrim(name)) between 1 and 20),
  color text not null check (color in ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink')),
  aspiration text check (char_length(aspiration) <= 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- 되고 싶은 모습은 목표 카테고리만
  constraint categories_aspiration_goal_only check (aspiration is null or kind = 'goal'),
  -- R-C1: 사용자당 같은 색 금지. 한 번에 여러 줄을 바꿀 수 있도록 검사는 트랜잭션 끝에
  constraint categories_user_color_key unique (user_id, color) deferrable initially deferred
);

-- 일상 카테고리는 사용자당 하나뿐
create unique index categories_one_daily on public.categories (user_id) where kind = 'daily';
create index categories_user_position on public.categories (user_id, position);

-- R-C1: 목표 카테고리 최대 6개
create function public.categories_goal_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'goal' then
    perform pg_advisory_xact_lock(hashtextextended('categories:' || new.user_id::text, 0));
    if (select count(*) from public.categories c where c.user_id = new.user_id and c.kind = 'goal') >= 6 then
      raise exception 'goal_category_limit' using hint = '목표 카테고리는 최대 6개예요';
    end if;
  end if;
  return new;
end $$;

create trigger categories_goal_limit before insert on public.categories
  for each row execute function public.categories_goal_limit();

alter table public.categories enable row level security;
revoke all on table public.categories from anon, authenticated;
grant select, delete on table public.categories to authenticated;
grant insert (kind, name, color, aspiration, position) on table public.categories to authenticated;
-- kind·user_id는 바꿀 수 없다 (열 단위 권한)
grant update (name, color, aspiration, position) on table public.categories to authenticated;

create policy "categories: 본인만 읽기" on public.categories for select to authenticated using (user_id = auth.uid());
-- 사용자가 직접 만드는 건 목표 카테고리뿐. 일상 카테고리는 가입 때 자동 생성
create policy "categories: 본인 목표 카테고리만 추가" on public.categories for insert to authenticated
  with check (user_id = auth.uid() and kind = 'goal');
create policy "categories: 본인만 고치기" on public.categories for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 일상 카테고리는 삭제 불가
create policy "categories: 본인 목표 카테고리만 삭제" on public.categories for delete to authenticated
  using (user_id = auth.uid() and kind = 'goal');

-- ───────────────────────── daily_keywords ─────────────────────────
create table public.daily_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 10),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

create index daily_keywords_user on public.daily_keywords (user_id, position);

alter table public.daily_keywords enable row level security;
revoke all on table public.daily_keywords from anon, authenticated;
grant select, delete on table public.daily_keywords to authenticated;
grant insert (category_id, name, position) on table public.daily_keywords to authenticated;
grant update (name, position) on table public.daily_keywords to authenticated;

create policy "daily_keywords: 본인만 읽기" on public.daily_keywords for select to authenticated using (user_id = auth.uid());
-- 키워드는 본인의 일상 카테고리에만 붙는다
create policy "daily_keywords: 본인 일상 카테고리에만 추가" on public.daily_keywords for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid() and c.kind = 'daily')
  );
create policy "daily_keywords: 본인만 고치기" on public.daily_keywords for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_keywords: 본인만 삭제" on public.daily_keywords for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── 가입 시 자동 생성 ─────────────────────────
-- 프로필 + 일상 카테고리(보라) + 기본 키워드 4개
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  daily_id uuid;
begin
  insert into public.profiles (id, name)
    values (new.id, coalesce(left(btrim(new.raw_user_meta_data ->> 'name'), 40), ''));
  insert into public.categories (user_id, kind, name, color, position)
    values (new.id, 'daily', '일상', 'purple', 0)
    returning id into daily_id;
  insert into public.daily_keywords (user_id, category_id, name, position)
    select new.id, daily_id, k, (i - 1)::int
    from unnest(array['업무', '생활', '이동', '휴식']) with ordinality as t(k, i);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── 함수 (RPC) ─────────────────────────
-- 가입 2~4단계를 한 번에 저장: 시기, 목표 카테고리(1~6개), 일상 색, 꿈(선택)
create function public.complete_onboarding(p_life_stage text, p_categories jsonb, p_daily_color text, p_dream text)
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
  if jsonb_typeof(p_categories) <> 'array' or jsonb_array_length(p_categories) < 1 then
    raise exception 'need_goal_category' using hint = '목표 카테고리를 1개 이상 골라 주세요';
  end if;

  update public.profiles
    set life_stage = p_life_stage, dream = nullif(btrim(p_dream), ''), onboarded_at = now()
    where id = uid;
  update public.categories set color = p_daily_color where user_id = uid and kind = 'daily';
  insert into public.categories (user_id, kind, name, color, position)
    select uid, 'goal', btrim(e ->> 'name'), e ->> 'color', (i - 1)::int
    from jsonb_array_elements(p_categories) with ordinality as t(e, i);
end $$;

-- 목표 카테고리 순서 바꾸기: 넘겨준 순서대로 position = 0, 1, 2…
create function public.reorder_categories(p_ids uuid[]) returns void
language sql set search_path = '' as $$
  update public.categories
    set position = array_position(p_ids, id) - 1
    where user_id = auth.uid() and kind = 'goal' and id = any (p_ids);
$$;

-- 계정 삭제: 로그인 정보와 모든 데이터가 함께 지워진다
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.complete_onboarding(text, jsonb, text, text) from public, anon;
revoke execute on function public.reorder_categories(uuid[]) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.categories_goal_limit() from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, jsonb, text, text) to authenticated;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
