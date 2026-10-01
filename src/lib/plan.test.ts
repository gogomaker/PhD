import { describe, expect, it } from 'vitest';
import { addMonths, dayLocked, fmtDays, isoDow, monthLocked, monthOfWeek, monthWeeks, practiceDates, weekLocked, weekStartOf } from './plan';

describe('주 계산', () => {
  it('ISO 요일', () => {
    expect(isoDow('2026-10-01')).toBe(4); // 목
    expect(isoDow('2026-10-04')).toBe(7); // 일
  });
  it('주 첫날 (월/일 시작)', () => {
    expect(weekStartOf('2026-10-01', 'mon')).toBe('2026-09-28');
    expect(weekStartOf('2026-10-04', 'mon')).toBe('2026-09-28');
    expect(weekStartOf('2026-10-04', 'sun')).toBe('2026-10-04');
    expect(weekStartOf('2026-10-01', 'sun')).toBe('2026-09-27');
  });
  it('두 달에 걸친 주는 날이 많은 달로', () => {
    expect(monthOfWeek('2026-09-28')).toEqual({ ym: '2026-10', index: 0 }); // 9.28–10.4: 10월 4일
    expect(monthOfWeek('2026-10-26')).toEqual({ ym: '2026-10', index: 4 }); // 10.26–11.1
    expect(monthOfWeek('2026-08-31')).toEqual({ ym: '2026-09', index: 0 }); // 8.31–9.6
  });
  it('2026년 10월은 5주 (목업과 같음)', () => {
    expect(monthWeeks('2026-10', 'mon')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });
  it('2026년 11월 (월 시작)', () => {
    expect(monthWeeks('2026-11', 'mon')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
  });
  it('모든 주는 정확히 한 달에 속한다', () => {
    for (const ws of ['mon', 'sun'] as const) {
      const all = [...Array(24)].flatMap((_, i) => monthWeeks(addMonths('2026-01', i), ws));
      expect(new Set(all).size).toBe(all.length);
      for (let i = 1; i < all.length; i++) expect(Date.parse(all[i]) - Date.parse(all[i - 1])).toBe(7 * 86400000);
    }
  });
  it('달 넘기기', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('실천 날짜', () => {
  it('월 시작 주의 목요일', () => {
    expect(practiceDates('2026-09-28', [4])).toEqual(['2026-10-01']);
  });
  it('일 시작 주의 일·월', () => {
    expect(practiceDates('2026-09-27', [7, 1])).toEqual(['2026-09-27', '2026-09-28']);
  });
});

describe('요일 표시 (R-P8)', () => {
  const L = ['월', '화', '수', '목', '금', '토', '일'];
  it('연속은 수–금', () => expect(fmtDays([2, 3, 4], L)).toBe('수–금'));
  it('떨어지면 월·수·금', () => expect(fmtDays([4, 0, 2], L)).toBe('월·수·금'));
  it('전체는 매일', () => expect(fmtDays([0, 1, 2, 3, 4, 5, 6], L)).toBe('매일'));
  it('둘이 붙어 있으면 화·수', () => expect(fmtDays([1, 2], L)).toBe('화·수'));
});

describe('일요일 시작 (고정)', () => {
  it('기본은 일요일', () => {
    expect(weekStartOf('2026-10-01')).toBe('2026-09-27');
  });
  it('9.27 주는 9월 5주차, 10월 1주차는 10.4', () => {
    expect(monthOfWeek('2026-09-27')).toEqual({ ym: '2026-09', index: 4 });
    expect(monthWeeks('2026-10')).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  });
});

describe('지난 기간 잠금 (R-P12)', () => {
  const today = '2026-10-01'; // 목
  it('지난달·지난주·지난 날', () => {
    expect(monthLocked('2026-09', today)).toBe(true);
    expect(monthLocked('2026-10', today)).toBe(false);
    expect(weekLocked('2026-09-20', today)).toBe(true);
    expect(weekLocked('2026-09-27', today)).toBe(false);
    expect(dayLocked('2026-09-30', today)).toBe(true);
    expect(dayLocked('2026-10-01', today)).toBe(false);
  });
});
