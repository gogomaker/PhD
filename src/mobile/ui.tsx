// 모바일 공통 부품 (docs/MOBILE.md). 생김새 기준: 'PhD only for Mobile v2' 목업
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScrollArea } from '../ui/ScrollArea';
import type { Tone } from '../desktop/plan/shared';

export const H = { fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, lineHeight: 1.2 } as const;
export const BODY = { fontFamily: 'var(--font-body)', fontWeight: 700 } as const;

/** 고른 칩 = 목표 색, 아니면 카드 면 */
export const chip = (on: boolean, tone: Tone) => ({ background: on ? tone.bg : 'var(--color-surface)', color: on ? tone.ink : 'var(--color-text)', boxShadow: on ? 'inset 0 0 0 2px ' + tone.dot : 'none' });

// ───────── 아래에서 올라오는 시트 ─────────
// 열면 기록(history)에 한 칸을 넣어서 휴대폰 '뒤로'로 닫힌다. 화면 전체(앱바 포함)를 덮도록 앱 맨 위 층(#m-sheet-root)에 그린다
let seq = 0;
const alive = new Set<string>();
const histState = () => (window.history.state ?? {}) as { usr?: { sheet?: string } | null; idx?: number };

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  const [id] = useState(() => 'sheet' + ++seq);
  const navigate = useNavigate();
  const loc = useLocation();
  /** 이 시트가 넣은 기록 칸의 위치. 뒤로 가서 이보다 앞으로 가면 닫는다 */
  const myIdx = useRef<number | null>(null);
  const closeRef = useRef<() => unknown>(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    alive.add(id);
    const cur = histState().usr?.sheet;
    if (cur !== id) {
      // 방금 닫힌 시트 자리(또는 새로 고침 전에 남은 칸)는 바꿔 끼우고, 열린 시트 위에 여는 것이면 하나 더 쌓는다
      navigate(loc.pathname + loc.search, { state: { sheet: id }, replace: !!cur && !alive.has(cur) });
      myIdx.current = histState().idx ?? null;
    }
    return () => {
      alive.delete(id);
      // 화면에서 닫았으면(뒤로 가기가 아니면) 넣어 둔 기록 한 칸을 되돌린다. StrictMode 재실행은 건너뛴다
      setTimeout(() => {
        if (!alive.has(id) && histState().usr?.sheet === id) navigate(-1);
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idx = histState().idx;
    if (myIdx.current != null && idx != null && idx < myIdx.current) {
      myIdx.current = null;
      closeRef.current();
    }
  }, [loc]);

  // 위쪽 손잡이를 끌어내려 닫기 (누르기만 해도 닫힘). 손을 떼면 많이 내렸거나 빠르게 내렸을 때만 닫고, 아니면 제자리로
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; h: number; d: number } | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [h, setH] = useState(600);
  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setDy(sheetRef.current?.offsetHeight ?? 600);
    // 저장에 실패하는 등으로 시트가 남아 있으면 제자리로 (예: 하루 기록은 닫을 때 저장)
    setTimeout(async () => {
      await closeRef.current();
      setLeaving(false);
      setDy(0);
    }, 200);
  };
  const handle = {
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => {
      if (leaving) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { y: e.clientY, t: performance.now(), h: sheetRef.current?.offsetHeight ?? 600, d: 0 };
      setH(drag.current.h);
      setDragging(true);
    },
    onPointerMove: (e: RPointerEvent<HTMLDivElement>) => {
      const g = drag.current;
      if (!g) return;
      g.d = Math.max(0, e.clientY - g.y);
      setDy(g.d);
    },
    onPointerUp: () => {
      const g = drag.current;
      drag.current = null;
      setDragging(false);
      if (!g) return;
      const speed = g.d / Math.max(1, performance.now() - g.t);
      if (g.d < 6 || g.d > Math.min(120, g.h * 0.25) || (speed > 0.5 && g.d > 24)) dismiss();
      else setDy(0);
    },
    onPointerCancel: () => { drag.current = null; setDragging(false); setDy(0); },
  };
  const root = document.getElementById('m-sheet-root');
  const body = (
    <>
      <div className="m-scrim" onClick={dismiss} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: leaving ? 'none' : 'auto', opacity: dy ? Math.max(0, 1 - dy / h) : 1, transition: dragging ? 'none' : 'opacity .2s ease' }} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={label}
        className="m-sheet"
        data-testid="m-sheet"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%', display: 'flex', flexDirection: 'column', background: 'var(--color-neutral-100)', borderRadius: '32px 32px 0 0', boxShadow: 'var(--shadow-lg)', pointerEvents: leaving ? 'none' : 'auto', overflow: 'hidden', transform: dy ? `translateY(${dy}px)` : undefined, transition: dragging ? 'none' : 'transform .2s ease' }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="끌어내리면 닫혀요"
          data-testid="sheet-handle"
          {...handle}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), dismiss())}
          style={{ flex: 'none', height: 28, display: 'grid', placeItems: 'center', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <span style={{ width: 40, height: 5, borderRadius: 99, background: 'var(--color-neutral-300)' }} />
        </div>
        <ScrollArea
          fade="var(--color-neutral-100)"
          style={{ flex: '1 1 auto', minHeight: 0 }}
          innerStyle={{ padding: '4px 20px max(30px, env(safe-area-inset-bottom))', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {children}
        </ScrollArea>
      </div>
    </>
  );
  return root ? createPortal(body, root) : body;
}

/** 시트 머리: 제목 + 작은 설명 */
export function SheetHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={H}>{title}</span>
        {sub && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{sub}</span>}
      </div>
      {right}
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: ReactNode; children: ReactNode; hint?: ReactNode; required?: boolean }) {
  return (
    <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ margin: 0 }}>{label}{required && <span style={{ color: 'var(--color-accent-700)' }}> · 필수</span>}</label>
      {children}
      {hint && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>{hint}</span>}
    </div>
  );
}

