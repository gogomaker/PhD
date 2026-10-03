import { useSyncExternalStore } from 'react';

// 휴대폰이면 모바일 앱, 아니면 데스크톱 계획 화면 (SPEC 2.1)
// - 폭 768px 미만이면 모바일
// - 터치가 주된 기기(손가락)이고 짧은 변이 768px 미만이면, 가로로 돌려 폭이 넓어져도 모바일 (2026-10-03 UT: 회전하면 PC 화면으로 바뀌던 문제)
const QUERIES = ['(max-width: 767px)', '(pointer: coarse) and (hover: none) and (max-height: 767px)'];

function subscribe(onChange: () => void) {
  const mqs = QUERIES.map(q => window.matchMedia(q));
  mqs.forEach(mq => mq.addEventListener('change', onChange));
  return () => mqs.forEach(mq => mq.removeEventListener('change', onChange));
}

const isMobile = () => QUERIES.some(q => window.matchMedia(q).matches);

export function useIsMobile() {
  return useSyncExternalStore(subscribe, isMobile);
}
