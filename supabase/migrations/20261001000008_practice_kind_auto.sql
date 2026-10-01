-- 수정 (2026-10-01 기획 결정): 주간 실천의 단발/반복 고르기를 없앤다.
-- 실천 종류는 요일 수로 정해진다: 요일 1개 = 그날 할 일(못 하면 다음 날로 넘어감), 여러 요일 = 고른 요일마다 하는 반복.
-- 그래서 "이번 주에서 담기"(기간 안에 한 번 하는 실천)는 더 이상 생기지 않는다.
create function public.practices_set_kind() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.kind := case when cardinality(new.weekdays) > 1 then 'repeat' else 'once' end;
  return new;
end $$;
revoke execute on function public.practices_set_kind() from public, anon, authenticated;

create trigger practices_set_kind before insert on public.practices
  for each row execute function public.practices_set_kind();

update public.practices set kind = case when cardinality(weekdays) > 1 then 'repeat' else 'once' end
  where kind <> case when cardinality(weekdays) > 1 then 'repeat' else 'once' end;
alter table public.practices add constraint practices_kind_by_days check ((kind = 'repeat') = (cardinality(weekdays) > 1));

-- 담기(picked) 할 일은 더 이상 만들지 않는다
alter table public.tasks add constraint tasks_no_new_picked check (source <> 'picked') not valid;
