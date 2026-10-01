import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, type Goal } from '../../account/AccountProvider';
import { PALETTE } from '../../lib/palette';
import { isClosed } from '../../lib/goals';

/** 참고사항 열 색 */
export const NOTE = { bg: 'var(--color-neutral-200)', ink: 'var(--color-neutral-800)', dot: 'var(--color-neutral-500)' };
export type Tone = { bg: string; ink: string; dot: string };

/** 계획 표 열 = 목표. 마무리 전 + 표에 올림 + 세부목표 1개 이상 (R-G2, R-G8) */
export function useTableGoals() {
  const { goals, subgoals, goalCategories } = useAccount();
  const hasSubs = (id: string) => subgoals.some(s => s.goal_id === id);
  const open = goals.filter(g => !isClosed(g));
  const cols = open
    .filter(g => !g.table_hidden && hasSubs(g.id))
    .sort((a, b) => a.table_position - b.table_position || a.created_at.localeCompare(b.created_at));
  const hidden = open.filter(g => !cols.includes(g));
  const catOf = (g: Goal) => goalCategories.find(c => c.id === g.category_id);
  const toneOf = (g: Goal): Tone => PALETTE[catOf(g)?.color ?? 'red'];
  const subsOf = (goalId: string) => subgoals.filter(s => s.goal_id === goalId);
  return { cols, hidden, hasSubs, catOf, toneOf, subsOf };
}

export function useColumnActions() {
  const { run } = useAccount();
  const { cols } = useTableGoals();
  const all = async (reqs: PromiseLike<{ error: unknown }>[]) => {
    const r = await Promise.all(reqs);
    return { error: r.find(x => x.error)?.error ?? null };
  };
  return {
    move: (id: string, dir: -1 | 1) => {
      const ids = cols.map(g => g.id);
      const i = ids.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      run(() => all(ids.map((gid, pos) => supabase.from('goals').update({ table_position: pos }).eq('id', gid))));
    },
    hide: (id: string) => run(() => supabase.from('goals').update({ table_hidden: true }).eq('id', id)),
    show: (id: string) => {
      const pos = cols.length ? Math.max(...cols.map(g => g.table_position)) + 1 : 0;
      return run(() => supabase.from('goals').update({ table_hidden: false, table_position: pos }).eq('id', id));
    },
  };
}

