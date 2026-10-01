import type { CSSProperties } from 'react';

// 기한 고르기: 연도 + 월. 값은 'YYYY-MM' (없으면 '')
export function MonthPicker({ value, onChange, label = '기한', style }: { value: string; onChange: (v: string) => void; label?: string; style?: CSSProperties }) {
  const thisYear = new Date().getFullYear();
  const [y, m] = value ? value.split('-').map(Number) : [0, 0];
  const years = Array.from({ length: 11 }, (_, i) => thisYear + i);
  if (y && !years.includes(y)) years.unshift(y);
  const set = (ny: number, nm: number) => {
    if (ny && nm) onChange(`${ny}-${String(nm).padStart(2, '0')}`);
    else onChange(ny ? `${ny}-` : nm ? `-${String(nm).padStart(2, '0')}` : '');
  };
  const sel: CSSProperties = { height: 40, paddingInline: 12, cursor: 'pointer', width: 'auto', minWidth: 0 };
  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      <select className="input" aria-label={label + ' 연도'} value={y || ''} onChange={e => set(Number(e.target.value), m)} style={{ ...sel, flex: '1.3 1 0' }}>
        <option value="" disabled>연도</option>
        {years.map(yy => <option key={yy} value={yy}>{yy}년</option>)}
      </select>
      <select className="input" aria-label={label + ' 월'} value={m || ''} onChange={e => set(y, Number(e.target.value))} style={{ ...sel, flex: '1 1 0' }}>
        <option value="" disabled>월</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(mm => <option key={mm} value={mm}>{mm}월</option>)}
      </select>
    </div>
  );
}

/** 'YYYY-MM' 이 완성됐는지 */
export function isMonth(v: string) {
  return /^\d{4}-\d{2}$/.test(v);
}
