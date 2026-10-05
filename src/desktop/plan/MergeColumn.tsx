import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BlurInput } from '../../ui/BlurInput';
import { Chip, ICONS, OutTag, Svg, type Tone } from './shared';
import { typing } from './undo';

/**
 * subs = 칸의 세부목표 (한 칸에 여러 개, 2026-10-05). out = 위 계획에 없는 세부목표 (R-P14, '계획 밖')
 * more = 이 칸에 더 넣을 수 있는 세부목표가 남음
 */
export type MBlock = { id: string; start: number; end: number; subs?: { id: string; name: string; out?: boolean }[]; more?: boolean; text: string };

const AREA: CSSProperties = { width: '100%', background: 'transparent', border: 0, resize: 'none', font: 'inherit', fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-text)', textAlign: 'center', outline: 'none', padding: 0, fieldSizing: 'content', overflow: 'hidden' } as CSSProperties;

/**
 * 병합 칸 한 열 (연간·월간 목표 열, 참고사항 열).
 * R-P1: 한 열은 항상 한 줄 — 칸끼리 겹치지 않고, 늘리기·옮기기도 빈 자리까지만.
 * R-P2: 칸을 아래로 늘려 기간을 표현한다.
 * 2026-10-03 UT: 빈 칸을 끌어 여러 칸을 한 번에 넣고, 고른 칸은 Delete로 지운다. 늘리기·줄이기는 바로 화면에 (빠르게 여러 번 눌러도 빠지지 않게)
 */
