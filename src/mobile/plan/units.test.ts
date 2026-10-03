import { describe, expect, it } from 'vitest';
import { endsFrom, keysOf, splitRange, unitOf, unitsOf } from './units';

const TODAY = '2026-10-02';

describe('일정 칸 단위', () => {
  it('주는 4번째 날이 든 달의 주 (9.27 주 = 9월 5주)', () => {
    const u = unitOf('month', '2026-09-27', TODAY);
    expect(u.piece).toBe('2026-09');
    expect(u.idx).toBe(4);
    expect(u.locked).toBe(false);
    expect(unitOf('month', '2026-09-20', TODAY).locked).toBe(true);
  });
  it('연간: 지난달은 잠김, 해의 12달', () => {
    expect(unitsOf('year', '2026', TODAY).map(u => u.locked).filter(Boolean).length).toBe(9);
  });
  it('월간 10월 2주 ~ 11월 3주 → 10월 2~4주 + 11월 1~3주로 나눔', () => {
    const oct = unitsOf('month', '2026-10', TODAY);
    const nov = unitsOf('month', '2026-11', TODAY);
    expect(splitRange('month', oct[1].key, nov[2].key, TODAY)).toEqual([
      { piece: '2026-10', s: 1, e: oct.length - 1 },
      { piece: '2026-11', s: 0, e: 2 },
    ]);
  });
  it('연간 26년 11월 ~ 27년 2월 → 해마다 나눔', () => {
    expect(splitRange('year', '2026-11', '2027-02', TODAY)).toEqual([
      { piece: '2026', s: 10, e: 11 },
      { piece: '2027', s: 0, e: 1 },
    ]);
  });
  it('끝 칸은 같은 목표가 차지한 칸 앞까지 (R-P1)', () => {
    const occ = new Set(keysOf('year', '2027', 1, 2));
    expect(endsFrom('year', '2026-11', occ, TODAY).map(u => u.key)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('주간은 그 주 안에서만', () => {
    expect(endsFrom('week', '2026-10-01', new Set(), TODAY).map(u => u.label)).toEqual(['목', '금', '토']);
  });
});
