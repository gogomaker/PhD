// 카테고리 7색 (SPEC 6장). bg = 배경, ink = 글자, dot = 점·진한 칠
// 실제 값은 src/styles/theme.css (라이트·다크 따로)
export const CATEGORY_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const PALETTE: Record<CategoryColor, { name: string; bg: string; ink: string; dot: string }> = {
  red: { name: '빨강', bg: 'var(--cat-red-bg)', ink: 'var(--cat-red-ink)', dot: 'var(--cat-red-dot)' },
  orange: { name: '주황', bg: 'var(--cat-orange-bg)', ink: 'var(--cat-orange-ink)', dot: 'var(--cat-orange-dot)' },
  yellow: { name: '노랑', bg: 'var(--cat-yellow-bg)', ink: 'var(--cat-yellow-ink)', dot: 'var(--cat-yellow-dot)' },
  green: { name: '초록', bg: 'var(--cat-green-bg)', ink: 'var(--cat-green-ink)', dot: 'var(--cat-green-dot)' },
  blue: { name: '파랑', bg: 'var(--cat-blue-bg)', ink: 'var(--cat-blue-ink)', dot: 'var(--cat-blue-dot)' },
  purple: { name: '보라', bg: 'var(--cat-purple-bg)', ink: 'var(--cat-purple-ink)', dot: 'var(--cat-purple-dot)' },
  pink: { name: '분홍', bg: 'var(--cat-pink-bg)', ink: 'var(--cat-pink-ink)', dot: 'var(--cat-pink-dot)' },
};
