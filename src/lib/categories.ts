import { CATEGORY_COLORS, type CategoryColor } from './palette';

// R-C1: 목표 카테고리 최대 6개 + 일상 1개 = 7색, 색은 겹치지 않는다
export const MAX_GOAL_CATEGORIES = 6;
export const MAX_CATEGORY_NAME = 20;
export const MAX_KEYWORD_NAME = 10;

/** 아직 아무도 쓰지 않는 첫 색 (빨강부터) */
export function firstFreeColor(used: readonly string[]): CategoryColor | null {
  return CATEGORY_COLORS.find(c => !used.includes(c)) ?? null;
}

export type DraftCategory = { name: string; color: CategoryColor };

/** 가입 3단계 칩 누르기: 있으면 빼고, 없으면 빈 색으로 넣는다(6개가 찼으면 그대로) */
export function toggleDraft(draft: DraftCategory[], name: string, dailyColor: CategoryColor): DraftCategory[] {
  const clean = name.trim().slice(0, MAX_CATEGORY_NAME);
  if (!clean) return draft;
  if (draft.some(d => d.name === clean)) return draft.filter(d => d.name !== clean);
  if (draft.length >= MAX_GOAL_CATEGORIES) return draft;
  const color = firstFreeColor([dailyColor, ...draft.map(d => d.color)]);
  return color ? [...draft, { name: clean, color }] : draft;
}
