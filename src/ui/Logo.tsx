// PhD 로고: 펼친 노트 위에 "PhD" (2026-10-01 기획 요청)
// 노트 표지 = 주 색, 책장 = 밝은 종이, 줄 = 연한 선, 책갈피 = 보조 색
export const LOGO_COLORS = { cover: '#c67139', coverDark: '#b2622d', paper: '#f9f4ed', line: '#dcd3c4', spine: '#c0b6a5', ribbon: '#7a8a5e', ink: '#201e1d' };

/** 노트 그림 (viewBox 0 0 132 72). 글자는 따로 */
export function NotebookArt() {
  const c = LOGO_COLORS;
  return (
    <>
      {/* 표지 */}
      <path d="M66 20 C 49 13, 25 13, 5 17 L 5 63 C 25 59, 49 59, 66 66 C 83 59, 107 59, 127 63 L 127 17 C 107 13, 83 13, 66 20 Z" fill={c.cover} />
      <path d="M66 62 C 49 55, 25 55, 5 59 L 5 63 C 25 59, 49 59, 66 66 C 83 59, 107 59, 127 63 L 127 59 C 107 55, 83 55, 66 62 Z" fill={c.coverDark} />
      {/* 책장 */}
      <path d="M66 15 C 51 8, 29 8, 11 12 L 11 57 C 29 53, 51 53, 66 60 Z" fill={c.paper} />
      <path d="M66 15 C 81 8, 103 8, 121 12 L 121 57 C 103 53, 81 53, 66 60 Z" fill={c.paper} />
      {/* 줄 */}
      {[22, 30, 38, 46].map(y => (
        <g key={y} stroke={c.line} strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d={`M17 ${y - 3} C 32 ${y - 6}, 48 ${y - 6}, 61 ${y}`} />
          <path d={`M71 ${y} C 84 ${y - 6}, 100 ${y - 6}, 115 ${y - 3}`} />
        </g>
      ))}
      {/* 가운데 접힌 곳 */}
      <path d="M66 15 L 66 60" stroke={c.spine} strokeWidth="1.6" />
      {/* 책갈피 */}
      <path d="M104 7 L 112 7 L 112 26 L 108 22 L 104 26 Z" fill={c.ribbon} />
    </>
  );
}

/** 사이드바·로그인 화면 로고. height만 정하면 비율대로 */
export function Logo({ height = 52, title = 'PhD' }: { height?: number; title?: string }) {
  return (
    <svg height={height} viewBox="0 0 132 72" role="img" aria-label={title} style={{ display: 'block', flex: 'none', overflow: 'visible' }}>
      <NotebookArt />
      <text x="66" y="47" textAnchor="middle" fontFamily='"Pretendard Variable", Pretendard, system-ui, sans-serif' fontWeight="800" fontSize="30" letterSpacing="-0.5" fill={LOGO_COLORS.ink} stroke={LOGO_COLORS.paper} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">
        PhD
      </text>
    </svg>
  );
}
