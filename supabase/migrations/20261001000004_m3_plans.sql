-- M3. 계획 표: 연간(year_cells), 월간(month_cells), 참고사항(notes), 주간 실천(practices)
-- 규칙: R-P1 열은 항상 한 줄(한 열 안에서 칸이 겹치지 않음), R-P2 병합으로 기간 표현, R-P4 월간은 연간과 따로,
--       R-G2 세부목표 없는 목표는 열로 못 올림(화면), R-G3 실천을 처음 놓으면 진행 중, R-G9 배치된 세부목표는 삭제 불가
-- 기획 결정(2026-10-01): 연간 표는 1~12월 달력 연도. 실천을 모두 지우면 목표는 다시 시작 전.

create extension if not exists btree_gist with schema extensions;

-- ───────── 목표: 계획 표 열 순서·숨김 ─────────
alter table public.goals
  add column table_position integer not null default 0,
  add column table_hidden boolean not null default true;
grant update (table_position, table_hidden) on table public.goals to authenticated;

-- 칸이 가리키는 세부목표가 그 목표의 것인지 확인하기 위한 키
alter table public.subgoals add constraint subgoals_id_goal_key unique (id, goal_id);

-- 목표가 본인 것이고 마무리 전인지
create function public.goal_is_open(p_goal uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goals g
    where g.id = p_goal and g.user_id = auth.uid() and g.status in ('not_started', 'in_progress')
  );
$$;
revoke execute on function public.goal_is_open(uuid) from public, anon;
grant execute on function public.goal_is_open(uuid) to authenticated;

-- ───────── 연간 표 ─────────
create table public.year_cells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  subgoal_id uuid not null,
  -- 병합 범위: 그 달의 1일. 같은 해 안에서만
  start_month date not null,
  end_month date not null,
  memo text not null default '' check (char_length(memo) <= 200),
  created_at timestamptz not null default now(),
  -- R-G9: 칸이 남아 있으면 세부목표를 지울 수 없다 (목표를 지울 때는 칸도 함께 지워짐)
  foreign key (subgoal_id, goal_id) references public.subgoals (id, goal_id),
  check (extract(day from start_month) = 1 and extract(day from end_month) = 1),
  check (end_month >= start_month and extract(year from start_month) = extract(year from end_month)),
  -- R-P1: 한 목표 열 안에서 칸이 겹치지 않는다
  constraint year_cells_no_overlap exclude using gist (goal_id with =, daterange(start_month, end_month, '[]') with &&)
);
create index year_cells_user on public.year_cells (user_id, start_month);

-- ───────── 월간 표 ─────────
create table public.month_cells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  subgoal_id uuid not null,
  year_month date not null check (extract(day from year_month) = 1),
  -- 그 달의 몇 번째 주(0부터). 한 주는 날이 더 많이 들어간 달에 속한다
  start_week smallint not null check (start_week between 0 and 5),
  end_week smallint not null check (end_week between 0 and 5),
  comment text not null default '' check (char_length(comment) <= 200),
  created_at timestamptz not null default now(),
  foreign key (subgoal_id, goal_id) references public.subgoals (id, goal_id),
  check (end_week >= start_week),
  constraint month_cells_no_overlap exclude using gist (goal_id with =, year_month with =, int4range(start_week, end_week, '[]') with &&)
);
create index month_cells_user on public.month_cells (user_id, year_month);

-- ───────── 참고사항 (월간·주간 공통, 모바일로 내려가지 않음 R-P10) ─────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('month', 'week')),
  -- month: 그 달 1일 / week: 그 주 첫날
  period_key date not null,
  start_index smallint not null check (start_index between 0 and 6),
  end_index smallint not null check (end_index between 0 and 6),
  text text not null default '' check (char_length(text) <= 200),
  created_at timestamptz not null default now(),
  check (end_index >= start_index),
  constraint notes_no_overlap exclude using gist (user_id with =, scope with =, period_key with =, int4range(start_index, end_index, '[]') with &&)
);
create index notes_user on public.notes (user_id, scope, period_key);

