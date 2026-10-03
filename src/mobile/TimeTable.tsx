import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { paint, segments, SLOTS, timeOf } from '../lib/today';

export type Cells = (string | null)[];
export type PlanBoxView = { name: string; dot?: string; alarm?: boolean };
export type BandView = { dot: string; mark: string };

const ALARM = 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3 2 6M22 6l-3-3';

/** 구간을 한 시간 줄 단위로 나눈다 (R-S4: 줄마다 도형 하나, 이름·번호는 첫 줄에만) */
function pieces(cells: Cells) {
  return segments(cells).flatMap(run => {
    const out: { value: string; row: number; col: number; len: number; first: boolean }[] = [];
    for (let i = run.start; i <= run.end; ) {
      const row = Math.floor(i / 6);
      const end = Math.min(run.end, row * 6 + 5);
      out.push({ value: run.value, row, col: i % 6, len: end - i + 1, first: i === run.start });
      i = end + 1;
    }
    return out;
  });
}

function fmtLen(n: number) {
  const m = n * 10;
  return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ' ' + (m % 60) + '분' : ''}` : `${m}분`;
}

/**
 * 10분 시간표 (R-S1~S9). 계획 = 회색 테두리 네모, 실제 = 형광펜 띠(계획 아래 층).
 * 드래그는 형광펜 방식(R-S5): 누른 칸부터 현재 칸까지, 되돌리면 드래그 전 상태로.
 */
export function TimeTable({ dayStart, mode, canPlan, canAct, actualUntil = SLOTS - 1, brush, plan, actual, reserved, planView, bandView, hint, onPreview, onPlanTap, onPlanDrawn, onCommit }: {
  dayStart: number;
  mode: 'plan' | 'actual';
  canPlan: boolean;
  canAct: boolean;
  /** 실제는 이 칸까지만 칠한다 (오늘의 지금 칸). 그 뒤는 지우기만 */
  actualUntil?: number;
  brush: string | null;
  plan: Cells;
  actual: Cells;
  /** 예약 할 일 칸: 값 = 'res:<할 일 id>' */
  reserved: Cells;
  planView: (key: string) => PlanBoxView;
  bandView: (value: string) => BandView;
  hint: string;
  onPreview: (layer: 'plan' | 'actual', cells: Cells) => void;
  onPlanTap: (key: string) => void;
  onPlanDrawn: (cells: Cells, key: string) => void;
  onCommit: (layer: 'plan' | 'actual', cells: Cells) => void;
}) {
  const drag = useRef<{ layer: 'plan' | 'actual'; start: number; cur: number; value: string | null; snap: Cells; tap: string | null } | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const skip = reserved.map(Boolean);
  const future = Array.from({ length: SLOTS }, (_, i) => i > actualUntil);
  const [note, setNote] = useState<string | null>(null);
  const skipOf = (g: { layer: 'plan' | 'actual'; value: string | null }) => (g.layer === 'plan' ? skip : g.value ? future : undefined);

  const cellAt = (e: RPointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const v = el?.getAttribute?.('data-i');
    return v == null ? -1 : Number(v);
  };
  const apply = (i: number) => {
    const g = drag.current;
    if (!g || i < 0 || i === g.cur) return;
    g.cur = i;
    onPreview(g.layer, paint(g.snap, g.start, i, g.value, skipOf(g)));
    setRange([Math.min(g.start, i), Math.max(g.start, i)]);
  };
  const down = (e: RPointerEvent) => {
    const i = cellAt(e);
    if (i < 0) return;
    if (mode === 'plan') {
      if (!canPlan || skip[i]) return;
      const ex = plan[i];
      drag.current = { layer: 'plan', start: i, cur: -1, value: ex ? null : 'b' + Date.now().toString(36), snap: plan.slice(), tap: ex };
    } else {
      if (!canAct || !brush) return;
      // 아직 오지 않은 시간에서는 칠하기를 시작하지 않는다 (칠해 둔 칸 지우기는 된다)
      if (future[i] && actual[i] !== brush) {
        setNote('아직 오지 않은 시간은 칠할 수 없어요');
        return;
      }
      // 같은 것으로 이미 칠한 칸에서 시작하면 지우기, 아니면 덮어 칠하기 (R-S5, R-S7)
      drag.current = { layer: 'actual', start: i, cur: -1, value: actual[i] === brush ? null : brush, snap: actual.slice(), tap: null };
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    apply(i);
  };
  const up = () => {
    const g = drag.current;
    drag.current = null;
    setRange(null);
    if (!g) return;
    const cells = paint(g.snap, g.start, g.cur, g.value, skipOf(g));
    if (g.layer === 'plan' && g.tap && g.cur === g.start) {
      onPreview('plan', g.snap);
      onPlanTap(g.tap);
    } else if (g.layer === 'plan' && g.value) onPlanDrawn(cells, g.value);
    else onCommit(g.layer, cells);
  };

  const editable = mode === 'plan' ? canPlan : canAct && !!brush;
  const rangeHint = range ? `${timeOf(range[0], dayStart)} – ${timeOf(range[1] + 1, dayStart)} · ${fmtLen(range[1] - range[0] + 1)}` : note ?? hint;
  const showFuture = mode === 'actual' && canAct && actualUntil < SLOTS - 1;

  // 계획 층: 예약 블록(알람)과 그린 블록. 이름은 첫 줄 중 3칸 이상인 곳에, 20분 이하는 생략 (R-S3)
  const planCells = plan.map((v, i) => reserved[i] ?? v);
  const shown = new Set<string>();
  const boxes = pieces(planCells).map(p => {
    const v = planView(p.value);
    const runKey = p.value;
    const showName = !shown.has(runKey) && p.len > 2 && !!v.name;
    if (showName) shown.add(runKey);
    return { ...p, ...v, showName };
  });
  const bands = pieces(actual).map(p => ({ ...p, ...bandView(p.value) }));

  return (
    <>
      <span data-testid="grid-hint" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-neutral-700)', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rangeHint}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '20px repeat(6, minmax(0,1fr))', fontSize: 9, fontWeight: 700, color: 'var(--color-neutral-600)', textAlign: 'center', height: 12, alignItems: 'center' }}>
        <span />
        {[10, 20, 30, 40, 50, 60].map(m => <span key={m}>{m}</span>)}
      </div>
      <div
        data-testid="time-grid"
        onPointerDown={e => { setNote(null); down(e); }}
        onPointerMove={e => drag.current && apply(cellAt(e))}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '20px repeat(6, minmax(0,1fr))', gridTemplateRows: 'repeat(24, minmax(0,1fr))', borderTop: '1px solid var(--color-neutral-400)', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: editable ? 'crosshair' : 'default' }}
      >
        {Array.from({ length: 24 }, (_, r) => {
          const h = (r + dayStart) % 24;
          return (
            <span key={'h' + r} style={{ gridColumn: 1, gridRow: r + 1, fontSize: 9.5, fontWeight: 700, color: h === 12 || h === 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {String(h).padStart(2, '0')}
            </span>
          );
        })}
        {/* R-S2: 얇은 선, 칸 사이 틈 없음, 30분 위치 점선 */}
        {Array.from({ length: SLOTS }, (_, i) => {
          const c = i % 6;
          return <div key={i} data-i={i} data-future={(showFuture && future[i]) || undefined} style={{ gridColumn: c + 2, gridRow: Math.floor(i / 6) + 1, background: showFuture && future[i] ? 'color-mix(in oklch, var(--color-neutral-400) 22%, transparent)' : undefined, borderRight: c === 5 ? 'none' : c === 2 ? '1px dashed var(--color-neutral-400)' : '1px solid var(--color-neutral-200)', borderBottom: '1px solid var(--color-neutral-400)' }} />;
        })}
        {/* 실제: 형광펜 띠 (칸 높이 약 70%) */}
        {bands.map(b => (
          <div key={`a${b.row}-${b.col}`} data-testid="actual-band" style={{ gridRow: b.row + 1, gridColumn: `${b.col + 2} / span ${b.len}`, pointerEvents: 'none', zIndex: 1, alignSelf: 'center', height: '70%', background: `color-mix(in oklch, ${b.dot} 55%, transparent)` }} />
        ))}
        {/* 번호 동그라미: 첫 줄, 구간 오른쪽 끝 (R-S8, R-S9) */}
        {bands.filter(b => b.first && b.mark).map(b => (
          <div key={`m${b.row}-${b.col}`} data-testid="actual-mark" style={{ gridRow: b.row + 1, gridColumn: `${b.col + b.len + 1} / span 1`, pointerEvents: 'none', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 1 }}>
            <span style={{ flex: 'none', width: 14, height: 14, boxSizing: 'border-box', borderRadius: '50%', border: '1.5px solid ' + b.dot, background: 'var(--color-surface)', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800, lineHeight: 1, color: 'var(--color-text)' }}>{b.mark}</span>
          </div>
        ))}
        {/* 계획: 회색 테두리 네모 (실제 위 층) */}
        {boxes.map(b => (
          <div key={`p${b.row}-${b.col}`} data-testid="plan-box" style={{ gridRow: b.row + 1, gridColumn: `${b.col + 2} / span ${b.len}`, pointerEvents: 'none', zIndex: 2, margin: '2px 1px', boxSizing: 'border-box', border: '1.5px solid var(--color-neutral-600)', borderRadius: 4, background: 'color-mix(in oklch, var(--color-neutral-400) 18%, transparent)', display: 'flex', alignItems: 'center', gap: 2, padding: '0 3px', minWidth: 0, overflow: 'hidden', fontSize: 10, fontWeight: 700, lineHeight: 1, color: 'var(--color-neutral-900)' }}>
            {b.showName && b.dot && <span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: b.dot }} />}
            {b.showName && b.alarm && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-label="알람"><path d={ALARM} /></svg>
            )}
            {b.showName && <span data-testid="plan-name" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
