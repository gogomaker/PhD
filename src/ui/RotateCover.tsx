import { usePhoneLandscape } from '../useIsMobile';

// 휴대폰을 가로로 돌리면 화면을 덮고 세로로 돌려 달라고 안내한다. 아래 화면은 그대로 두어 쓰던 내용이 남는다 (2026-10-03 UT 3차)
// 설치한 앱(안드로이드)은 manifest의 orientation: portrait로 아예 돌아가지 않는다
export function RotateCover() {
  const landscape = usePhoneLandscape();
  if (!landscape) return null;
  return (
    <div data-testid="rotate-cover" role="alertdialog" aria-modal="true" aria-label="세로로 돌려 주세요" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-bg)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', touchAction: 'none' }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.75 }}>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </svg>
      <div style={{ fontSize: 18, fontWeight: 700 }}>휴대폰을 세로로 돌려 주세요</div>
      <div style={{ fontSize: 14, opacity: 0.7 }}>PhD는 세로 화면에서 써요. 쓰던 내용은 그대로 있어요.</div>
    </div>
  );
}
