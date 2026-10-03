// PC '오늘' (2026-10-03 UT 7): 휴대폰 기록 › 오늘을 PC 폭에 맞게 넓게. 마우스로 체크·칠하기·계획 그리기·하루 기록
// 시트(직접 추가·하루 기록 등)는 이 판 안에서 아래에서 올라온다
import { useEffect } from 'react';
import TodayTab from '../mobile/record/TodayTab';
import { typing } from './plan/undo';
import { SideDday } from './Dday';

export default function TodayPage() {
  // ← → 키로 전날·다음 날 (입력 중이거나 시트가 열려 있으면 그대로, 2026-10-03 UT 2차)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || typing() || document.querySelector('[data-testid="pc-today"] [role="dialog"]')) return;
      const b = document.querySelector<HTMLButtonElement>(`[data-testid="pc-today"] button[aria-label="${e.key === 'ArrowLeft' ? '전날' : '다음 날'}"]`);
      if (b) { e.preventDefault(); b.click(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1040 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="tag tag-accent" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>기록 · 오늘</span>
          <h1 style={{ margin: 0, fontSize: 42 }}>오늘의 10분</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>10분 칸을 끌어 칠하면 무엇을 했는지 골라요. ← → 키로 날짜를 넘겨요. 휴대폰 '기록 › 오늘'과 같은 기록이에요.</p>
        </div>
        <div style={{ width: 240 }}><SideDday /></div>
      </div>
      <div data-testid="pc-today" style={{ position: 'relative', height: 'max(640px, calc(100vh - 230px))', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', borderRadius: 32, padding: '16px 8px 8px', overflow: 'hidden' }}>
        <TodayTab base="/today" weekPath="/plan/week" wide />
        {/* 시트가 그려지는 층: 이 판 안 */}
        <div id="m-sheet-root" style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}