export function MergeColumn({ col, firstRow, rowCount, lockedBefore = 0, blocks: given, tone, placeholder, noteOnly, sel, setSel, focusId, popRow, popEnd, label, onEmpty, onRange, onText, onDelete, onSubAdd, onSubRemove }: {
  col: number;
  firstRow: number;
  rowCount: number;
  /** 이 행보다 앞은 지난 기간 → 잠금 (R-P12) */
  lockedBefore?: number;
  blocks: MBlock[];
  tone: Tone;
  placeholder: string;
  noteOnly?: boolean;
  sel: string | null;
  setSel: (id: string | null) => void;
  focusId: string | null;
  popRow?: number | null;
  /** 팝오버가 여러 칸을 가리킬 때 끝 행 */
  popEnd?: number | null;
  label: string;
  /** end = 끌어서 고른 마지막 행 (한 칸이면 row와 같음) */
  onEmpty: (row: number, anchor: DOMRect, end: number) => void;
  onRange: (b: MBlock, start: number, end: number) => void;
  onText: (b: MBlock, text: string) => void;
  onDelete: (b: MBlock) => void;
  /** 칸에 세부목표 더하기 (anchor = 누른 버튼) */
  onSubAdd?: (b: MBlock, anchor: DOMRect) => void;
  onSubRemove?: (b: MBlock, subId: string) => void;
}) {
  const [drag, setDrag] = useState<MBlock | null>(null);
  // 늘리기·옮기기를 서버 답보다 먼저 화면에 (id → 기간). 서버 값이 따라오면 지운다
  const [over, setOver] = useState<Record<string, { start: number; end: number }>>({});
  const blocks = given.map(b => (over[b.id] ? { ...b, ...over[b.id] } : b));
  useEffect(() => {
    setOver(o => {
      const next = { ...o };
      let changed = false;
      for (const id of Object.keys(o)) {
        const b = given.find(x => x.id === id);
        if (!b || (b.start === o[id].start && b.end === o[id].end)) { delete next[id]; changed = true; }
      }
      return changed ? next : o;
    });
  }, [given]);
  const range = (b: MBlock, start: number, end: number) => {
    setOver(o => ({ ...o, [b.id]: { start, end } }));
    onRange(b, start, end);
  };
  // 새로 넣은 칸은 메모 칸에 바로 글쇠를 두되 한 번만 (다시 고를 때는 칸이 골라져 Delete가 먹게)
  const focused = useRef(new Set<string>());
  const autoFocusOf = (id: string) => {
    if (focusId !== id || focused.current.has(id)) return false;
    focused.current.add(id);
    return true;
  };
  const covered = (r: number, except?: string) => blocks.some(b => b.id !== except && r >= b.start && r <= b.end);
  const free = (r: number) => r >= lockedBefore && r < rowCount && !covered(r);

  const drop = (row: number) => {
    const b = drag;
    setDrag(null);
    if (!b) return;
    let end = row;
    while (end - row < b.end - b.start && end + 1 < rowCount && !covered(end + 1, b.id)) end++;
    if (row !== b.start || end !== b.end) range(b, row, end);
  };

  // 빈 칸 끌어 고르기: 누른 칸부터 이어진 빈 칸까지
  const pick = useRef<{ start: number; end: number; el: HTMLElement } | null>(null);
  const [picking, setPicking] = useState<{ start: number; end: number } | null>(null);
  const reach = (start: number, to: number) => {
    const dir = to >= start ? 1 : -1;
    let r = start;
    while (r !== to && free(r + dir)) r += dir;
    return r;
  };
  const emptyRef = useRef(onEmpty);
  emptyRef.current = onEmpty;
  // 손을 떼면(어디서든) 고른 범위로 넣기 창. 누를 때 바로 걸어 둔다 (빠른 클릭도 놓치지 않게)
  const startPick = (r: number, el: HTMLElement) => {
    pick.current = { start: r, end: r, el };
    setPicking({ start: r, end: r });
    window.addEventListener('pointerup', () => {
      const p = pick.current;
      pick.current = null;
      setPicking(null);
      if (p) emptyRef.current(Math.min(p.start, p.end), p.el.getBoundingClientRect(), Math.max(p.start, p.end));
    }, { once: true });
  };

  // 고른 칸은 Delete·Backspace로 지운다 (되돌리기는 부모가)
  useEffect(() => {
    const b = blocks.find(x => x.id === sel);
    if (!b || b.start < lockedBefore) return;
    const key = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing()) {
        e.preventDefault();
        setSel(null);
        onDelete(b);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const inPick = (r: number) => !!picking && r >= Math.min(picking.start, picking.end) && r <= Math.max(picking.start, picking.end);
  const inPop = (r: number) => popRow != null && r >= popRow && r <= (popEnd ?? popRow);
  const empties = [];
  for (let r = 0; r < rowCount; r++) {
    if (covered(r)) continue;
    if (r < lockedBefore) {
      empties.push(<div key={'e' + r} data-testid="plan-locked" className="plan-locked" title="지난 기간은 수정할 수 없어요" style={{ gridRow: firstRow + r, gridColumn: col }} />);
      continue;
    }
    empties.push(
      <div
        key={'e' + r}
        role="button"
        tabIndex={0}
        aria-label={`${label} ${r + 1}번째 칸에 넣기`}
        data-testid="plan-empty"
        data-row={r}
        className={'plan-empty' + (drag ? ' drop-ok' : '') + (inPop(r) || inPick(r) ? ' pop-on' : '')}
        style={{ gridRow: firstRow + r, gridColumn: col }}
        onPointerDown={e => {
          if (e.button !== 0 || drag) return;
          // 끌기 동안 다른 칸 위로 지나가는 것을 알 수 있게 잡지 않는다
          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
          startPick(r, e.currentTarget);
        }}
        onPointerEnter={() => {
          const p = pick.current;
          if (!p) return;
          p.end = reach(p.start, r);
          setPicking({ start: p.start, end: p.end });
        }}
        onKeyDown={e => e.key === 'Enter' && onEmpty(r, e.currentTarget.getBoundingClientRect(), r)}
        onDragOver={e => drag && e.preventDefault()}
        onDrop={e => { e.preventDefault(); drop(r); }}
      />,
    );
  }

  return (
    <>
      {empties}
      {blocks.map(b => {
        const locked = b.start < lockedBefore;
        const selected = !locked && sel === b.id;
        const canExtend = b.end + 1 < rowCount && !covered(b.end + 1, b.id);
        return (
          <div
            key={b.id}
            data-sel={b.id}
            data-testid="plan-block"
            data-locked={locked || undefined}
            title={locked ? '지난 기간은 수정할 수 없어요' : selected ? 'Delete 키로 지울 수 있어요' : undefined}
            onClick={() => !selected && !locked && setSel(b.id)}
            style={{ gridRow: `${firstRow + b.start} / span ${b.end - b.start + 1}`, gridColumn: col, minWidth: 0, position: 'relative', background: tone.bg, color: tone.ink, borderRadius: 16, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', outline: selected ? '2px solid var(--color-accent)' : '0 solid transparent', outlineOffset: 2, boxShadow: selected ? 'var(--shadow-md)' : 'none', zIndex: selected ? 3 : 1, cursor: selected || locked ? 'default' : 'pointer', opacity: locked ? 0.8 : 1 }}
          >
            {!noteOnly && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: b.text || selected ? 4 : 0 }}>
                {b.text || selected
                  ? (b.subs ?? []).map(s => (
                      <Chip key={s.id} tone={tone} white>
                        <span data-testid="block-sub">{s.name}</span>
                        {selected && onSubRemove && (b.subs?.length ?? 0) > 1 && (
                          <button type="button" className="btn" data-testid="sub-remove" title={`'${s.name}' 빼기`} aria-label={`'${s.name}' 빼기`} onClick={() => onSubRemove(b, s.id)} style={{ marginLeft: 4, padding: 0, width: 14, height: 14, display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle', borderRadius: '50%', background: 'transparent', color: 'inherit', fontSize: 12, lineHeight: 1 }}>×</button>
                        )}
                      </Chip>
                    ))
                  : <span data-testid="block-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: 'var(--color-text)', textAlign: 'center' }}>{(b.subs ?? []).map(s => s.name).join(' · ')}</span>}
                {selected && onSubAdd && b.more && (
                  <button type="button" className="btn" data-testid="sub-add" title="이 칸에 세부목표 더하기" onClick={e => onSubAdd(b, e.currentTarget.getBoundingClientRect())} style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, padding: '2px 8px', borderRadius: 999, border: '1.5px dashed ' + tone.ink, background: 'transparent', color: tone.ink }}>+ 세부목표</button>
                )}
                {b.subs?.some(s => s.out) && <OutTag />}
              </div>
            )}
            {locked && b.text && <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-text)', textAlign: 'center', whiteSpace: 'pre-wrap' }}>{b.text}</span>}
            {!locked && (noteOnly || b.text || selected) && (
              <BlurInput multiline rows={1} required={false} maxLength={200} label={placeholder} placeholder={placeholder} value={b.text} onSave={v => onText(b, v)} style={AREA} autoFocus={autoFocusOf(b.id)} />
            )}
            {selected && (
              <div data-testid="block-tools" style={{ position: 'absolute', top: -15, right: 8, display: 'flex', gap: 2, padding: 3, background: 'var(--color-neutral-100)', borderRadius: 999, boxShadow: 'var(--shadow-md)' }}>
                <span
                  title="끌어서 이동"
                  aria-label="끌어서 이동"
                  draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); setDrag(b); }}
                  onDragEnd={() => setDrag(null)}
                  style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'grab', color: 'var(--color-neutral-700)' }}
                >
                  <Svg d={ICONS.grip} />
                </span>
                <button title="아래 칸까지 늘리기" aria-label="아래 칸까지 늘리기" disabled={!canExtend} onClick={() => range(b, b.start, b.end + 1)} className="btn plan-tool"><Svg d={ICONS.down} /></button>
                <button title="한 칸 줄이기" aria-label="한 칸 줄이기" disabled={b.end === b.start} onClick={() => range(b, b.start, b.end - 1)} className="btn plan-tool"><Svg d={ICONS.up} /></button>
                <button title="삭제 (Delete)" aria-label="칸 삭제" onClick={() => { setSel(null); onDelete(b); }} className="btn plan-tool" style={{ color: 'var(--color-accent-700)' }}><Svg d={ICONS.x} /></button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
