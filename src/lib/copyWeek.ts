// 지난주 실천 가져오기 (2026-10-06 기획 결정): 반복은 한 주 단위 그대로 두고, 새 주에 지난주 실천을 복사한다.
// 지난 요일은 빼고(R-P12), 마무리한 목표와 이번 주에 이미 있는 실천(같은 목표·세부목표·이름)은 건너뛴다
import { addDays, dayLabel, type DayKey } from './day';
import { dayLocked, fmtDays, practiceDates, weekDays } from './plan';

export type CopySrc = { id: string; goal_id: string; subgoal_id: string; week_start_date: string; name: string; weekdays: number[]; start_time: string | null; end_time: string | null };
/** weekdays = 이번 주에 넣을 요일(지난 요일을 뺀 것), trimmed = 지난 요일이 빠졌음 */
export type CopyItem = { src: CopySrc; weekdays: number[]; trimmed: boolean };

const sameKey = (a: Pick<CopySrc, 'goal_id' | 'subgoal_id' | 'name'>, b: Pick<CopySrc, 'goal_id' | 'subgoal_id' | 'name'>) =>
  a.goal_id === b.goal_id && a.subgoal_id === b.subgoal_id && a.name.trim() === b.name.trim();

/** week 주에 가져올 수 있는 앞 주의 실천 */
export function prevWeekItems(practices: CopySrc[], week: DayKey, today: DayKey, openGoal: (goalId: string) => boolean): CopyItem[] {
  const prev = addDays(week, -7);
  const here = practices.filter(p => p.week_start_date === week);
  return practices
    .filter(p => p.week_start_date === prev && openGoal(p.goal_id) && !here.some(h => sameKey(h, p)))
    .map(p => {
      const weekdays = p.weekdays.filter(w => !dayLocked(practiceDates(week, [w])[0], today));
      return { src: p, weekdays, trimmed: weekdays.length < p.weekdays.length };
    })
    .filter(x => x.weekdays.length > 0);
}

/** 목록에 보일 요일: '월·수·금', '수–토', '매일' */
export function copyDays(week: DayKey, weekdays: number[]) {
  const days = weekDays(week);
  return fmtDays(practiceDates(week, weekdays).map(d => days.indexOf(d)), days.map(d => dayLabel(d).dow));
}

/** 저장할 행 (days = 가져올 때 고친 요일, 없으면 그대로) */
export const copyRow = (x: CopyItem, week: DayKey, days = x.weekdays) => ({
  goal_id: x.src.goal_id,
  subgoal_id: x.src.subgoal_id,
  week_start_date: week,
  name: x.src.name,
  weekdays: [...days].sort((a, b) => a - b),
  ...(x.src.start_time ? { start_time: x.src.start_time, end_time: x.src.end_time } : {}),
});
