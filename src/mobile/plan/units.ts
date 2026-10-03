// 일정의 칸 단위 계산 (2026-10-02 기획 결정 docs/MOBILE.md):
// - 연간 = 달, 월간 = 주, 주간 = 날. 시작·끝을 고르면 달(월간)·해(연간)를 넘어도 되고, 저장할 때 달·해마다 나눠 저장한다
// - 같은 목표의 칸끼리는 겹치지 않는다 (R-P1). 지난 기간은 시작으로 고를 수 없다 (R-P12)
import { addDays, dayLabel, type DayKey } from '../../lib/day';
import { addMonths, dayLocked, md, monthLocked, monthOfWeek, monthWeeks, weekDays, weekLocked } from '../../lib/plan';

export type Zoom = 'year' | 'month' | 'week';

/** 칸 하나. key = 'YYYY-MM'(달) / 주 첫날(주) / 날짜(날). piece = 저장 묶음(해 / 'YYYY-MM' / 주 첫날), idx = 묶음 안 번호 */
export type Unit = { key: string; label: string; long: string; locked: boolean; piece: string; idx: number };

const pad = (n: number) => String(n).padStart(2, '0');

export function unitOf(zoom: Zoom, key: string, today: DayKey): Unit {
  if (zoom === 'year') {
    const [y, m] = key.split('-').map(Number);
    return { key, label: `${m}월`, long: `${y}년 ${m}월`, locked: monthLocked(key, today), piece: String(y), idx: m - 1 };
  }
  if (zoom === 'month') {
    const { ym, index } = monthOfWeek(key);
    const m = Number(ym.slice(5));
    return { key, label: `${index + 1}주`, long: `${m}월 ${index + 1}주 · ${md(key)}–${md(addDays(key, 6))}`, locked: weekLocked(key, today), piece: ym, idx: index };
  }
  const { dow } = dayLabel(key);
  const ws = addDays(key, -new Date(key + 'T00:00:00Z').getUTCDay());
  return { key, label: dow, long: `${dow}요일 ${md(key)}`, locked: dayLocked(key, today), piece: ws, idx: (Date.parse(key) - Date.parse(ws)) / 864e5 };
}

export function nextKey(zoom: Zoom, key: string): string {
  return zoom === 'year' ? addMonths(key, 1) : addDays(key, zoom === 'month' ? 7 : 1);
}

/** 한 기간(해 / 달 / 주)의 칸들 */
export function unitsOf(zoom: Zoom, period: string, today: DayKey): Unit[] {
  if (zoom === 'year') return Array.from({ length: 12 }, (_, i) => unitOf('year', `${period}-${pad(i + 1)}`, today));
  if (zoom === 'month') return monthWeeks(period).map(w => unitOf('month', w, today));
  return weekDays(period).map(d => unitOf('week', d, today));
}

/** 저장된 칸(묶음 + 시작·끝 번호) → 칸 key들 */
export function keysOf(zoom: Zoom, piece: string, s: number, e: number): string[] {
  const all = zoom === 'year' ? Array.from({ length: 12 }, (_, i) => `${piece}-${pad(i + 1)}`) : zoom === 'month' ? monthWeeks(piece) : weekDays(piece);
  return all.slice(s, e + 1);
}

/** 연간 최대 24달, 월간 최대 26주, 주간은 그 주 안 */
const MAX = { year: 24, month: 26, week: 7 };

/** 시작 칸에서 이어 붙일 수 있는 끝 칸들 (찬 칸 앞까지, 주간 참고사항은 그 주 안) */
export function endsFrom(zoom: Zoom, start: string, occupied: Set<string>, today: DayKey, within?: string): Unit[] {
  const out: Unit[] = [];
  let k = start;
  for (let n = 0; n < MAX[zoom]; n++) {
    const u = unitOf(zoom, k, today);
    if (occupied.has(k) || (within && u.piece !== within) || (zoom === 'week' && n > 0 && u.idx === 0)) break;
    out.push(u);
    k = nextKey(zoom, k);
  }
  return out;
}

/** 시작~끝 칸을 묶음(해·달·주)마다 나눈다 */
export function splitRange(zoom: Zoom, start: string, end: string, today: DayKey): { piece: string; s: number; e: number }[] {
  const out: { piece: string; s: number; e: number }[] = [];
  for (let k = start, n = 0; n < 200; k = nextKey(zoom, k), n++) {
    const u = unitOf(zoom, k, today);
    const last = out[out.length - 1];
    if (last && last.piece === u.piece) last.e = u.idx;
    else out.push({ piece: u.piece, s: u.idx, e: u.idx });
    if (k === end) break;
  }
  return out;
}
