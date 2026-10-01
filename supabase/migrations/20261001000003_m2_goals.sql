-- M2. 목표: goals, subgoals
-- 규칙: R-C2 (일상 카테고리엔 목표 없음), R-C3 (목표는 카테고리 1개), R-G1 (세부목표는 목표 1개),
--       R-G4 (시작 전 목표만 삭제), R-G5 (진행 중은 삭제 불가), R-G7 (마무리한 목표는 다시 못 엶)
-- 기획 결정(2026-10-01): 목표를 적을 때 기한도 바로 받는다(due_month 필수), 목표가 든 카테고리는 지울 수 없다.

-- ───────────────────────── goals ─────────────────────────
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 기본 동작(NO ACTION): 목표가 남아 있으면 카테고리를 지울 수 없다. 계정 삭제 때는 함께 지워진다
  category_id uuid not null references public.categories (id),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position integer not null default 0,
  -- 기한: 그 달의 1일로 저장
  due_month date not null check (extract(day from due_month) = 1),
  reason text check (char_length(reason) <= 500),
  importance text check (importance in ('high', 'mid', 'low')),
  fallback text check (char_length(fallback) <= 200),
  -- not_started 시작 전 / in_progress 진행 중 / completed 완성 / dropped 중도 마무리. 사용자가 직접 못 바꾼다
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'dropped')),
  -- R-G3: 이 목표의 실천이 주간 표에 처음 배치된 시각 (M3에서 채움)
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create index goals_user_category on public.goals (user_id, category_id, position);

-- R-C2, R-C3: 목표는 본인의 "목표 카테고리" 하나에만 속한다
create function public.goals_check_category() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.user_id = new.user_id and c.kind = 'goal'
  ) then
    raise exception 'goal_category_invalid';
  end if;
  return new;
end $$;

create trigger goals_check_category before insert or update of category_id on public.goals
  for each row execute function public.goals_check_category();

alter table public.goals enable row level security;
revoke all on table public.goals from anon, authenticated;
grant select, delete on table public.goals to authenticated;
grant insert (category_id, name, position, due_month, reason, importance, fallback) on table public.goals to authenticated;
grant update (category_id, name, position, due_month, reason, importance, fallback) on table public.goals to authenticated;

create policy "goals: 본인만 읽기" on public.goals for select to authenticated using (user_id = auth.uid());
create policy "goals: 본인만 추가" on public.goals for insert to authenticated with check (user_id = auth.uid());
-- R-G7: 마무리한 목표는 고칠 수 없다
create policy "goals: 마무리 전 목표만 고치기" on public.goals for update to authenticated
  using (user_id = auth.uid() and status in ('not_started', 'in_progress'))
  with check (user_id = auth.uid());
-- R-G4, R-G5: 시작 전 목표만 삭제
create policy "goals: 시작 전 목표만 삭제" on public.goals for delete to authenticated
  using (user_id = auth.uid() and status = 'not_started');

-- ───────────────────────── subgoals ─────────────────────────
create table public.subgoals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index subgoals_goal on public.subgoals (goal_id, position);
create index subgoals_user on public.subgoals (user_id);

alter table public.subgoals enable row level security;
revoke all on table public.subgoals from anon, authenticated;
grant select, delete on table public.subgoals to authenticated;
grant insert (goal_id, name, position) on table public.subgoals to authenticated;
grant update (name, position) on table public.subgoals to authenticated;

create policy "subgoals: 본인만 읽기" on public.subgoals for select to authenticated using (user_id = auth.uid());
-- R-G1: 본인의, 마무리 전 목표에만 붙인다
create policy "subgoals: 본인 목표에만 추가" on public.subgoals for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid() and g.status in ('not_started', 'in_progress'))
  );
create policy "subgoals: 마무리 전 목표의 것만 고치기" on public.subgoals for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.goals g where g.id = goal_id and g.status in ('not_started', 'in_progress')))
  with check (user_id = auth.uid());
-- R-G9(계획 표에 배치된 세부목표는 삭제 불가)는 M3에서 계획 표 테이블의 참조로 막는다
create policy "subgoals: 마무리 전 목표의 것만 삭제" on public.subgoals for delete to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.goals g where g.id = goal_id and g.status in ('not_started', 'in_progress')));

-- ───────────────────────── 함수 ─────────────────────────
-- 세부목표 순서 바꾸기: 넘겨준 순서대로 position = 0, 1, 2…
create function public.reorder_subgoals(p_ids uuid[]) returns void
language sql set search_path = '' as $$
  update public.subgoals
    set position = array_position(p_ids, id) - 1
    where user_id = auth.uid() and id = any (p_ids);
$$;

-- 목표 순서 바꾸기 (같은 카테고리 안)
create function public.reorder_goals(p_ids uuid[]) returns void
language sql set search_path = '' as $$
  update public.goals
    set position = array_position(p_ids, id) - 1
    where user_id = auth.uid() and id = any (p_ids);
$$;

revoke execute on function public.goals_check_category() from public, anon, authenticated;
revoke execute on function public.reorder_subgoals(uuid[]) from public, anon;
revoke execute on function public.reorder_goals(uuid[]) from public, anon;
grant execute on function public.reorder_subgoals(uuid[]) to authenticated;
grant execute on function public.reorder_goals(uuid[]) to authenticated;
