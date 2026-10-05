import { CATEGORY_COLORS, type CategoryColor } from './palette';

// R-C1: 목표 카테고리 최대 6개 + 일상 1개 = 7색, 색은 겹치지 않는다
export const MAX_GOAL_CATEGORIES = 6;
export const MAX_CATEGORY_NAME = 20;
export const MAX_KEYWORD_NAME = 10;
/** 일상 키워드는 최대 6개 — 시간표 위 붓 줄이 한 줄에 들어가게 (2026-10-05 기획 요청, DB도 막음) */
export const MAX_KEYWORDS = 6;

/**
 * 목표 카테고리 색은 순서로 정해진다: 빨강 → 주황 → … → 분홍에서 일상 색을 건너뛰고 차례로.
 * 순서를 바꾸면 색도 바뀐다. (DB 트리거 recolor_goal_categories와 같은 규칙)
 */
export function goalColor(index: number, dailyColor: CategoryColor): CategoryColor {
  return CATEGORY_COLORS.filter(c => c !== dailyColor)[index];
}

/** 가입 3단계 칩 누르기: 있으면 빼고, 없으면 맨 뒤에 넣는다(6개가 찼으면 그대로) */
export function toggleDraft(draft: string[], name: string): string[] {
  const clean = name.trim().slice(0, MAX_CATEGORY_NAME);
  if (!clean) return draft;
  if (draft.includes(clean)) return draft.filter(d => d !== clean);
  if (draft.length >= MAX_GOAL_CATEGORIES) return draft;
  return [...draft, clean];
}
