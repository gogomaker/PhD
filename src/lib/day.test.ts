import { describe, expect, it } from 'vitest';
import { addDays, dayLabel, dayRelation, userDayKey } from './day';

describe('userDayKey (R-D1)', () => {
  it('서울 기준 오전 10시는 그날', () => {
    // 2026-10-01 10:00 KST = 01:00 UTC
    expect(userDayKey(new Date('2026-10-01T01:00:00Z'))).toBe('2026-10-01');
  });
  it('05시 시작이면 새벽 1시는 전날', () => {
    // 2026-10-02 01:00 KST = 2026-10-01 16:00 UTC
    expect(userDayKey(new Date('2026-10-01T16:00:00Z'))).toBe('2026-10-01');
  });
  it('05시 정각부터 새 날', () => {
    expect(userDayKey(new Date('2026-10-01T20:00:00Z'))).toBe('2026-10-02');
  });
  it('하루 시작 시각을 4시로 바꾸면 경계도 바뀐다', () => {
    // 2026-10-02 04:30 KST
    expect(userDayKey(new Date('2026-10-01T19:30:00Z'), 'Asia/Seoul', 4)).toBe('2026-10-02');
    expect(userDayKey(new Date('2026-10-01T19:30:00Z'), 'Asia/Seoul', 5)).toBe('2026-10-01');
  });
  it('월 경계를 넘어간다', () => {
    // 2026-10-01 02:00 KST → 9월 30일
    expect(userDayKey(new Date('2026-09-30T17:00:00Z'))).toBe('2026-09-30');
  });
});

describe('날짜 도우미', () => {
  it('addDays는 달을 넘긴다', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
  it('dayLabel', () => {
    expect(dayLabel('2026-10-01')).toEqual({ md: '10.1', dow: '목' });
  });
  it('dayRelation', () => {
    expect(dayRelation('2026-09-30', '2026-10-01')).toBe('past');
    expect(dayRelation('2026-10-01', '2026-10-01')).toBe('today');
    expect(dayRelation('2026-10-02', '2026-10-01')).toBe('tomorrow');
    expect(dayRelation('2026-10-03', '2026-10-01')).toBe('later');
  });
});