const chevron = { left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6' };

export function Svg({ d, size = 14, style }: { d: string; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', ...style }}>
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  ...chevron,
  x: 'M18 6 6 18M6 6l12 12',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  down: 'M12 5v14M19 12l-7 7-7-7',
  up: 'M12 19V5M5 12l7-7 7 7',
  repeat: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
};

// 표 위쪽: 이름표·제목(앞뒤 이동)·설명 + 오른쪽 "+ 목표 열"
export function PlanHeader({ kicker, title, sub, onPrev, onNext, prevLabel, nextLabel, onToday, todayLabel }: {
  kicker: string;
  title: string;
  sub: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  onToday?: () => void;
  todayLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tag tag-accent-2" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>{kicker}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-icon" aria-label={prevLabel} title={prevLabel} onClick={onPrev} style={{ color: 'var(--color-neutral-700)' }}><Svg d={ICONS.left} size={18} /></button>
          <h1 style={{ margin: 0, fontSize: 42 }}>{title}</h1>
          <button className="btn btn-icon" aria-label={nextLabel} title={nextLabel} onClick={onNext} style={{ color: 'var(--color-neutral-700)' }}><Svg d={ICONS.right} size={18} /></button>
          {onToday && (
            <button className="btn btn-secondary" onClick={onToday} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, height: 32, padding: '0 12px', marginLeft: 4 }}>{todayLabel}</button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>{sub}</p>
      </div>
      <ColumnMenu />
    </div>
  );
}

// "+ 목표 열": 표에 없는 목표. 세부목표가 없으면 흐리게, 못 올림 (R-G2)
const OPEN_COLUMN_MENU = 'phd:open-column-menu';

export function ColumnMenu() {
  const { hidden, hasSubs, catOf, toneOf } = useTableGoals();
  const { show } = useColumnActions();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_COLUMN_MENU, on);
    return () => window.removeEventListener(OPEN_COLUMN_MENU, on);
  }, []);
  const anyEmpty = hidden.some(g => !hasSubs(g.id));
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontWeight: 700 }}>+ 목표 열</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <div role="menu" aria-label="표에 없는 목표" style={{ position: 'absolute', right: 0, top: 46, zIndex: 20, width: 280, background: 'var(--color-neutral-100)', borderRadius: 22, boxShadow: 'var(--shadow-lg)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', padding: '4px 10px 6px' }}>표에 없는 목표</span>
            {hidden.map(g => {
              const ok = hasSubs(g.id);
              return (
                <button
                  key={g.id}
                  role="menuitem"
                  className="btn menu-item"
                  disabled={!ok}
                  title={ok ? '' : '세부목표가 없어요'}
                  onClick={async () => { if (await show(g.id)) setOpen(false); }}
                  style={{ justifyContent: 'flex-start', gap: 10, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, padding: '9px 12px' }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: toneOf(g).dot, flex: 'none' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-neutral-600)', flex: 'none' }}>{catOf(g)?.name}</span>
                </button>
              );
            })}
            {hidden.length === 0 && <span style={{ fontSize: 13, padding: '6px 10px 10px' }}>모든 목표가 표에 있어요. <Link to="/goals">목표 설정</Link>에서 새 목표를 추가하세요.</span>}
            {anyEmpty && (
              <div style={{ margin: '4px 2px 2px', padding: '10px 12px', borderRadius: 16, background: 'var(--color-neutral-200)', fontSize: 12.5, lineHeight: 1.45, textWrap: 'pretty' }}>
                흐린 목표는 세부목표가 없어요. <Link to="/board" style={{ fontWeight: 700 }}>꿈 보드</Link>에서 세부목표를 먼저 추가해 주세요.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// 열이 하나도 없을 때
// 표에 열이 없을 때: 상황마다 한 줄 안내 + 다음 행동 버튼 하나 (SPEC 5장 공통)
export function NoColumns() {
  const { goals } = useAccount();
  const { hidden, hasSubs } = useTableGoals();
  const open = goals.filter(g => !isClosed(g));
  const [text, label, to]: [string, string, string | null] =
    goals.length === 0 ? ['먼저 목표를 적어 주세요', '목표 설정', '/goals']
    : open.length === 0 ? ['진행 중인 목표가 없어요. 새 목표를 적어 주세요', '목표 설정', '/goals']
    : hidden.some(g => hasSubs(g.id)) ? ['계획할 목표를 표에 올려 주세요', '+ 목표 열 추가', null]
    : ['꿈 보드에서 세부목표를 만든 목표만 열로 추가할 수 있어요', '꿈 보드로', '/board'];
  return (
    <div data-testid="no-columns" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', borderRadius: 28, padding: '20px 24px' }}>
      <span style={{ fontSize: 15, fontWeight: 600, textWrap: 'pretty' }}>{text}</span>
      {to ? <Link to={to} className="btn btn-primary">{label}</Link> : <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event(OPEN_COLUMN_MENU))}>{label}</button>}
    </div>
  );
}

// 표 틀: 가로로 넘치면 오른쪽 가장자리 그라데이션 (SPEC 5장 공통)
export function TableFrame({ columns, minWidth, rowHeight, children }: { columns: string; minWidth: number; rowHeight: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure);
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, []);
  return (
    <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 32, padding: 14 }}>
      <div ref={ref} data-plan-scroll style={{ overflowX: 'auto', padding: '16px 2px 4px' }}>
        <div data-testid="plan-grid" style={{ display: 'grid', gridTemplateColumns: columns, gridAutoRows: `minmax(${rowHeight}px, auto)`, gap: 5, minWidth }}>{children}</div>
      </div>
      <div style={{ position: 'absolute', top: 14, bottom: 14, right: 14, width: 56, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--color-surface))', opacity: fade ? 1 : 0, transition: 'opacity .15s', borderRadius: '0 18px 18px 0' }} />
    </div>
  );
}

