// 글자 수: 한도의 80%를 넘으면 '35/40'처럼 보여 준다. 말없이 잘리지 않게 (2026-10-03 UT)
export function Count({ value, max }: { value: string; max?: number }) {
  if (!max) return null;
  const n = value.length;
  if (n < max * 0.8) return null;
  return (
    <span data-testid="char-count" aria-live="polite" style={{ alignSelf: 'flex-end', flex: 'none', fontSize: 11.5, fontWeight: 700, color: n >= max ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>
      {n}/{max}{n >= max ? ' · 더 쓸 수 없어요' : ''}
    </span>
  );
}
