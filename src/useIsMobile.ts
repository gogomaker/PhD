import { useSyncExternalStore } from 'react';

// 이 폭보다 좁으면 모바일 하루 플래너, 넓으면 데스크톱 계획 화면 (SPEC 2.1)
const QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
