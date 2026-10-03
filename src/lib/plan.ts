// 계획 표 날짜 계산. 날짜는 모두 'YYYY-MM-DD' 문자열(사용자 기준 날짜, R-D1)
import { addDays, toDayKey, type DayKey } from './day';

export type WeekStart = 'mon' | 'sun';

/** 한 주는 일요일에 시작한다 (2026-10-01 기획 결정, 고정) */
export const WEEK_START: WeekStart = 'sun';

/** 요일 이름. ISO 요일 1=월 … 7=일 */
export const DOW_LABEL = ['', '월', '화', '수', '목', '금', '토', '일'];

function parts(key: DayKey) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** ISO 요일: 1=월 … 7=일 */
export function isoDow(key: DayKey) {
  const dow = new Date(key + 'T00:00:00Z').getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** 그 날이 속한 주의 첫날 */
export function weekStartOf(key: DayKey, ws: WeekStart = WEEK_START): DayKey {
  const back = ws === 'mon' ? isoDow(key) - 1 : isoDow(key) % 7;
  return addDays(key, -back);
}

/** 주의 7일 */
export function weekDays(start: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 'YYYY-MM' */
export type YearMonth = string;

export function ymOf(key: DayKey): YearMonth {
  return key.slice(0, 7);
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split('-').map(Number);
  return toDayKey(y, m + n, 1).slice(0, 7);
}

/**
 * 한 주가 두 달에 걸치면 날이 더 많이 들어간 달의 주로 친다(그 주의 4번째 날이 있는 달).
 * index는 그 달의 몇 번째 주인지(0부터).
 */
export function monthOfWeek(start: DayKey): { ym: YearMonth; index: number } {
  const mid = addDays(start, 3);
  return { ym: ymOf(mid), index: Math.floor((parts(mid).d - 1) / 7) };
}

/** 그 달에 속한 주들의 첫날 */
export function monthWeeks(ym: YearMonth, ws: WeekStart = WEEK_START): DayKey[] {
  let start = weekStartOf(ym + '-01', ws);
  if (monthOfWeek(start).ym !== ym) start = addDays(start, 7);
  const out: DayKey[] = [];
  while (monthOfWeek(start).ym === ym) {
    out.push(start);
    start = addDays(start, 7);
  }
  return out;
}

/** 실천의 실제 날짜들 (주 첫날 + 요일) */
export function practiceDates(weekStart: DayKey, weekdays: number[]): DayKey[] {
  const base = isoDow(weekStart);
  return weekdays.map(w => addDays(weekStart, (w - base + 7) % 7)).sort();
}

/**
 * R-P8: 여러 요일 표시. 7개면 "매일", 3개 이상 연속이면 "수–금", 아니면 "월·수·금".
 * positions는 그 주 안에서의 순서(0~6), labels는 그 주의 요일 이름.
 */
export function fmtDays(positions: number[], labels: string[]): string {
  const d = [...positions].sort((a, b) => a - b);
  if (d.length === 7) return '매일';
  const run = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  if (run && d.length >= 3) return labels[d[0]] + '–' + labels[d[d.length - 1]];
  return d.map(x => labels[x]).join('·');
}

/** '2026-09-28' → '9.28' */
export function md(key: DayKey) {
  const { m, d } = parts(key);
  return `${m}.${d}`;
}

// ───────── 지난 기간 잠금 (R-P12, DB의 plan_locked와 같은 규칙) ─────────
/** 지난달이면 잠김 (연간 칸) */
export function monthLocked(ym: YearMonth, today: DayKey) {
  return ym < ymOf(today);
}
/** 지난주면 잠김 (월간 칸·월간 참고사항) */
export function weekLocked(weekStart: DayKey, today: DayKey) {
  return weekStart < weekStartOf(today);
}
/** 지난 날이면 잠김 (주간 참고사항·실천) */
export function dayLocked(day: DayKey, today: DayKey) {
  return day < today;
}

// ───────── 위 계획 (R-P14) ─────────
export type UpperPick = { goalId: string; subId: string };
/** 위 단계에 계획이 있는데 이 (목표, 세부 목표)는 없으면 '계획 밖' */
export const outside = (upper: UpperPick[], goalId: string, subId: string) => upper.length > 0 && !upper.some(u => u.goalId === goalId && u.subId === subId);
