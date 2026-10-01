import { describe, expect, it } from 'vitest';
import { goalColor, toggleDraft } from './categories';

describe('goalColor (순서 = 색)', () => {
  it('일상이 보라면 빨·주·노·초·파·분', () => {
    expect([0, 1, 2, 3, 4, 5].map(i => goalColor(i, 'purple'))).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'pink']);
  });
  it('일상 색은 건너뛴다', () => {
    expect([0, 1, 2].map(i => goalColor(i, 'red'))).toEqual(['orange', 'yellow', 'green']);
  });
  it('일상 색과 겹치는 목표 색은 없다 (R-C1)', () => {
    for (const d of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] as const) {
      const colors = [0, 1, 2, 3, 4, 5].map(i => goalColor(i, d));
      expect(colors).not.toContain(d);
      expect(new Set(colors).size).toBe(6);
    }
  });
});

describe('toggleDraft (가입 3단계 칩)', () => {
  it('넣고 다시 누르면 빠진다', () => {
    expect(toggleDraft([], '건강')).toEqual(['건강']);
    expect(toggleDraft(['건강', '어학'], '건강')).toEqual(['어학']);
  });
  it('7번째는 들어가지 않는다 (R-C1)', () => {
    let d: string[] = [];
    for (const n of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) d = toggleDraft(d, n);
    expect(d).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('빈 이름은 무시하고 앞뒤 공백은 지운다', () => {
    expect(toggleDraft([], '   ')).toEqual([]);
    expect(toggleDraft([], ' 어학 ')).toEqual(['어학']);
  });
});
