-- 2026-10-03 UT: 오늘의 '실제 시간'은 지금 칸까지만 칠할 수 있다 (아직 오지 않은 시간은 실제가 아님)
-- 칸 = 하루 시작 시각부터 10분 단위 (0~143). 기기 시계가 조금 빠를 수 있어 한 칸 여유를 둔다

-- 지금이 오늘의 몇 번째 칸인지 (사용자 시간대 + 하루 시작 시각, R-D1)
create function public.user_now_slot() returns int
language sql stable security definer set search_path = '' as $$
  select floor(extract(epoch from (
           ((now() at time zone p.timezone) - make_interval(hours => p.day_start_hour))
           - date_trunc('day', (now() at time zone p.timezone) - make_interval(hours => p.day_start_hour))
         )) / 600)::int
  from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.user_now_slot() from public, anon;
grant execute on function public.user_now_slot() to authenticated;

-- 직접 넣기도 같은 규칙 (실제 = 오늘, 지금 칸 + 1까지)
drop policy "time_blocks: 허용된 날만 추가" on public.time_blocks;
create policy "time_blocks: 허용된 날만 추가" on public.time_blocks for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.block_refs_ok(task_id, daily_keyword_id)
    and case layer
          when 'plan' then public.day_offset(date) between 0 and 1
          else public.day_offset(date) = 0 and end_slot <= public.user_now_slot() + 1
        end
  );

-- 하루치 저장: 아직 오지 않은 실제 칸이 있으면 알아볼 수 있는 오류로
create or replace function public.save_day_blocks(p_date date, p_layer text, p_blocks jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  off int := public.day_offset(p_date);
begin
  if off < 0 or off > 1 or (p_layer = 'actual' and off <> 0) then
    raise exception 'day_locked' using hint = '이 날은 시간표를 바꿀 수 없어요';
  end if;
  if p_layer = 'actual' and exists (
    select 1 from jsonb_array_elements(p_blocks) b where (b ->> 'end')::int > public.user_now_slot() + 1
  ) then
    raise exception 'future_time' using hint = '아직 오지 않은 시간은 칠할 수 없어요';
  end if;
  delete from public.time_blocks where user_id = auth.uid() and date = p_date and layer = p_layer;
  insert into public.time_blocks (date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key)
    select p_date, p_layer, (b ->> 'start')::smallint, (b ->> 'end')::smallint,
           nullif(b ->> 'task_id', '')::uuid, nullif(b ->> 'keyword_id', '')::uuid, nullif(btrim(b ->> 'label'), ''), b ->> 'key'
    from jsonb_array_elements(p_blocks) b;
end $$;
