import { describe, expect, it } from 'vitest';
import { computeDay, nowSlot, paint, segments, slotOf, timeOf, timedSlots, type PracticeLite, type TaskRow } from './today';

// 2026-09-27(일) 주. 목 = 10-01
const W = '2026-09-27';
const P = (id: string, kind: 'repeat' | 'once', weekdays: number[], week = W): PracticeLite => ({ id, goal_id: 'g', subgoal_id: 's', week_start_date: week, name: id, kind, weekdays });
let n = 0;
const T = (x: Partial<TaskRow> & Pick<TaskRow, 'date' | 'source'>): TaskRow => ({
  id: 't' + ++n, practice_id: null, name: null, daily_keyword_id: null, is_timed: false, start_time: null, end_time: null, alarm: false,
  carried_from_date: null, carried_task_id: null, done_at: null, created_at: '2026-09-27T00:00:00Z', ...x,
});
const keys = (d: { repeat: { key: string }[]; day: { key: string }[] }) => [...d.repeat, ...d.day].map(x => x.key);

describe('할 일이 생기는 방법 (4.3)', () => {
  const ps = [P('thu', 'once', [4]), P('rep', 'repeat', [1, 2, 3, 4, 5, 6, 7]), P('wedfri', 'repeat', [3, 4, 5])];
  it('주간 표 목요일 칸 실천이 목요일 "오늘 할 일"에 자동으로', () => {
    const d = computeDay('2026-10-01', '2026-10-01', ps, []);
    expect(d.day.map(x => x.key)).toContain('auto:thu');
    expect(d.repeat.map(x => x.key)).toEqual(['rep:rep', 'rep:wedfri']);
  });
  it('여러 요일 실천은 고른 요일마다 반복으로 (기획 결정)', () => {
    const d = computeDay('2026-10-01', '2026-10-01', ps, []);
    expect(d.repeat.map(x => x.key)).toEqual(['rep:rep', 'rep:wedfri']);
    expect(keys(computeDay('2026-10-04', '2026-10-01', ps, []))).not.toContain('rep:wedfri');
  });
  it('번호는 반복 섹션부터 이어서 (R-S8)', () => {
    const d = computeDay('2026-10-01', '2026-10-01', ps, []);
    expect([...d.repeat, ...d.day].map(x => x.num)).toEqual([1, 2, 3]);
  });
});

describe('못 했을 때 (4.3)', () => {
  const ps = [P('wed', 'once', [3]), P('rep', 'repeat', [3, 4])];
  it('반복은 다음 날로 안 넘어간다', () => {
    const d = computeDay('2026-10-01', '2026-10-01', ps, []);
    expect(keys(d)).toEqual(['rep:rep', 'cauto:wed']);
  });
  it('단발 자동 배정은 다음 날로 넘어가고 "어제에서"', () => {
    const d = computeDay('2026-10-01', '2026-10-01', ps, []);
    const c = d.day.find(x => x.key === 'cauto:wed')!;
    expect(c.carried).toBe(true);
    expect(c.originDate).toBe('2026-09-30');
    expect(c.insert).toEqual({ date: '2026-10-01', source: 'auto', practice_id: 'wed', carried_from_date: '2026-09-30' });
  });
  it('끝낼 때까지 계속 넘어간다 (기획 결정)', () => {
    expect(keys(computeDay('2026-10-03', '2026-10-03', ps, []))).toContain('cauto:wed');
  });
  it('그날 했으면 안 넘어간다', () => {
    const done = T({ date: '2026-09-30', source: 'auto', practice_id: 'wed', done_at: 'x' });
    expect(keys(computeDay('2026-10-01', '2026-10-01', ps, [done]))).not.toContain('cauto:wed');
  });
  it('넘어간 날 끝내면 그 다음 날부터 사라지고, 지난 날 기록은 미완료로 남는다', () => {
    const doneThu = T({ date: '2026-10-01', source: 'auto', practice_id: 'wed', carried_from_date: '2026-09-30', done_at: 'x' });
    const thu = computeDay('2026-10-01', '2026-10-02', ps, [doneThu]);
    expect(thu.day.find(x => x.key === 'cauto:wed')!.done).toBe(true);
    expect(keys(computeDay('2026-10-02', '2026-10-02', ps, [doneThu]))).not.toContain('cauto:wed');
    const wed = computeDay('2026-09-30', '2026-10-02', ps, [doneThu]);
    expect(wed.day.find(x => x.key === 'auto:wed')!.done).toBe(false);
  });
  it('직접 추가는 넘어가고, 예약은 안 넘어간다', () => {
    const plain = T({ date: '2026-09-30', source: 'direct', name: '장보기', daily_keyword_id: 'k' });
    const timed = T({ date: '2026-09-30', source: 'direct', name: '치과', daily_keyword_id: 'k', is_timed: true, start_time: '15:00', end_time: '16:00' });
    const d = computeDay('2026-10-01', '2026-10-01', [], [plain, timed]);
    expect(keys(d)).toEqual(['cdir:' + plain.id]);
    expect(d.day[0].insert).toEqual({ date: '2026-10-01', source: 'direct', carried_task_id: plain.id, carried_from_date: '2026-09-30' });
  });
});

