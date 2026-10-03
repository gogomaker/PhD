import { useState, type CSSProperties } from 'react';
import { BlurInput } from '../../ui/BlurInput';
import { Chip, ICONS, OutTag, Svg, type Tone } from './shared';

/** out = 위 계획에 없는 세부목표 (R-P14, '계획 밖') */
export type MBlock = { id: string; start: number; end: number; chip?: string; text: string; out?: boolean };

const AREA: CSSProperties = { width: '100%', background: 'transparent', border: 0, resize: 'none', font: 'inherit', fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-text)', textAlign: 'center', outline: 'none', padding: 0, fieldSizing: 'content', overflow: 'hidden' } as CSSProperties;

/**
 * 병합 칸 한 열 (연간·월간 목표 열, 참고사항 열).
 * R-P1: 한 열은 항상 한 줄 — 칸끼리 겹치지 않고, 늘리기·옮기기도 빈 자리까지만.
 * R-P2: 칸을 아래로 늘려 기간을 표현한다.
 */
export function MergeColumn({ col, firstRow, rowCount, lockedBefore = 0, blocks, tone, placeholder, noteOnly, sel, setSel, focusId, popRow, label, onEmpty, onRange, onText, onDelete }: {
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
  label: string;
  onEmpty: (row: number, anchor: DOMRect) => void;
  onRange: (b: MBlock, start: number, end: number) => void;
  onText: (b: MBlock, text: string) => void;
  onDelete: (b: MBlock) => void;
}) {
  const [drag, setDrag] = useState<MBlock | null>(null);
  const covered = (r: number, except?: string) => blocks.some(b => b.id !== except && r >= b.start && r <= b.end);

  const drop = (row: number) => {
    const b = drag;
    setDrag(null);
    if (!b) return;
    let end = row;
    while (end - row < b.end - b.start && end + 1 < rowCount && !covered(end + 1, b.id)) end++;
    if (row !== b.start || end !== b.end) onRange(b, row, end);
  };

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
        className={'plan-empty' + (drag ? ' drop-ok' : '') + (popRow === r ? ' pop-on' : '')}
        style={{ gridRow: firstRow + r, gridColumn: col }}
        onClick={e => onEmpty(r, e.currentTarget.getBoundingClientRect())}
        onKeyDown={e => e.key === 'Enter' && onEmpty(r, e.currentTarget.getBoundingClientRect())}
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
            title={locked ? '지난 기간은 수정할 수 없어요' : undefined}
            onClick={() => !selected && !locked && setSel(b.id)}
            style={{ gridRow: `${firstRow + b.start} / span ${b.end - b.start + 1}`, gridColumn: col, minWidth: 0, position: 'relative', background: tone.bg, color: tone.ink, borderRadius: 16, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', outline: selected ? '2px solid var(--color-accent)' : '0 solid transparent', outlineOffset: 2, boxShadow: selected ? 'var(--shadow-md)' : 'none', zIndex: selected ? 3 : 1, cursor: selected || locked ? 'default' : 'pointer', opacity: locked ? 0.8 : 1 }}
          >
            {!noteOnly && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: b.text || selected ? 4 : 0 }}>
                {b.text || selected ? <Chip tone={tone} white>{b.chip}</Chip> : <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: 'var(--color-text)', textAlign: 'center' }}>{b.chip}</span>}
                {b.out && <OutTag />}
              </div>
            )}
            {locked && b.text && <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-text)', textAlign: 'center', whiteSpace: 'pre-wrap' }}>{b.text}</span>}
            {!locked && (noteOnly || b.text || selected) && (
              <BlurInput multiline rows={1} required={false} maxLength={200} label={placeholder} placeholder={placeholder} value={b.text} onSave={v => onText(b, v)} style={AREA} autoFocus={focusId === b.id} />
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
                <button title="아래 칸까지 늘리기" aria-label="아래 칸까지 늘리기" disabled={!canExtend} onClick={() => onRange(b, b.start, b.end + 1)} className="btn plan-tool"><Svg d={ICONS.down} /></button>
                <button title="한 칸 줄이기" aria-label="한 칸 줄이기" disabled={b.end === b.start} onClick={() => onRange(b, b.start, b.end - 1)} className="btn plan-tool"><Svg d={ICONS.up} /></button>
                <button title="삭제" aria-label="칸 삭제" onClick={() => { setSel(null); onDelete(b); }} className="btn plan-tool" style={{ color: 'var(--color-accent-700)' }}><Svg d={ICONS.x} /></button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
