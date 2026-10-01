-- M4. 예약 할 일 알람 (R-T3): 웹 푸시
-- 흐름: 휴대폰이 알림을 허락하면 push_subscriptions에 저장 → 1분마다 pg_cron이 Edge Function(send-alarms)을 부름
--       → 시각이 된 예약 할 일을 골라(claim_due_alarms) 그 사람의 휴대폰들로 푸시를 보낸다.

-- R-D1: 어떤 시각이 사용자에게 "어느 날"인지 (시간대 + 하루 시작 시각). user_today()는 지금 시각에 이걸 쓴 것
create function public.user_day_at(p_user uuid, ts timestamptz) returns date
language sql stable security definer set search_path = '' as $$
  select ((ts at time zone p.timezone) - make_interval(hours => p.day_start_hour))::date
  from public.profiles p where p.id = p_user;
$$;
revoke execute on function public.user_day_at(uuid, timestamptz) from public, anon;
grant execute on function public.user_day_at(uuid, timestamptz) to authenticated;

create or replace function public.user_today() returns date
language sql stable security definer set search_path = '' as $$
  select public.user_day_at(auth.uid(), now());
$$;

-- 예약 할 일의 실제 알람 시각. 하루 시작 시각보다 이른 시각(예: 05시 시작인데 01:00)은 달력으로 다음 날이다
create function public.task_alarm_at(t public.tasks) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select ((t.date + case when extract(hour from t.start_time) < p.day_start_hour then 1 else 0 end) + t.start_time) at time zone p.timezone
  from public.profiles p where p.id = t.user_id;
$$;
revoke execute on function public.task_alarm_at(public.tasks) from public, anon, authenticated;

-- ───────── 알림 받을 기기 ─────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth) on table public.push_subscriptions to authenticated;
grant update (p256dh, auth) on table public.push_subscriptions to authenticated;
create policy "push: 본인만 읽기" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push: 본인만 추가" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "push: 본인만 고치기" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push: 본인만 삭제" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- ───────── 보낼 알람 고르기 (서버 전용) ─────────
-- 시각이 됐고(15분 안), 아직 안 보냈고, 끝내지 않은 예약 할 일. 고르면서 "보냄"으로 표시해 두 번 보내지 않는다
create function public.claim_due_alarms() returns table (task_id uuid, user_id uuid, name text, start_time time, end_time time)
language sql security definer set search_path = '' as $$
  update public.tasks t set alarm_sent_at = now()
  where t.is_timed and t.alarm and t.alarm_sent_at is null and t.done_at is null
    and t.date between current_date - 2 and current_date + 2
    and public.task_alarm_at(t) <= now() and public.task_alarm_at(t) > now() - interval '15 minutes'
  returning t.id, t.user_id, t.name, t.start_time, t.end_time;
$$;
revoke execute on function public.claim_due_alarms() from public, anon, authenticated;
grant execute on function public.claim_due_alarms() to service_role;

-- ───────── 1분마다 실행 ─────────
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'send-alarms',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://vvhpabbqiguuobpivdbf.supabase.co/functions/v1/send-alarms',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aHBhYmJxaWd1dW9icGl2ZGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4Mjk2MDIsImV4cCI6MjEwNjQwNTYwMn0.pa4PjbgpyA4H3zPTPXHyHLxgix5mytZ1QNZKg_DOj5Q'),
       body := '{}'::jsonb
     ) $$
);
