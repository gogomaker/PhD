// R-D1: "오늘"은 사용자 시간대 + 하루 시작 시각(day_start_hour) 기준.
// 05시 시작이면 새벽 1시는 아직 전날이다.

export const DEFAULT_TIMEZONE = 'Asia/Seoul';
export const DEFAULT_DAY_START_HOUR = 5;

/** 'YYYY-MM-DD' 형식의 사용자 기준 날짜 */
export type DayKey = string;

function wallClock(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') };
}

export function toDayKey(y: number, m: number, d: number): DayKey {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toISOString().slice(0, 10);
}

export function userDayKey(at: Date, timeZone = DEFAULT_TIMEZONE, dayStartHour = DEFAULT_DAY_START_HOUR): DayKey {
  const { y, m, d, h } = wallClock(at, timeZone);
  return toDayKey(y, m, h < dayStartHour ? d - 1 : d);
}

export function addDays(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  return toDayKey(y, m, d + n);
}

/** 두 날짜 사이의 일 수 (b - a) */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function dayLabel(key: DayKey) {
  const date = new Date(key + 'T00:00:00Z');
  return { md: `${date.getUTCMonth() + 1}.${date.getUTCDate()}`, dow: DOW[date.getUTCDay()] };
}

export type DayRelation = 'past' | 'today' | 'tomorrow' | 'later';

export function dayRelation(key: DayKey, today: DayKey): DayRelation {
  const diff = diffDays(today, key);
  if (diff < 0) return 'past';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return 'later';
}