// 열 머리: 목표명·카테고리, ‹ › 순서, × 숨기기
export function ColumnHeader({ col, name, sub, dot, goalId }: { col: number; name: string; sub: string; dot: string; goalId?: string }) {
  const { move, hide } = useColumnActions();
  return (
    <div data-testid="col-header" style={{ gridRow: 1, gridColumn: col, background: 'var(--color-neutral-100)', borderRadius: 16, padding: '9px 10px 8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>
        <span style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: dot }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--color-neutral-600)' }}>
        <span style={{ marginRight: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
        {goalId && (
          <>
            <button title="왼쪽으로" aria-label={name + ' 왼쪽으로'} onClick={() => move(goalId, -1)} className="btn mini-btn"><Svg d={ICONS.left} size={12} /></button>
            <button title="오른쪽으로" aria-label={name + ' 오른쪽으로'} onClick={() => move(goalId, 1)} className="btn mini-btn"><Svg d={ICONS.right} size={12} /></button>
            <button title="표에서 숨기기" aria-label={name + ' 표에서 숨기기'} onClick={() => hide(goalId)} className="btn mini-btn"><Svg d={ICONS.x} size={12} /></button>
          </>
        )}
      </div>
    </div>
  );
}

export function RowLabel({ row, label, sub, today, tone }: { row: number; label: string; sub?: string; today?: boolean; tone?: 'week' }) {
  const bg = tone === 'week' ? 'var(--color-accent-2-200)' : today ? 'var(--color-accent)' : 'var(--color-neutral-100)';
  const fg = tone === 'week' ? 'var(--color-accent-2-900)' : today ? 'var(--color-neutral-100)' : 'var(--color-text)';
  return (
    <div style={{ gridRow: row, gridColumn: 1, borderRadius: 16, padding: '6px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: bg, color: fg }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
      {sub && <span style={{ fontSize: 11.5, opacity: 0.75 }}>{sub}{today ? ' · 오늘' : ''}</span>}
    </div>
  );
}

// R-P3: 상위 계획 줄 (읽기 전용)
export type RefCell = { col: number; chip?: string; text?: string; tone: Tone } | { col: number; empty: true };
export function RefRow({ label, cells, emptyText, lastCol }: { label: string; cells: RefCell[]; emptyText: string; lastCol: number }) {
  const allEmpty = cells.every(c => 'empty' in c);
  return (
    <>
      <div style={{ gridRow: 2, gridColumn: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-700)', lineHeight: 1.35 }}>
        {label}
        <span style={{ fontWeight: 500, color: 'var(--color-neutral-600)' }}>상위 계획</span>
      </div>
      {allEmpty ? (
        <div data-testid="ref-empty" style={{ gridRow: 2, gridColumn: `2 / ${lastCol + 1}`, border: '2px dashed var(--color-neutral-300)', borderRadius: 16, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{emptyText}</div>
      ) : (
        cells.map(c =>
          'empty' in c ? (
            <div key={c.col} style={{ gridRow: 2, gridColumn: c.col, border: '2px dashed var(--color-neutral-300)', color: 'var(--color-neutral-500)', borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 600 }}>—</div>
          ) : (
            <div key={c.col} data-testid="ref-cell" style={{ gridRow: 2, gridColumn: c.col, minWidth: 0, border: '2px dashed ' + c.tone.dot, color: c.tone.ink, borderRadius: 16, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>
              {c.chip && <Chip tone={c.tone}>{c.chip}</Chip>}
              {c.text && <span>{c.text}</span>}
            </div>
          ),
        )
      )}
    </>
  );
}

export function Chip({ tone, children, white }: { tone: Tone; children: ReactNode; white?: boolean }) {
  return (
    <span style={{ flex: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, padding: '3px 8px', borderRadius: 999, background: white ? 'var(--color-neutral-100)' : tone.bg, color: tone.ink }}>{children}</span>
  );
}

// 칸 아래(또는 위)에 뜨는 팝오버. 바깥을 누르거나 Esc, 스크롤하면 닫힌다
export function Popover({ anchor, width, height, onClose, children }: { anchor: DOMRect; width: number; height: number; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const opened = performance.now();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // 칸을 누를 때 생긴 스크롤(화면 안으로 끌어오기)은 무시하고, 그 뒤 사용자가 스크롤하면 닫는다
    const scroll = (e: Event) => {
      if (performance.now() - opened < 400) return;
      if (!(e.target instanceof Node && document.querySelector('[data-plan-pop]')?.contains(e.target))) onClose();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); };
  }, [onClose]);
  const flip = anchor.bottom + height > window.innerHeight && anchor.top > height;
  const top = flip ? anchor.top - 6 : Math.max(10, Math.min(anchor.bottom + 6, window.innerHeight - height - 10));
  const left = Math.max(10, Math.min(anchor.left, window.innerWidth - width - 10));
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div data-plan-pop role="dialog" style={{ position: 'fixed', zIndex: 41, left, top, transform: flip ? 'translateY(-100%)' : 'none', width, maxHeight: 'calc(100vh - 20px)', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--color-neutral-100)', borderRadius: 22, boxShadow: 'var(--shadow-lg)', padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </>
  );
}

export function PopHead({ dot, title, hint }: { dot: string; title: string; hint: string }) {
  return (
    <div style={{ padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: dot }} />{title}</span>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{hint}</span>
    </div>
  );
}

/** 세부목표 목록 (팝오버). highlight는 상위 계획의 세부목표 → 맨 위 + 배지 (R-P5, R-P7) */
export function SubgoalPicker({ subs, highlight, badge, selected, tone, onPick }: { subs: { id: string; name: string }[]; highlight?: string | null; badge: string; selected?: string | null; tone: Tone; onPick: (id: string) => void }) {
  const ordered = [...subs].sort((a, b) => Number(b.id === highlight) - Number(a.id === highlight));
  return (
    <>
      {ordered.map(s => {
        const hl = s.id === highlight;
        const on = s.id === selected;
        return (
          <button key={s.id} type="button" className="btn menu-item" aria-pressed={on} onClick={() => onPick(s.id)} style={{ justifyContent: 'flex-start', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, padding: '9px 12px', textAlign: 'left', background: on || hl ? tone.bg : 'transparent', boxShadow: on ? 'inset 0 0 0 2px ' + tone.dot : 'none' }}>
            {on ? '✓ ' : ''}{s.name}
            {hl && <span style={{ marginLeft: 'auto', flex: 'none', fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, padding: '3px 8px', borderRadius: 999, background: 'var(--color-neutral-100)', color: tone.ink }}>{badge}</span>}
          </button>
        );
      })}
    </>
  );
}

/** 표 안 칸 선택 상태: 바깥을 누르거나 Esc면 풀린다 */
export function useSelection() {
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (!sel) return;
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(`[data-sel="${sel}"]`) && !t.closest('[data-plan-pop]') && !t.closest('[role="dialog"]')) setSel(null);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key); };
  }, [sel]);
  return [sel, setSel] as const;
}

// R-P12: 지난 기간은 잠김 안내
export function LockNote({ all }: { all: boolean }) {
  return (
    <div data-testid="lock-note" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)', fontSize: 13, fontWeight: 600 }}>
      {all ? '지난 계획은 볼 수만 있어요' : '지난 기간(빗금 칸)은 수정할 수 없어요'}
    </div>
  );
}
