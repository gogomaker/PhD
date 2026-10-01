// 예약 할 일 알람 (R-T3): 웹 푸시. 알림은 서버(Supabase Edge Function)가 시각에 맞춰 보낸다
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export function pushSupported() {
  return !!VAPID_PUBLIC && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** 알림 허락을 받고 이 기기를 알림 받을 곳으로 저장한다. 사용자가 누른 직후에 불러야 한다 */
export async function ensurePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (perm !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC!) }));
    const j = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }, { onConflict: 'endpoint' });
    return !error;
  } catch {
    return false;
  }
}