describe('마무리한 목표의 실천 (기획 결정)', () => {
  const ps = [P('wed', 'once', [3]), P('rep', 'repeat', [3, 4, 5])];
  const closed = new Map([['g', '2026-09-30']]);
  it('마무리한 날까지는 나오고, 다음 날부터 사라진다 (넘어온 일 포함)', () => {
    expect(keys(computeDay('2026-09-30', '2026-09-30', ps, [], closed))).toEqual(['rep:rep', 'auto:wed']);
    expect(keys(computeDay('2026-10-01', '2026-10-01', ps, [], closed))).toEqual([]);
  });
  it('다른 목표의 실천은 그대로', () => {
    expect(keys(computeDay('2026-10-01', '2026-10-01', ps, [], new Map([['other', '2026-09-30']])))).toEqual(['rep:rep', 'cauto:wed']);
  });
});

describe('모레 이후', () => {
  it('배정된 실천만 (담은 일·직접 추가·넘어온 일 없음)', () => {
    const ps = [P('fri', 'once', [5]), P('wed', 'once', [3]), P('rep', 'repeat', [6])];
    const direct = T({ date: '2026-10-03', source: 'direct', name: 'x', daily_keyword_id: 'k' });
    expect(keys(computeDay('2026-10-03', '2026-10-01', ps, [direct]))).toEqual(['rep:rep']);
    expect(keys(computeDay('2026-10-02', '2026-10-01', ps, []))).toEqual(['auto:fri']);
  });
});

describe('10분 칸 (R-S1, R-D1)', () => {
  it('하루 시작 5시: 05:00 = 0칸, 새벽 1시 = 120칸', () => {
    expect(slotOf('05:00', 5)).toBe(0);
    expect(slotOf('01:00', 5)).toBe(120);
    expect(timeOf(120, 5)).toBe('01:00');
    expect(timeOf(144, 5)).toBe('05:00');
  });
  it('예약 칸 [시작, 끝)', () => {
    expect(timedSlots({ start_time: '15:00:00', end_time: '16:00:00' }, 5)).toEqual([60, 66]);
  });
});

describe('형광펜 (R-S5)', () => {
  const empty = Array<string | null>(12).fill(null);
  it('대각선(여러 줄)으로 끌어도 사이 칸이 전부 칠해진다', () => {
    const a = paint(empty, 2, 9, 'A');
    expect(a.filter(Boolean).length).toBe(8);
  });
  it('되돌리면 드래그 전 상태로 (스냅샷)', () => {
    const snap = paint(empty, 6, 7, 'B');
    const wide = paint(snap, 2, 9, 'A');
    expect(wide[6]).toBe('A');
    const back = paint(snap, 2, 4, 'A');
    expect(back[6]).toBe('B');
    expect(back[5]).toBe(null);
  });
  it('거꾸로 긋기', () => {
    expect(paint(empty, 9, 2, 'A')).toEqual(paint(empty, 2, 9, 'A'));
  });
  it('예약 칸은 건너뛴다 (R-S6)', () => {
    const skip = empty.map((_, i) => i === 5);
    expect(paint(empty, 2, 9, 'A', skip)[5]).toBe(null);
  });
  it('구간으로 묶기 (R-S4)', () => {
    expect(segments(['A', 'A', null, 'A', 'B', 'B'])).toEqual([{ value: 'A', start: 0, end: 1 }, { value: 'A', start: 3, end: 3 }, { value: 'B', start: 4, end: 5 }]);
  });
});

describe('nowSlot (2026-10-03 UT: 실제는 지금 칸까지만)', () => {
  it('05시 시작: 서울 16:53 → 71번째 칸 (16:50~17:00)', () => {
    expect(nowSlot(new Date('2026-10-03T07:53:00Z'), 'Asia/Seoul', 5)).toBe(71);
  });
  it('하루 시작 직후·직전', () => {
    expect(nowSlot(new Date('2026-10-02T20:00:00Z'), 'Asia/Seoul', 5)).toBe(0);
    expect(nowSlot(new Date('2026-10-02T19:59:00Z'), 'Asia/Seoul', 5)).toBe(143);
  });
});
