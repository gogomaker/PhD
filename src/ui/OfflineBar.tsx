import { useEffect, useSyncExternalStore } from 'react';

// 연결이 없으면 화면 맨 위에 작게 알린다 (2026-10-03 UT 4차 기획 요청).
// 띠 높이만큼 화면을 내려 앱바를 가리지 않게: <html>의 --offline-h 를 휴대폰·PC 바깥 틀이 쓴다
const H = '22px';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => { window.removeEventListener('online', onChange); window.removeEventListener('offline', onChange); };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}

export function OfflineBar() {
  const online = useOnline();
  useEffect(() => {
    document.documentElement.style.setProperty('--offline-h', online ? '0px' : H);
  }, [online]);
  if (online) return null;
  return (
    <div data-testid="offline-bar" role="status" style={{ position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0, height: H, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--color-neutral-800)', color: 'var(--color-neutral-100)', fontSize: 11.5, fontWeight: 600, letterSpacing: -0.1 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.2-1.6M1.4 9a16 16 0 0 1 4.6-2.9M22.6 9A16 16 0 0 0 10.7 5M12 20h.01" />
      </svg>
      오프라인 · 칠한 시간은 연결되면 저장돼요
    </div>
  );
}
