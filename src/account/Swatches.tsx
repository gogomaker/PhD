import { CATEGORY_COLORS, PALETTE, type CategoryColor } from '../lib/palette';

// 7색 고르기. used에 든 색은 흐리게, 고를 수 없음
export function Swatches({ value, used = [], onPick, size = 26 }: { value: CategoryColor; used?: readonly string[]; onPick: (c: CategoryColor) => void; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {CATEGORY_COLORS.map(c => {
        const taken = c !== value && used.includes(c);
        return (
          <button
            key={c}
            type="button"
            disabled={taken}
            onClick={() => c !== value && onPick(c)}
            title={PALETTE[c].name + (taken ? ' · 사용 중' : '')}
            aria-label={PALETTE[c].name + (taken ? ' · 사용 중' : '')}
            aria-pressed={c === value}
            style={{
              width: size, height: size, borderRadius: '50%', border: 0, padding: 0, flex: 'none',
              cursor: taken ? 'not-allowed' : 'pointer', background: PALETTE[c].dot, opacity: taken ? 0.25 : 1,
              boxShadow: c === value ? '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
