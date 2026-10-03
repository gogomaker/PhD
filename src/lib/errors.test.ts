import { describe, expect, it } from 'vitest';
import { errorText } from './errors';

describe('외래키 오류 안내 (2026-10-03 UT 2차)', () => {
  const fk = (from: string, by: string) => ({ code: '23503', message: `update or delete on table "${from}" violates foreign key constraint "${by}_x_fkey" on table "${by}"` });
  it('어느 표가 가리키는지로 가른다', () => {
    expect(errorText(fk('subgoals', 'tasks'))).toBe('할 일 기록에 쓰인 세부목표는 지울 수 없어요');
    expect(errorText(fk('subgoals', 'practices'))).toBe('계획 표에 배치된 세부목표는 지울 수 없어요');
    expect(errorText(fk('categories', 'goals'))).toContain('카테고리는 지울 수 없어요');
  });
});
