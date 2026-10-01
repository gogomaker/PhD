import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useIsMobile } from './useIsMobile';
import { useAccount } from './account/AccountProvider';
import { ForgotPassword, Login, Onboarding, ResetPassword, SignupAccount } from './auth/AuthScreen';
import DesktopShell from './desktop/DesktopShell';
import DayPlanner from './mobile/DayPlanner';
import { Logo } from './ui/Logo';

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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 가입 1단계(계정)만 끝내고 나간 경우, 다시 들어오면 2단계부터 이어서
  if (status === 'onboarding') {
    return pathname === '/signup' ? <Onboarding /> : <Navigate to="/signup" replace />;
  }

  // 가입을 마치면 목표 설정으로, 로그인하면 꿈 보드로 (목업 흐름)
  if (pathname === '/signup') return <Navigate to="/goals" replace />;
  if (pathname === '/login' || pathname === '/forgot-password') return <Navigate to="/board" replace />;
  return mobile ? <DayPlanner /> : <DesktopShell />;
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <span style={{ opacity: 0.6 }}><Logo height={64} /></span>
    </div>
  );
}
