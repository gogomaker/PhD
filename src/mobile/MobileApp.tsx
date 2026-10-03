// 모바일 앱 (폭 768px 미만). 생김새 = 'PhD only for Mobile v2' 목업, 기능 = 지금까지의 데스크톱·모바일 (docs/MOBILE.md)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAccount, useToday } from '../account/AccountProvider';
import { initials } from '../lib/initials';
import { Logo } from '../ui/Logo';
import { BODY, ICON, PageBar, Svg, TabTitles } from './ui';
import { MobileStore, useMobile } from './store';
import { mobilePathFor, parseRoute, TAB_PATH, type MRoute, type Pane, type Tab } from './routes';
import { ensurePush, pushSupported } from './push';
import GoalsTab from './plan/GoalsTab';
import ScheduleTab from './plan/ScheduleTab';
import TodayTab from './record/TodayTab';
import ReviewTab from './record/ReviewTab';
import GoalPage from './pages/GoalPage';
import CategoriesPage from './pages/CategoriesPage';
import DreamPage from './pages/DreamPage';
import SettingsPage from './pages/SettingsPage';
import TutorialPage from './pages/TutorialPage';
import { AccountSheet } from './AccountSheet';
import { ddayText } from '../lib/dday';
import { isDayKey } from '../lib/day';

export default function MobileApp() {
  return (
    <MobileStore>
      <Shell />
    </MobileStore>
  );
}

const PLAN_TABS: [Tab, string][] = [['goals', '목표'], ['schedule', '일정']];
const REC_TABS: [Tab, string][] = [['today', '오늘'], ['review', '돌아보기']];
const histIdx = () => ((window.history.state ?? {}) as { idx?: number }).idx ?? 0;

