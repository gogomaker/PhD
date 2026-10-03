// PhD 서비스 워커
// 1) 예약 할 일 알람(웹 푸시)을 받아 보여주고, 누르면 앱을 연다 (R-T3)
// 2) 연결이 없어도 앱이 열리게 화면 파일을 이 기기에 둔다 (2026-10-03 UT 4차). 데이터(Supabase)는 여기서 다루지 않는다
const CACHE = 'phd-app-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(precache());
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/** 지금 배포의 화면 파일을 받아 두고, 더 쓰지 않는 옛 파일은 지운다 */
async function precache() {
  try {
    const res = await fetch('/asset-list.json', { cache: 'no-store' });
    if (!res.ok) return;
    const list = await res.json();
    const cache = await caches.open(CACHE);
    const have = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
    await Promise.all(list.filter(p => !have.has(p)).map(p => cache.add(p).catch(() => {})));
    const keep = new Set(list);
    for (const r of await cache.keys()) {
      const p = new URL(r.url).pathname;
      if (p.startsWith('/assets/') && !keep.has(p) && !p.endsWith('.woff2')) await cache.delete(r);
    }
    await cache.put('/', await fetch('/', { cache: 'no-store' }));
  } catch {
    /* 연결이 없으면 다음 기회에 */
  }
}
// 화면이 열릴 때마다 새 배포가 있으면 받아 둔다
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'precache') e.waitUntil(precache());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 화면 이동: 먼저 서버, 안 되면 받아 둔 앱
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); }
          return res;
        })
        .catch(() => caches.match('/').then(r => r || Response.error())),
    );
    return;
  }
  // 이름에 내용 지문이 붙은 파일: 받아 둔 게 있으면 그걸로
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }
  // 아이콘·manifest 등: 받아 둔 것을 먼저 보이고 뒤에서 새로
  if (/\.(png|svg|webmanifest|json)$/.test(url.pathname) && url.pathname !== '/asset-list.json') {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      }),
    );
  }
});

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
