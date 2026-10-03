import { Component, type ReactNode } from 'react';
import { Logo } from './Logo';

// 화면을 그리다 오류가 나도 하얀 화면 대신 돌아갈 길을 보여 준다 (2026-10-03 UT)
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box', background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', maxWidth: 320 }}>
          <Logo height={56} />
          <h1 style={{ margin: 0, fontSize: 24 }}>화면을 열지 못했어요</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-neutral-700)' }}>주소가 잘못됐거나 잠깐 문제가 생겼어요. 적어 둔 기록은 그대로예요.</p>
          <button className="btn btn-primary" onClick={() => window.location.assign('/')} style={{ minWidth: 180 }}>처음 화면으로</button>
        </div>
      </div>
    );
  }
}
