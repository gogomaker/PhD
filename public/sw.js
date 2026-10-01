// PhD 서비스 워커: 예약 할 일 알람(웹 푸시)을 받아 보여주고, 누르면 앱을 연다 (R-T3)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(d.title || 'PhD', {
      body: d.body || '',
      tag: d.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: d.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
