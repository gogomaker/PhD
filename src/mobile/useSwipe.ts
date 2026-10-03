import { useEffect, type RefObject } from 'react';

// 옆으로 밀어 넘기기 (2026-10-03 UT 6): 지류 다이어리처럼 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전.
// 시간표(칠하기)·입력 칸·가로로 스크롤되는 줄([data-no-swipe])에서 시작한 손짓은 무시한다
export function useSwipe(ref: RefObject<HTMLElement | null>, onPrev: () => void, onNext: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (e.touches.length !== 1 || target.closest('[data-no-swipe], [data-testid="time-grid"], input, textarea, select, [role="slider"], [role="dialog"]')) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const quick = Date.now() - start.t < 700;
      start = null;
      if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0) onNext();
      else onPrev();
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchend', up, { passive: true });
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchend', up);
    };
  }, [ref, onPrev, onNext]);
}
