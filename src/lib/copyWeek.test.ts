import { describe, expect, it } from 'vitest';
import { copyDays, copyRow, prevWeekItems, type CopySrc } from './copyWeek';

const W = '2026-10-04'; // 일요일 시작 주
const P = (id: string, weekdays: number[], extra: Partial<CopySrc> = {}): CopySrc => ({ id, goal_id: 'g', subgoal_id: 's', week_start_date: '2026-09-27', name: id, weekdays, start_time: null, end_time: null, ...extra });

describe('지난주 실천 가져오기', () => {
  it('주 첫날이면 모두 그대로', () => {
    const items = prevWeekItems([P('a', [1, 3, 5]), P('b', [7])], W, W, () => true);
    expect(items.map(x => [x.src.id, x.weekdays, x.trimmed])).toEqual([['a', [1, 3, 5], false], ['b', [7], false]]);
  });
  it('주 중간이면 지난 요일은 빼고, 남는 요일이 없으면 건너뜀', () => {
    // 10.7(수)이 오늘: 일·월·화는 지남
    const items = prevWeekItems([P('매일', [1, 2, 3, 4, 5, 6, 7]), P('월요일', [1]), P('월수', [1, 3])], W, '2026-10-07', () => true);
    expect(items.map(x => [x.src.id, x.weekdays, x.trimmed])).toEqual([['매일', [3, 4, 5, 6], true], ['월수', [3], true]]);
  });
  it('마무리한 목표, 이번 주에 이미 있는 실천은 건너뜀', () => {
    const items = prevWeekItems([P('a', [1], { goal_id: 'done' }), P('b', [2]), { ...P('b', [4]), id: 'b2', week_start_date: W }], W, W, g => g !== 'done');
    expect(items).toEqual([]);
  });
  it('두 주 전 실천은 가져오지 않음', () => {
    expect(prevWeekItems([P('a', [1], { week_start_date: '2026-09-20' })], W, W, () => true)).toEqual([]);
  });
  it('요일 표시와 저장할 행 (시간 포함)', () => {
    expect(copyDays(W, [3, 4, 5, 6])).toBe('수–토');
    expect(copyDays(W, [1, 2, 3, 4, 5, 6, 7])).toBe('매일');
    const [x] = prevWeekItems([P('a', [1], { start_time: '07:00:00', end_time: '08:00:00' })], W, W, () => true);
    expect(copyRow(x, W)).toEqual({ goal_id: 'g', subgoal_id: 's', week_start_date: W, name: 'a', weekdays: [1], start_time: '07:00:00', end_time: '08:00:00' });
  });
});