// ───────── 탭 제목 (목표 · 일정 / 오늘 · 돌아보기) ─────────
export function TabTitles<K extends string>({ tabs, cur, onPick, right }: { tabs: [K, string][]; cur: K; onPick: (k: K) => void; right?: ReactNode }) {
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 18, padding: '4px 22px 12px' }} role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={cur === k} onClick={() => onPick(k)} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, lineHeight: 1.15, letterSpacing: '-0.02em', color: cur === k ? 'var(--color-text)' : 'var(--color-neutral-500)', transition: 'color .2s' }}>{label}</button>
      ))}
      {right && <div style={{ marginLeft: 'auto', minWidth: 0, display: 'flex' }}>{right}</div>}
    </div>
  );
}

/** 알약 모양 고르기 (연간·월간·주간, 이번 주·이번 달) */
export function Seg<K extends string>({ options, cur, onPick, tone = 'accent-2', label }: { options: [K, string][]; cur: K; onPick: (k: K) => void; tone?: 'accent' | 'accent-2'; label: string }) {
  return (
    <div role="group" aria-label={label} style={{ flex: 'none', display: 'flex', padding: 3, gap: 2, borderRadius: 999, background: 'var(--color-surface)' }}>
      {options.map(([k, l]) => {
        const on = cur === k;
        return (
          <button key={k} aria-pressed={on} onClick={() => onPick(k)} style={{ height: 34, padding: '0 15px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 13, background: on ? `var(--color-${tone})` : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-text)', transition: 'background-color .2s' }}>{l}</button>
        );
      })}
    </div>
  );
}

// ───────── 밀려 들어오는 화면의 머리 ─────────
export function PageBar({ back, onBack, right }: { back: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 18px 10px 8px', minHeight: 44 }}>
      <button onClick={onBack} className="btn m-hover" style={{ height: 40, padding: '0 12px 0 6px', gap: 2, ...BODY, fontSize: 14, color: 'var(--color-neutral-800)' }}>
        <Svg d={ICON.left} size={18} />{back}
      </button>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// ───────── 아이콘 (Lucide, 굵기 2.75) ─────────
export const ICON = {
  left: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  repeat: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
};

export function Svg({ d, size = 16, width = 2.75, style }: { d: string; size?: number; width?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', ...style }}>
      <path d={d} />
    </svg>
  );
}

/** 목표 색 점 */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ flex: 'none', width: size, height: size, borderRadius: '50%', background: color }} />;
}

/** 카드 면 위의 한 줄 안내 + 다음 행동 (SPEC 5장 공통 빈 상태) */
export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ flex: 'none', padding: '14px 16px', borderRadius: 20, background: 'var(--color-surface)', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-800)', textWrap: 'pretty', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <span>{children}</span>
      {action}
    </div>
  );
}

/** 토글 스위치 */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{ flex: 'none', width: 52, height: 30, borderRadius: 999, border: 0, padding: 3, cursor: 'pointer', background: on ? 'var(--color-accent-2)' : 'var(--color-neutral-400)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-neutral-100)', boxShadow: 'var(--shadow-sm)' }} />
    </button>
  );
}
