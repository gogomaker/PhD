import { describe, expect, it } from 'vitest';
import { dueShort, dueValue, sortGoals } from './goals';

describe('목표 도우미', () => {
  it('기한 표시', () => {
    expect(dueShort('2027-09-01')).toBe('27.09');
    expect(dueValue('2027-09-01')).toBe('2027-09');
  });
  it('마무리한 목표는 맨 아래 (R-G8)', () => {
    const g = (id: string, status: 'not_started' | 'in_progress' | 'completed' | 'dropped', position: number) => ({ id, status, position, created_at: '2026-10-01' });
    const sorted = sortGoals([g('a', 'completed', 0), g('b', 'not_started', 2), g('c', 'in_progress', 1), g('d', 'dropped', 3)]);
    expect(sorted.map(x => x.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});
