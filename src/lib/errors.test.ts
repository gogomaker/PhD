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

describe('UT 3차 서버 오류', () => {
  it('다른 기기에서 바뀜 / 하루 시작을 지금 늦출 수 없음 / 시각 순서', () => {
    expect(errorText({ code: 'P0001', message: 'stale_day' })).toContain('다른 기기에서');
    expect(errorText({ code: 'P0001', message: 'day_start_back', hint: '지금은 바꿀 수 없어요. 6시가 지나면 바꿀 수 있어요' } as never)).toContain('6시가 지나면');
    expect(errorText({ code: '23514', message: 'time_order' })).toContain('끝 시각이 시작보다 뒤');
  });
});
