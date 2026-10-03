import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useIsMobile } from './useIsMobile';
import { useAccount } from './account/AccountProvider';
import { ForgotPassword, Landing, Login, Onboarding, ResetPassword, SignupAccount } from './auth/AuthScreen';
import { Logo } from './ui/Logo';

// 휴대폰은 모바일 앱만, 넓은 화면은 데스크톱만 내려받는다
const DesktopShell = lazy(() => import('./desktop/DesktopShell'));
const MobileApp = lazy(() => import('./mobile/MobileApp'));

export default function App() {
  const { status } = useAccount();
  const mobile = useIsMobile();
  const { pathname } = useLocation();

  if (status === 'loading') return <Splash />;
  // 메일 링크로 들어오면 로그인된 상태로 새 비밀번호를 정한다
  if (pathname === '/reset-password') return <ResetPassword />;

  if (status === 'signedOut') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignupAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* 휴대폰은 첫 화면(시작하기 / 이미 계정이 있어요)부터, 넓은 화면은 바로 로그인 */}
        <Route path="/" element={mobile ? <Landing /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={mobile ? '/' : '/login'} replace />} />
      </Routes>
    );
  }

  // 가입 1단계(계정)만 끝내고 나간 경우, 다시 들어오면 2단계부터 이어서
  if (status === 'onboarding') {
    return pathname === '/signup' ? <Onboarding /> : <Navigate to="/signup" replace />;
  }

  // 가입을 마치면 목표 설정으로, 로그인하면 꿈 보드로 (목업 흐름). 휴대폰은 계획 › 목표 / 첫 화면으로 (docs/MOBILE.md)
  if (pathname === '/signup') return <Navigate to={mobile ? '/plan' : '/goals'} replace />;
  if (pathname === '/login' || pathname === '/forgot-password') return <Navigate to={mobile ? '/' : '/board'} replace />;
  return <Suspense fallback={<Splash />}>{mobile ? <MobileApp /> : <DesktopShell />}</Suspense>;
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <span style={{ opacity: 0.6 }}><Logo height={64} /></span>
    </div>
  );
}
