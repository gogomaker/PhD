-- 2026-10-05 기획 결정: 연간·월간 칸 하나에 세부목표 여러 개 (예: 신앙 매일 지키기 — 기도·성경·묵상을 1년 내내 함께).
-- 열은 그대로 한 줄(R-P1) — 칸이 겹치지 않고, 칸 안의 세부목표만 여러 개.
-- subgoal_id = 첫 세부목표(예전 앱도 그대로 읽는다), extra_subgoal_ids = 나머지.

alter table public.year_cells add column extra_subgoal_ids uuid[] not null default '{}';
alter table public.month_cells add column extra_subgoal_ids uuid[] not null default '{}';

-- 칸의 세부목표를 고칠 수 있게 (지난 칸은 기존 정책이 막는다, R-P12)
grant insert (extra_subgoal_ids), update (subgoal_id, extra_subgoal_ids) on table public.year_cells to authenticated;
grant insert (extra_subgoal_ids), update (subgoal_id, extra_subgoal_ids) on table public.month_cells to authenticated;

-- 나머지 세부목표: 같은 목표의 것, 겹치지 않게, 첫 세부목표와도 다르게, 최대 10개
create function public.cell_subgoals_ok() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if cardinality(new.extra_subgoal_ids) > 10
     or cardinality(new.extra_subgoal_ids) <> (select count(distinct x) from unnest(new.extra_subgoal_ids) x)
     or new.subgoal_id = any (new.extra_subgoal_ids)
     or exists (
       select 1 from unnest(new.extra_subgoal_ids) x
       where not exists (select 1 from public.subgoals s where s.id = x and s.goal_id = new.goal_id)
     ) then
    raise exception 'cell_subgoals' using errcode = 'check_violation', hint = '같은 목표의 세부목표만, 겹치지 않게 넣을 수 있어요';
  end if;
  return new;
end $$;
revoke execute on function public.cell_subgoals_ok() from public, anon, authenticated;
create trigger year_cells_subgoals before insert or update of subgoal_id, extra_subgoal_ids on public.year_cells
  for each row execute function public.cell_subgoals_ok();
create trigger month_cells_subgoals before insert or update of subgoal_id, extra_subgoal_ids on public.month_cells
  for each row execute function public.cell_subgoals_ok();

-- R-G9: 칸에 들어 있는 세부목표는 지울 수 없다 (나머지 칸에 있는 것도). 목표째 지울 때(칸도 함께 지워짐)는 그대로
create function public.subgoals_placed_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t text;
begin
  if not exists (select 1 from public.goals where id = old.goal_id) then
    return old;
  end if;
  if exists (select 1 from public.year_cells where goal_id = old.goal_id and old.id = any (extra_subgoal_ids)) then
    t := 'year_cells';
  elsif exists (select 1 from public.month_cells where goal_id = old.goal_id and old.id = any (extra_subgoal_ids)) then
    t := 'month_cells';
  end if;
  if t is not null then
    -- 외래키 오류와 같은 모양으로 (화면이 "계획 표에 배치된 세부목표는 지울 수 없어요"로 보여 준다)
    raise exception 'update or delete on table "subgoals" violates foreign key constraint "%_extra_subgoal" on table "%"', t, t
      using errcode = 'foreign_key_violation';
  end if;
  return old;
end $$;
revoke execute on function public.subgoals_placed_guard() from public, anon, authenticated;
create trigger subgoals_placed_guard before delete on public.subgoals
  for each row execute function public.subgoals_placed_guard();
