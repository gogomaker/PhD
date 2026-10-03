import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { clearUndo, runUndo, typing } from './plan/undo';
import { Icon, ICON } from '../Icon';
import { Logo } from '../ui/Logo';
import { ScrollArea } from '../ui/ScrollArea';
import { StartChecklist } from './StartChecklist';
import { SideDday } from './Dday';
import { useAccount } from '../account/AccountProvider';
import CategoriesPage from './CategoriesPage';
import DreamPage from './DreamPage';
import GoalsPage from './GoalsPage';
import BoardPage from './BoardPage';
import YearPlan from './plan/YearPlan';
import MonthPlan from './plan/MonthPlan';
import WeekPlan from './plan/WeekPlan';
import AccountPage from './AccountPage';
import TrackingPage from './TrackingPage';
import TodayPage from './TodayPage';
import ReviewsPage from './ReviewsPage';
import TutorialPage from './TutorialPage';
import { initials } from '../lib/initials';

type ScreenKey = keyof typeof ICON;

// 사이드바 그룹 (SPEC 5장 화면 목록, 목업 NAV 순서)
const NAV: [string, [ScreenKey, string, string][]][] = [
  ['꿈', [['dreamWrite', '꿈 작성', '/dream']]],
  ['목표', [['cats', '인생 카테고리', '/categories'], ['goals', '목표 설정', '/goals'], ['dream', '꿈 보드', '/board']]],
  ['계획', [['year', '연간 계획', '/plan/year'], ['month', '월간 계획', '/plan/month'], ['week', '주간 계획', '/plan/week']]],
  ['기록', [['today', '오늘', '/today'], ['track', '트래킹', '/tracking'], ['reviews', '회고 모음', '/reviews']]],
];


export default function DesktopShell() {
  const { pathname } = useLocation();
  useEffect(() => clearUndo(), [pathname]);
  // Ctrl+Z(⌘Z): 계획 표에서 방금 지운 것 되돌리기 (2026-10-03 UT 11)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing() && runUndo()) e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 'var(--offline-h, 0px)', boxSizing: 'border-box' }}>
      <Sidebar />
      <main className="desk-main" style={{ flex: 1, minWidth: 0, padding: '36px 44px 56px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Routes>
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/dream" element={<DreamPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/plan/year" element={<YearPlan />} />
          <Route path="/plan/month" element={<MonthPlan />} />
          <Route path="/plan/week" element={<WeekPlan />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Sidebar() {
  const { profile } = useAccount();
  const dream = profile?.dream?.trim();
  const name = profile?.name ?? '';
  return (
    <aside className="side" style={{ flex: 'none', width: 236, position: 'sticky', top: 'var(--offline-h, 0px)', height: 'calc(100vh - var(--offline-h, 0px))', padding: 14, boxSizing: 'border-box' }}>
      <ScrollArea className="side-inner" fade="var(--color-surface)" radius={32} style={{ height: '100%', background: 'var(--color-surface)', borderRadius: 32 }} innerStyle={{ padding: '24px 14px 14px', display: 'flex', flexDirection: 'column', gap: 22, boxSizing: 'border-box' }}>
        <div className="side-logo" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          <Logo height={50} />
          <span className="side-hide" style={{ fontSize: 12, color: 'var(--color-neutral-700)', letterSpacing: '.02em' }}>Plan Higher Dream</span>
        </div>
        <div className="side-hide"><StartChecklist /></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {NAV.map(([label, items]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="side-hide" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--color-neutral-600)', padding: '0 14px 4px' }}>{label}</span>
              {items.map(([icon, text, to]) => (
                <NavLink key={to} to={to} title={text} aria-label={text} className={({ isActive }) => 'btn nav-item' + (isActive ? ' active' : '')}>
                  <Icon name={icon} />
                  <span className="side-hide">{text}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-hide" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SideDday />
        <NavLink to="/dream" title="꿈 작성으로 이동" className="side-card dream-card" style={{ borderRadius: 24, padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--color-accent-800)' }}>나의 꿈</span>
          {dream ? (
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>{dream}</span>
          ) : (
            <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-accent-900)' }}>
              아직 꿈을 적지 않았어요 · <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>쓰기</span>
            </span>
          )}
        </NavLink>
        </div>
        <NavLink to="/account" className={({ isActive }) => 'side-card account-card' + (isActive ? ' active' : '')} style={{ borderRadius: 24, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', background: 'var(--color-accent-2)', color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{initials(name)}</span>
          <span className="side-hide" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>계정 관리</span>
          </span>
        </NavLink>
      </ScrollArea>
    </aside>
  );
}
