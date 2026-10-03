// D-day 하나 (2026-10-03 기획 결정): 이름 + 날짜. 모바일·데스크톱이 함께 쓴다
import { diffDays, type DayKey } from './day';

/** 'D-23' / 'D-DAY' / 'D+3' */
export function ddayText(target: DayKey, day: DayKey) {
  const n = diffDays(day, target);
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`;
}

/** 목표 기한('YYYY-MM-01') → 그 달 마지막 날 */
export function monthEnd(due: string) {
  const [y, m] = due.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
