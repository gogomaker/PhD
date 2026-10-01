// 모바일 하루 플래너: 그날의 할 일 목록 계산 (SPEC 4.3)
// 실천 종류는 요일 수로 정해진다: 요일 1개 = 단발(못 하면 넘어감), 여러 요일 = 반복 (2026-10-01 기획 결정)
// 반복·자동 배정 할 일은 주간 표 실천에서 계산하고, 행(tasks)은 체크하거나 칠하거나 이름을 붙일 때 만든다.
import { diffDays, type DayKey } from './day';
import { practiceDates } from './plan';

export type PracticeLite = { id: string; goal_id: string; subgoal_id: string; week_start_date: string; name: string; kind: 'repeat' | 'once'; weekdays: number[] };

export type TaskRow = {
  id: string;
  date: string;
  source: 'repeat' | 'auto' | 'picked' | 'direct';
  practice_id: string | null;
  name: string | null;
  daily_keyword_id: string | null;
  is_timed: boolean;
  start_time: string | null;
  end_time: string | null;
  alarm: boolean;
  carried_from_date: string | null;
  carried_task_id: string | null;
  done_at: string | null;
  created_at: string;
};

export type TaskInsert = { date: DayKey; source: TaskRow['source']; practice_id?: string; carried_from_date?: DayKey; carried_task_id?: string };

export type DayItem = {
  /** 그날 안에서의 고유 키 */
  key: string;
  section: 'repeat' | 'day';
  source: TaskRow['source'];
  practice?: PracticeLite;
  /** 직접 추가: 처음 행 (이름·키워드가 여기 있음) */
  direct?: TaskRow;
  /** 이 날의 행 (있으면) */
  row?: TaskRow;
  /** 행이 없을 때 만들 내용 */
  insert?: TaskInsert;
  /** 처음 배정된 날 */
  originDate: DayKey;
  carried: boolean;
  done: boolean;
  /** 1부터. 반복 섹션부터 이어서 (R-S8) */
  num: number;
};

/** 오늘 기준 날짜 관계 (4.4) */
export function relOf(day: DayKey, today: DayKey) {
  return diffDays(today, day);
}

const once1 = (p: PracticeLite) => p.kind === 'once' && p.weekdays.length === 1;

/**
 * closedOn: 마무리한 목표 → 마무리한 날. 그 목표의 실천은 다음 날부터 나오지 않는다 (넘어온 일 포함, 2026-10-01 기획 결정)
 */
