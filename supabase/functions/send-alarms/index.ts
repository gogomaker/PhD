// 예약 할 일 알람 보내기 (R-T3). pg_cron이 1분마다 부른다.
// 필요한 비밀값(Edge Function secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const hm = (t: string) => t.slice(0, 5);

Deno.serve(async () => {
  const { data: due, error } = await db.rpc('claim_due_alarms');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const a of due ?? []) {
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', a.user_id);
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: a.name, body: `${hm(a.start_time)}–${hm(a.end_time)} 예약한 일이에요`, tag: a.task_id, url: '/' }),
          { TTL: 600 },
        );
        sent++;
      } catch (e) {
        // 더 이상 쓰지 않는 기기는 지운다
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
  }
  return Response.json({ due: due?.length ?? 0, sent });
});