-- ───────── 주간 실천 ─────────
create function public.valid_weekdays(d smallint[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(d) between 1 and 7
     and d <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
     and cardinality(d) = (select count(distinct x) from unnest(d) x);
$$;

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  subgoal_id uuid not null,
  -- 그 주의 첫날(사용자의 한 주 시작 요일 기준)
  week_start_date date not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null default 'once' check (kind in ('repeat', 'once')),
  -- 요일: 1=월 … 7=일 (ISO). 1개 이상
  weekdays smallint[] not null check (public.valid_weekdays(weekdays)),
  created_at timestamptz not null default now(),
  foreign key (subgoal_id, goal_id) references public.subgoals (id, goal_id)
);
create index practices_user_week on public.practices (user_id, week_start_date);
create index practices_goal on public.practices (goal_id);

-- R-G3: 실천을 처음 놓으면 진행 중, 모두 지우면 다시 시작 전 (기획 결정)
create function public.practices_goal_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 목표·계정 삭제로 함께 지워질 때는 건드리지 않는다
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'INSERT' then
    update public.goals set status = 'in_progress', started_at = coalesce(started_at, now())
      where id = new.goal_id and status = 'not_started';
  else
    -- TODO(M4): 체크했거나 시간을 칠한 할 일이 있으면 되돌리지 않는다
    if not exists (select 1 from public.practices where goal_id = old.goal_id) then
      update public.goals set status = 'not_started', started_at = null
        where id = old.goal_id and status = 'in_progress';
    end if;
  end if;
  return null;
end $$;

create trigger practices_goal_status after insert or delete on public.practices
  for each row execute function public.practices_goal_status();

revoke execute on function public.practices_goal_status() from public, anon, authenticated;

-- ───────── 권한 ─────────
alter table public.year_cells enable row level security;
alter table public.month_cells enable row level security;
alter table public.notes enable row level security;
alter table public.practices enable row level security;
revoke all on table public.year_cells, public.month_cells, public.notes, public.practices from anon, authenticated;

grant select, delete on table public.year_cells to authenticated;
grant insert (goal_id, subgoal_id, start_month, end_month, memo) on table public.year_cells to authenticated;
grant update (start_month, end_month, memo) on table public.year_cells to authenticated;

grant select, delete on table public.month_cells to authenticated;
grant insert (goal_id, subgoal_id, year_month, start_week, end_week, comment) on table public.month_cells to authenticated;
grant update (start_week, end_week, comment) on table public.month_cells to authenticated;

grant select, delete on table public.notes to authenticated;
grant insert (scope, period_key, start_index, end_index, text) on table public.notes to authenticated;
grant update (start_index, end_index, text) on table public.notes to authenticated;

grant select, delete on table public.practices to authenticated;
grant insert (goal_id, subgoal_id, week_start_date, name, kind, weekdays) on table public.practices to authenticated;

-- 연간·월간·실천: 본인 것만, 마무리 전 목표에만 쓰기 (R-G7)
create policy "year_cells: 본인만 읽기" on public.year_cells for select to authenticated using (user_id = auth.uid());
create policy "year_cells: 열린 목표에만 추가" on public.year_cells for insert to authenticated with check (user_id = auth.uid() and public.goal_is_open(goal_id));
create policy "year_cells: 열린 목표만 고치기" on public.year_cells for update to authenticated using (user_id = auth.uid() and public.goal_is_open(goal_id)) with check (user_id = auth.uid());
create policy "year_cells: 열린 목표만 삭제" on public.year_cells for delete to authenticated using (user_id = auth.uid() and public.goal_is_open(goal_id));

create policy "month_cells: 본인만 읽기" on public.month_cells for select to authenticated using (user_id = auth.uid());
create policy "month_cells: 열린 목표에만 추가" on public.month_cells for insert to authenticated with check (user_id = auth.uid() and public.goal_is_open(goal_id));
create policy "month_cells: 열린 목표만 고치기" on public.month_cells for update to authenticated using (user_id = auth.uid() and public.goal_is_open(goal_id)) with check (user_id = auth.uid());
create policy "month_cells: 열린 목표만 삭제" on public.month_cells for delete to authenticated using (user_id = auth.uid() and public.goal_is_open(goal_id));

create policy "notes: 본인만 읽기" on public.notes for select to authenticated using (user_id = auth.uid());
create policy "notes: 본인만 추가" on public.notes for insert to authenticated with check (user_id = auth.uid());
create policy "notes: 본인만 고치기" on public.notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes: 본인만 삭제" on public.notes for delete to authenticated using (user_id = auth.uid());

create policy "practices: 본인만 읽기" on public.practices for select to authenticated using (user_id = auth.uid());
create policy "practices: 열린 목표에만 추가" on public.practices for insert to authenticated with check (user_id = auth.uid() and public.goal_is_open(goal_id));
create policy "practices: 열린 목표만 삭제" on public.practices for delete to authenticated using (user_id = auth.uid() and public.goal_is_open(goal_id));
