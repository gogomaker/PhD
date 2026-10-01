import { describe, expect, it } from 'vitest';
import { hours, periodFromKey, periodLabel, periodOf, periodTitle, rate, shiftPeriod, shortDate } from './tracking';

describe('트래킹 기간 (4.7)', () => {
  it('주간은 일요일부터 7일', () => {
    expect(periodOf('week', '2026-10-01')).toEqual({ range: 'week', key: '2026-09-27', from: '2026-09-27', to: '2026-10-03' });
  });
  it('월간은 그 달 1일부터 말일', () => {
    expect(periodOf('month', '2026-02-10')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodOf('month', '2026-10-01')).toMatchObject({ key: '2026-10', to: '2026-10-31' });
  });
  it('앞뒤 이동', () => {
    expect(shiftPeriod(periodOf('week', '2026-10-01'), -1).from).toBe('2026-09-20');
    expect(shiftPeriod(periodOf('month', '2026-01-15'), -1).key).toBe('2025-12');
  });
  it('이름표: 주는 4번째 날이 든 달의 주 (계획 표와 같음)', () => {
    expect(periodLabel(periodFromKey('week', '2026-09-27'))).toBe('9월 5주차');
    expect(periodLabel(periodFromKey('week', '2026-09-20'))).toBe('9월 4주차');
    expect(periodLabel(periodFromKey('month', '2026-10'))).toBe('2026년 10월');
  });
  it('제목: 이번 기간이면 "이번 주", 아니면 날짜', () => {
    expect(periodTitle(periodOf('week', '2026-10-01'), '2026-10-01')).toBe('이번 주, 계획한 만큼 썼을까');
    expect(periodTitle(periodFromKey('week', '2026-09-20'), '2026-10-01')).toBe('9.20 – 9.26, 계획한 만큼 썼을까');
    expect(periodTitle(periodFromKey('month', '2026-09'), '2026-10-01')).toBe('9월, 계획한 만큼 썼을까');
  });
});

describe('시간 표시', () => {
  it('10분 칸 → 시간', () => {
    expect(hours(0)).toBe('0');
    expect(hours(6)).toBe('1');
    expect(hours(9)).toBe('1.5');
    expect(hours(17)).toBe('2.8');
  });
  it('계획 대비 실행', () => {
    expect(rate(0, 5)).toBeNull();
    expect(rate(17, 9)).toBe(53);
  });
  it('날짜', () => {
    expect(shortDate('2026-07-03')).toBe('26.07.03');
  });
});
