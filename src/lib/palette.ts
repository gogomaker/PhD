// 카테고리 7색 (SPEC 6장). bg = 배경, ink = 글자, dot = 점·진한 칠
export const CATEGORY_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const PALETTE: Record<CategoryColor, { name: string; bg: string; ink: string; dot: string }> = {
  red: { name: '빨강', bg: 'oklch(0.9 0.055 25)', ink: 'oklch(0.42 0.11 25)', dot: 'oklch(0.7 0.13 25)' },
  orange: { name: '주황', bg: 'oklch(0.91 0.06 60)', ink: 'oklch(0.44 0.1 55)', dot: 'oklch(0.74 0.13 60)' },
  yellow: { name: '노랑', bg: 'oklch(0.93 0.07 95)', ink: 'oklch(0.44 0.09 85)', dot: 'oklch(0.82 0.13 92)' },
  green: { name: '초록', bg: 'oklch(0.91 0.06 145)', ink: 'oklch(0.4 0.08 145)', dot: 'oklch(0.72 0.12 145)' },
  blue: { name: '파랑', bg: 'oklch(0.91 0.045 245)', ink: 'oklch(0.4 0.09 250)', dot: 'oklch(0.7 0.1 245)' },
  purple: { name: '보라', bg: 'oklch(0.9 0.05 300)', ink: 'oklch(0.42 0.1 300)', dot: 'oklch(0.7 0.11 300)' },
  pink: { name: '분홍', bg: 'oklch(0.91 0.05 350)', ink: 'oklch(0.43 0.1 350)', dot: 'oklch(0.74 0.11 350)' },
};
