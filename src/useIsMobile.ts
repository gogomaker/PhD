import { useSyncExternalStore } from 'react';

// 휴대폰이면 모바일 앱, 아니면 데스크톱 계획 화면 (SPEC 2.1)
// - 마우스로 쓰는 기기(PC): 창 폭 600px 미만일 때만 모바일. 반쯤 줄인 창은 PC 화면에 사이드바만 접힌다 (2026-10-03 UT 12)
// - 손가락으로 쓰는 기기: 폭 768px 미만이거나, 짧은 변이 768px 미만이면(가로로 돌린 휴대폰) 모바일 (2026-10-03 UT 1)
const FINE = '(pointer: fine) and (hover: hover)';

export function isMobileNow() {
  const w = window.innerWidth, h = window.innerHeight;
  if (window.matchMedia(FINE).matches) return w < 600;
  return w < 768 || Math.min(w, h) < 768;
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(FINE);
  mq.addEventListener('change', onChange);
  window.addEventListener('resize', onChange);
  return () => { mq.removeEventListener('change', onChange); window.removeEventListener('resize', onChange); };
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, isMobileNow);
}

// 휴대폰을 가로로 돌렸는지 — 휴대폰은 세로로만 쓴다 (2026-10-03 UT 3차 기획 결정).
// 기기 방향(screen.orientation)으로 보므로 세로에서 글쇠판이 올라와 화면이 낮아져도 가로로 치지 않는다
export function isPhoneLandscapeNow() {
  if (window.matchMedia(FINE).matches) return false;
  const w = window.innerWidth, h = window.innerHeight;
  if (Math.min(w, h) >= 768 || w <= h) return false;
  const type = window.screen.orientation?.type;
  return type ? type.startsWith('landscape') : true;
}

function subscribeOrientation(onChange: () => void) {
  window.addEventListener('resize', onChange);
  window.screen.orientation?.addEventListener('change', onChange);
  return () => { window.removeEventListener('resize', onChange); window.screen.orientation?.removeEventListener('change', onChange); };
}

export function usePhoneLandscape() {
  return useSyncExternalStore(subscribeOrientation, isPhoneLandscapeNow);
}