function Shell() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { profile, practices } = useAccount();
  const { recheck } = useMobile();
  const route = parseRoute(loc.pathname);
  // 탭마다 마지막으로 보던 주소, 마지막으로 보던 쪽 (계획/기록)
  const last = useRef<Record<Tab, string>>({ ...TAB_PATH });
  const lastTab = useRef<Record<Pane, Tab>>({ plan: 'goals', record: 'today' });
  const lastPane = useRef<Pane>('plan');
  const [account, setAccount] = useState(false);

  const pane: Pane = route?.kind === 'pane' ? route.pane : route?.page === 'settings' ? lastPane.current : 'plan';
  const [seen, setSeen] = useState<Record<Pane, boolean>>({ plan: pane === 'plan', record: pane === 'record' });

  useEffect(() => {
    if (route?.kind !== 'pane') return;
    last.current[route.tab] = loc.pathname + loc.search;
    lastTab.current[route.pane] = route.tab;
    lastPane.current = route.pane;
  });
  useEffect(() => {
    setSeen(s => (s[pane] ? s : { ...s, [pane]: true }));
    // 기록하고 계획으로 돌아오면 시작하기 체크리스트를 다시 확인
    if (pane === 'plan') recheck();
  }, [pane, recheck]);

  // 이미 알림을 허락한 기기는 조용히 다시 등록 (회고 알림·알람)
  useEffect(() => {
    if (profile?.review_notify_enabled && pushSupported() && Notification.permission === 'granted') ensurePush();
  }, [profile?.review_notify_enabled]);

  // 밀려 들어오는 화면은 닫힐 때도 미끄러져 나가도록 마지막 내용을 잠깐 남긴다
  const page = route?.kind === 'page' ? route : null;
  const [kept, setKept] = useState<Extract<MRoute, { kind: 'page' }> | null>(page);
  const pageKey = page ? page.page + (page.id ?? '') : '';
  useEffect(() => {
    if (page) setKept(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);
  const shownPage = page ?? kept;

  if (!route) {
    const to = mobilePathFor(loc.pathname, loc.search) ?? (practices.length ? '/record' : '/plan');
    return <Navigate to={to} replace />;
  }

  const goTab = (t: Tab) => navigate(last.current[t]);
  const goPane = (p: Pane) => goTab(lastTab.current[p]);
  const closePage = () => (histIdx() > 0 ? navigate(-1) : navigate(last.current[lastTab.current[pane]], { replace: true }));
  const curTab = (p: Pane) => (route.kind === 'pane' && route.pane === p ? route.tab : lastTab.current[p]);
  const rec = pane === 'record';
  const pageOpen = !!page;

  return (
    <div className="m-clip" style={{ position: 'relative', height: '100dvh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', paddingTop: 'calc(env(safe-area-inset-top) + var(--offline-h, 0px))', boxSizing: 'border-box' }}>
      {/* 앱바: 로고 · 계획/기록 · 내 이니셜 */}
      <header style={{ flex: 'none', height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 0 16px' }}>
        <Logo height={38} />
        <div style={{ flex: 1 }} />
        <div role="group" aria-label="계획과 기록" style={{ position: 'relative', flex: 'none', display: 'flex', width: 'min(196px, 52vw)', height: 44, padding: 4, boxSizing: 'border-box', borderRadius: 999, background: 'var(--color-surface)' }}>
          <span style={{ position: 'absolute', top: 4, left: 4, width: 'calc(50% - 4px)', height: 36, borderRadius: 999, background: rec ? 'var(--color-accent)' : 'var(--color-accent-2)', transform: rec ? 'translateX(100%)' : 'none', transition: 'transform .5s cubic-bezier(.2,.8,.2,1), background-color .5s ease', boxShadow: 'var(--shadow-sm)' }} />
          {(
            [
              ['plan', '계획', ICON.calendar],
              ['record', '기록', ICON.clock],
            ] as const
          ).map(([k, label, d]) => {
            const on = pane === k && !pageOpen;
            return (
              <button key={k} aria-pressed={pane === k} onClick={() => (on ? undefined : goPane(k))} style={{ position: 'relative', flex: 1, border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 999, ...BODY, fontSize: 14, color: pane === k ? 'var(--color-bg)' : 'var(--color-neutral-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color .35s', padding: 0 }}>
                <Svg d={d} size={15} />{label}
              </button>
            );
          })}
        </div>
        <button onClick={() => setAccount(true)} aria-label="계정" style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: 0, cursor: 'pointer', background: 'var(--color-accent-2)', color: 'var(--color-bg)', ...BODY, fontSize: 12, padding: 0 }}>
          {initials(profile?.name ?? '')}
        </button>
      </header>

      <div className="m-clip" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <PaneBox on={!rec} side={-1} blocked={pageOpen}>
          <TabTitles tabs={PLAN_TABS} cur={curTab('plan')} onPick={goTab} />
          {seen.plan && (curTab('plan') === 'goals' ? <GoalsTab /> : <ScheduleTab />)}
        </PaneBox>
        <PaneBox on={rec} side={1} blocked={pageOpen}>
          <TabTitles tabs={REC_TABS} cur={curTab('record')} onPick={goTab} right={curTab('record') === 'today' ? <DdayChip /> : undefined} />
          {seen.record && (curTab('record') === 'today' ? <TodayTab /> : <ReviewTab />)}
        </PaneBox>

        {/* 오른쪽에서 밀려 들어오는 화면: 목표 편집 · 카테고리 · 꿈 · 설정 */}
        <div
          className="m-page"
          data-testid="m-page"
          inert={!pageOpen || undefined}
          aria-hidden={!pageOpen || undefined}
          onTransitionEnd={e => e.target === e.currentTarget && !pageOpen && setKept(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', boxShadow: pageOpen ? 'var(--shadow-lg)' : 'none', transform: pageOpen ? 'none' : 'translateX(calc(100% + 40px))' }}
        >
          {shownPage && (
            <>
              <PageBar
                back={shownPage.page === 'settings' ? '뒤로' : shownPage.page === 'tutorial' ? '그만하기' : '목표'}
                onBack={closePage}
                right={shownPage.page === 'goal' && shownPage.id ? <GoalStatusTag id={shownPage.id} /> : shownPage.page === 'tutorial' ? <span className="tag tag-accent-2" style={{ fontWeight: 700 }}>체험 · 저장 안 돼요</span> : undefined}
              />
              {shownPage.page === 'goal' && shownPage.id && <GoalPage key={shownPage.id} id={shownPage.id} active={pageOpen} onGone={closePage} />}
              {shownPage.page === 'categories' && <CategoriesPage />}
              {shownPage.page === 'dream' && <DreamPage />}
              {shownPage.page === 'settings' && <SettingsPage />}
              {shownPage.page === 'tutorial' && pageOpen && <TutorialPage />}
            </>
          )}
        </div>
      </div>

      {/* 시트가 그려지는 층 (앱바까지 덮는다) */}
      <div id="m-sheet-root" style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }} />
      {account && <AccountSheet onClose={() => setAccount(false)} />}
    </div>
  );
}

/** 계획 쪽은 왼쪽으로 조금 밀리며 흐려지고, 기록 쪽은 오른쪽 밖에서 밀려 들어온다 (목업) */
function PaneBox({ on, side, blocked, children }: { on: boolean; side: -1 | 1; blocked: boolean; children: ReactNode }) {
  const off = side < 0 ? 'translateX(-28%)' : 'translateX(calc(100% + 40px))';
  const live = on && !blocked;
  return (
    <div
      className="m-pane"
      inert={!live || undefined}
      aria-hidden={!on || undefined}
      style={{ position: 'absolute', inset: 0, zIndex: side < 0 ? 1 : 2, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', boxShadow: side > 0 && on ? 'var(--shadow-lg)' : 'none', transform: on ? 'none' : off, opacity: on || side > 0 ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

function GoalStatusTag({ id }: { id: string }) {
  const { goals } = useAccount();
  const g = goals.find(x => x.id === id);
  if (!g) return null;
  const [label, cls] = g.status === 'in_progress' ? ['진행 중', 'tag tag-accent-2'] : g.status === 'not_started' ? ['시작 전', 'tag tag-neutral'] : [g.status === 'completed' ? '완성' : '중도 마무리', 'tag tag-neutral'];
  return <span className={cls} style={{ fontWeight: 700 }}>{label}</span>;
}

/** D-day: 계획 › 목표에서 정한 하나를 보는 날 기준으로 (2026-10-03 기획 결정, 예전엔 가장 가까운 목표 기한) */
function DdayChip() {
  const { profile } = useAccount();
  const today = useToday();
  const loc = useLocation();
  const asked = new URLSearchParams(loc.search).get('d');
  const day = isDayKey(asked) ? asked : today;
  if (!profile?.dday_name || !profile.dday_date) return null;
  return (
    <span data-testid="dday" className="tag" style={{ maxWidth: '100%', background: 'var(--color-text)', color: 'var(--color-bg)', fontWeight: 700, fontSize: 11.5, gap: 5, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span style={{ flex: 'none' }}>{ddayText(profile.dday_date, day)}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.dday_name}</span>
    </span>
  );
}
