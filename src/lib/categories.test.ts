import { describe, expect, it } from 'vitest';
import { firstFreeColor, toggleDraft, type DraftCategory } from './categories';

describe('firstFreeColor (R-C1)', () => {
  it('쓰지 않은 첫 색', () => {
    expect(firstFreeColor([])).toBe('red');
    expect(firstFreeColor(['red', 'purple'])).toBe('orange');
  });
  it('7색을 다 쓰면 없음', () => {
    expect(firstFreeColor(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'])).toBeNull();
  });
});

describe('toggleDraft (가입 3단계 칩)', () => {
  it('넣으면 일상 색을 피해 빈 색을 받는다', () => {
    let d: DraftCategory[] = [];
    d = toggleDraft(d, '건강', 'red');
    expect(d).toEqual([{ name: '건강', color: 'orange' }]);
  });
  it('다시 누르면 빠진다', () => {
    const d = toggleDraft(toggleDraft([], '건강', 'purple'), '건강', 'purple');
    expect(d).toEqual([]);
  });
  it('7번째는 들어가지 않는다 (R-C1)', () => {
    let d: DraftCategory[] = [];
    for (const n of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) d = toggleDraft(d, n, 'purple');
    expect(d.map(x => x.name)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(new Set(d.map(x => x.color)).size).toBe(6);
    expect(d.some(x => x.color === 'purple')).toBe(false);
  });
  it('빈 이름은 무시하고 앞뒤 공백은 지운다', () => {
    expect(toggleDraft([], '   ', 'purple')).toEqual([]);
    expect(toggleDraft([], ' 어학 ', 'purple')[0].name).toBe('어학');
  });
});
