import type { Goal, GoalStatus } from '../account/AccountProvider';

export const MAX_GOAL_NAME = 40;
export const MAX_SUBGOAL_NAME = 40;

export const STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  completed: '완성',
  dropped: '중도 마무리',
};

export const IMPORTANCE = [
  ['high', '높음'],
  ['mid', '보통'],
  ['low', '낮음'],
] as const;

export function isClosed(g: Pick<Goal, 'status'>) {
  return g.status === 'completed' || g.status === 'dropped';
}

/** '2027-09-01' → '27.09' (꿈 보드 카드) */
export function dueShort(due: string) {
  return due.slice(2, 4) + '.' + due.slice(5, 7);
}

/** '2027-09-01' → '2027-09' (기한 고르기 값) */
export function dueValue(due: string) {
  return due.slice(0, 7);
}

/** R-G8: 마무리한 목표는 맨 아래, 나머지는 순서대로 */
export function sortGoals<T extends Pick<Goal, 'status' | 'position' | 'created_at'>>(goals: T[]): T[] {
  return [...goals].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)) || a.position - b.position || a.created_at.localeCompare(b.created_at));
}
