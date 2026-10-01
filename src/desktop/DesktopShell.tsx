import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Icon, ICON } from '../Icon';
import { useAccount } from '../account/AccountProvider';
import CategoriesPage from './CategoriesPage';
import AccountPage from './AccountPage';
import { initials } from '../lib/initials';

type ScreenKey = keyof typeof ICON;

// 사이드바 그룹 (SPEC 5장 화면 목록, 목업 NAV 순서)
const NAV: [string, [ScreenKey, string, string][]][] = [
  ['꿈', [['dreamWrite', '꿈 작성', '/dream']]],
  ['목표', [['cats', '인생 카테고리', '/categories'], ['goals', '목표 설정', '/goals'], ['dream', '꿈 보드', '/board']]],
  ['계획', [['year', '연간 계획', '/plan/year'], ['month', '월간 계획', '/plan/month'], ['week', '주간 계획', '/plan/week']]],
  ['기록', [['track', '트래킹', '/tracking'], ['reviews', '회고 모음', '/reviews']]],
];

// 각 화면이 만들어지는 단계 (SPEC 7장)
const PAGES: { path: string; group: string; title: string; stage: string }[] = [
  { path: '/dream', group: '꿈', title: '궁극적인 꿈', stage: 'M2' },
  { path: '/categories', group: '목표', title: '인생 카테고리', stage: 'M1' },
  { path: '/goals', group: '목표', title: '목표 설정', stage: 'M2' },
  { path: '/board', group: '목표', title: '꿈 보드', stage: 'M2' },
  { path: '/plan/year', group: '계획', title: '연간 계획', stage: 'M3' },
  { path: '/plan/month', group: '계획', title: '월간 계획', stage: 'M3' },
  { path: '/plan/week', group: '계획', title: '주간 계획', stage: 'M3' },
  { path: '/tracking', group: '기록', title: '트래킹', stage: 'M5' },
  { path: '/reviews', group: '기록', title: '회고 모음', stage: 'M5' },
  { path: '/account', group: '계정', title: '계정 관리', stage: 'M1' },
];

export default function DesktopShell() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: '36px 44px 56px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Routes>
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/account" element={<AccountPage />} />
          {PAGES.filter(p => p.stage !== 'M1').map(p => (
            <Route key={p.path} path={p.path} element={<Placeholder {...p} />} />
          ))}
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
    <aside style={{ flex: 'none', width: 236, position: 'sticky', top: 0, height: '100vh', padding: 14, boxSizing: 'border-box' }}>
      <div style={{ height: '100%', background: 'var(--color-surface)', borderRadius: 32, padding: '24px 14px 14px', display: 'flex', flexDirection: 'column', gap: 22, boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 1 }}>PhD</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', letterSpacing: '.02em' }}>Plan Higher Dream</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {NAV.map(([label, items]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--color-neutral-600)', padding: '0 14px 4px' }}>{label}</span>
              {items.map(([icon, text, to]) => (
                <NavLink key={to} to={to} className={({ isActive }) => 'btn nav-item' + (isActive ? ' active' : '')}>
                  <Icon name={icon} />
                  {text}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <NavLink to="/dream" title="꿈 작성으로 이동" className="side-card dream-card" style={{ marginTop: 'auto', borderRadius: 24, padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--color-accent-800)' }}>나의 꿈</span>
          {dream ? (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.3 }}>{dream}</span>
          ) : (
            <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-accent-900)' }}>
              아직 꿈을 적지 않았어요 · <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>쓰기</span>
            </span>
          )}
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => 'side-card account-card' + (isActive ? ' active' : '')} style={{ borderRadius: 24, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', background: 'var(--color-accent-2)', color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{initials(name)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>계정 관리</span>
          </span>
        </NavLink>
      </div>
    </aside>
  );
}

function Placeholder({ group, title, stage }: { group: string; title: string; stage: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 900 }}>
      <span className="tag tag-accent" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>{group} · {title}</span>
      <h1 style={{ margin: 0, fontSize: 42 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>{stage} 단계에서 만들어요.</p>
    </div>
  );
}
