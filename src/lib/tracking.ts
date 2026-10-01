// 트래킹 (SPEC 4.7): 기간 계산과 시간 표시
import { addDays, type DayKey } from './day';
import { addMonths, md, monthOfWeek, weekStartOf, ymOf, type YearMonth } from './plan';

export type Range = 'week' | 'month';

export type Period = {
  range: Range;
  /** 주간: 주 첫날(일요일). 월간: 'YYYY-MM' */
  key: string;
  from: DayKey;
  to: DayKey;
};

/** 그 달의 마지막 날 */
function monthEnd(ym: YearMonth): DayKey {
  return addDays(addMonths(ym, 1) + '-01', -1);
}

/** 오늘이 든 기간 */
export function periodOf(range: Range, day: DayKey): Period {
  if (range === 'week') return periodFromKey('week', weekStartOf(day));
  return periodFromKey('month', ymOf(day));
}

export function periodFromKey(range: Range, key: string): Period {
  if (range === 'week') return { range, key, from: key, to: addDays(key, 6) };
  return { range, key, from: key + '-01', to: monthEnd(key) };
}

export function shiftPeriod(p: Period, n: number): Period {
  return p.range === 'week' ? periodFromKey('week', addDays(p.key, 7 * n)) : periodFromKey('month', addMonths(p.key, n));
}

/** 이름표: '10월 1주차' / '2026년 10월' (주는 4번째 날이 든 달의 주, 계획 표와 같음) */
export function periodLabel(p: Period): string {
  if (p.range === 'week') {
    const { ym, index } = monthOfWeek(p.key);
    return `${Number(ym.slice(5))}월 ${index + 1}주차`;
  }
  return `${p.key.slice(0, 4)}년 ${Number(p.key.slice(5))}월`;
}

/** 제목: 이번 기간이면 '이번 주', 아니면 날짜 */
export function periodTitle(p: Period, today: DayKey): string {
  const cur = periodOf(p.range, today).key === p.key;
  if (p.range === 'week') return (cur ? '이번 주' : `${md(p.from)} – ${md(p.to)}`) + ', 계획한 만큼 썼을까';
  return (cur ? '이번 달' : `${Number(p.key.slice(5))}월`) + ', 계획한 만큼 썼을까';
}

/** 10분 칸 수 → 시간 (소수 첫째 자리, .0은 뺌) */
export function hours(slots: number): string {
  const h = Math.round((slots / 6) * 10) / 10;
  return String(h);
}

/** 계획 대비 실행 % (계획이 없으면 null) */
export function rate(planned: number, actual: number): number | null {
  return planned > 0 ? Math.round((actual / planned) * 100) : null;
}

/** '2026-07-03' → '26.07.03' */
export function shortDate(key: DayKey) {
  return key.slice(2, 4) + '.' + key.slice(5, 7) + '.' + key.slice(8, 10);
}
