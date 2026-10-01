// 예약 할 일 알람(R-T3)과 회고 알림(매일 정한 시각, 그날 하루 기록을 아직 안 썼으면) 보내기. pg_cron이 1분마다 부른다.
// 필요한 비밀값(Edge Function secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const hm = (t: string) => t.slice(0, 5);

type Payload = { title: string; body: string; tag: string; url: string };

async function sendTo(userId: string, payload: Payload) {
  let sent = 0;
  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 600 });
      sent++;
    } catch (e) {
      // 더 이상 쓰지 않는 기기는 지운다
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return sent;
}

Deno.serve(async () => {
  const [alarms, reviews] = await Promise.all([db.rpc('claim_due_alarms'), db.rpc('claim_due_reviews')]);
  if (alarms.error || reviews.error) return Response.json({ error: (alarms.error ?? reviews.error)!.message }, { status: 500 });
  let sent = 0;
  for (const a of alarms.data ?? []) {
    sent += await sendTo(a.user_id, { title: a.name, body: `${hm(a.start_time)}–${hm(a.end_time)} 예약한 일이에요`, tag: a.task_id, url: '/' });
  }
  for (const r of reviews.data ?? []) {
    sent += await sendTo(r.user_id, { title: '오늘 하루를 돌아볼 시간이에요', body: '시간표를 칠하고 하루 기록을 남겨요.', tag: 'review', url: '/' });
  }
  return Response.json({ alarms: alarms.data?.length ?? 0, reviews: reviews.data?.length ?? 0, sent });
});