export function computeDay(day: DayKey, today: DayKey, allPractices: PracticeLite[], tasks: TaskRow[], closedOn?: Map<string, DayKey>): { repeat: DayItem[]; day: DayItem[] } {
  const rel = relOf(day, today);
  const practices = closedOn?.size ? allPractices.filter(p => { const f = closedOn.get(p.goal_id); return !f || day <= f; }) : allPractices;
  const dates = new Map(practices.map(p => [p.id, practiceDates(p.week_start_date, p.weekdays)]));
  const rowOf = (pred: (t: TaskRow) => boolean) => tasks.find(pred);
  const item = (x: Omit<DayItem, 'done' | 'num'>): DayItem => ({ ...x, done: !!x.row?.done_at, num: 0 });

  // 반복: 반복 실천 중 오늘 요일이 포함된 것 — 넘어가지 않는다
  const repeat = practices
    .filter(p => p.kind === 'repeat' && dates.get(p.id)!.includes(day))
    .map(p => {
      const row = rowOf(t => t.source === 'repeat' && t.practice_id === p.id && t.date === day);
      return item({ key: 'rep:' + p.id, section: 'repeat', source: 'repeat', practice: p, row, insert: row ? undefined : { date: day, source: 'repeat', practice_id: p.id }, originDate: day, carried: false });
    });

  // 자동 배정: 단발 실천 중 요일이 그날 하나뿐인 것
  const auto = practices
    .filter(p => once1(p) && dates.get(p.id)![0] === day)
    .map(p => {
      const row = rowOf(t => t.source === 'auto' && t.practice_id === p.id && t.date === day);
      return item({ key: 'auto:' + p.id, section: 'day', source: 'auto', practice: p, row, insert: row ? undefined : { date: day, source: 'auto', practice_id: p.id }, originDate: day, carried: false });
    });

  // 모레 이후: 배정된 실천만
  if (rel > 1) return number({ repeat, day: auto });

  // 직접 추가 (그날 처음 적은 것)
  const direct = tasks
    .filter(t => t.source === 'direct' && !t.carried_task_id && t.date === day)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(t => item({ key: 'dir:' + t.id, section: 'day', source: 'direct', direct: t, row: t, originDate: day, carried: false }));

  // 넘어온 일 (오늘과 지난 날만): 끝낼 때까지 계속 넘어간다 (기획 결정)
  const carried: DayItem[] = [];
  if (rel <= 0) {
    for (const p of practices.filter(once1)) {
      const origin = dates.get(p.id)![0];
      if (origin >= day) continue;
      const doneRow = tasks.find(t => t.source === 'auto' && t.practice_id === p.id && t.done_at);
      if (doneRow && doneRow.date < day) continue;
      const row = rowOf(t => t.source === 'auto' && t.practice_id === p.id && t.date === day);
      carried.push(item({ key: 'cauto:' + p.id, section: 'day', source: 'auto', practice: p, row, insert: row ? undefined : { date: day, source: 'auto', practice_id: p.id, carried_from_date: origin }, originDate: origin, carried: true }));
    }
    for (const o of tasks.filter(t => t.source === 'direct' && !t.carried_task_id && !t.is_timed && t.date < day)) {
      if (o.done_at) continue;
      const doneRow = tasks.find(t => t.carried_task_id === o.id && t.done_at);
      if (doneRow && doneRow.date < day) continue;
      const row = rowOf(t => t.carried_task_id === o.id && t.date === day);
      carried.push(item({ key: 'cdir:' + o.id, section: 'day', source: 'direct', direct: o, row, insert: row ? undefined : { date: day, source: 'direct', carried_task_id: o.id, carried_from_date: o.date }, originDate: o.date, carried: true }));
    }
    carried.sort((a, b) => a.originDate.localeCompare(b.originDate));
  }

  return number({ repeat, day: [...auto, ...carried, ...direct] });
}

function number(x: { repeat: DayItem[]; day: DayItem[] }) {
  [...x.repeat, ...x.day].forEach((it, i) => { it.num = i + 1; });
  return x;
}

// ───────── 10분 칸 (R-S1: 하루 시작 시각부터 144칸) ─────────
export const SLOTS = 144;

/** 'HH:MM' → 칸 번호 (하루 시작 시각 기준) */
export function slotOf(hm: string, dayStart: number) {
  const [h, m] = hm.split(':').map(Number);
  return ((h - dayStart + 24) % 24) * 6 + Math.floor(m / 10);
}

/** 칸 번호 → 'HH:MM' */
export function timeOf(slot: number, dayStart: number) {
  const mins = (slot * 10 + dayStart * 60) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** 예약 할 일이 차지하는 칸 [시작, 끝) */
export function timedSlots(t: Pick<TaskRow, 'start_time' | 'end_time'>, dayStart: number): [number, number] {
  const s = slotOf(t.start_time!.slice(0, 5), dayStart);
  let e = slotOf(t.end_time!.slice(0, 5), dayStart);
  if (e <= s) e = SLOTS;
  return [s, e];
}

/** 칸 배열 → 같은 값이 이어진 구간들 (끝 포함) */
export function segments<T>(cells: (T | null)[]): { value: T; start: number; end: number }[] {
  const out: { value: T; start: number; end: number }[] = [];
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v == null) continue;
    const last = out[out.length - 1];
    if (last && last.value === v && last.end === i - 1) last.end = i;
    else out.push({ value: v, start: i, end: i });
  }
  return out;
}

/**
 * R-S5 형광펜: 누른 칸부터 현재 칸까지 시간순 구간 전체를 칠한다. 범위 밖 칸은 드래그 전 상태(snapshot)로.
 * skip 칸(예약 블록)은 건드리지 않는다 (R-S6).
 */
export function paint<T>(snapshot: (T | null)[], from: number, to: number, value: T | null, skip?: boolean[]): (T | null)[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const out = snapshot.slice();
  for (let i = lo; i <= hi; i++) if (!skip?.[i]) out[i] = value;
  return out;
}

/** '1h 05m' */
export function fmtMinutes(m: number) {
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
