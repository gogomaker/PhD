// 모바일 앱 주소 (docs/MOBILE.md). 화면은 모두 한 번에 떠 있고, 주소는 "지금 무엇을 보는지"만 정한다
export type Pane = 'plan' | 'record';
export type Tab = 'goals' | 'schedule' | 'today' | 'review';
export type PageKind = 'goal' | 'categories' | 'dream' | 'settings';

export type MRoute = { kind: 'pane'; pane: Pane; tab: Tab } | { kind: 'page'; page: PageKind; id?: string };

export const TAB_PATH: Record<Tab, string> = { goals: '/plan', schedule: '/plan/schedule', today: '/record', review: '/record/review' };

export function parseRoute(path: string): MRoute | null {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/plan') return { kind: 'pane', pane: 'plan', tab: 'goals' };
  if (p === '/plan/schedule') return { kind: 'pane', pane: 'plan', tab: 'schedule' };
  if (p === '/record') return { kind: 'pane', pane: 'record', tab: 'today' };
  if (p === '/record/review') return { kind: 'pane', pane: 'record', tab: 'review' };
  const g = p.match(/^\/goal\/([0-9a-f-]{36})$/i);
  if (g) return { kind: 'page', page: 'goal', id: g[1] };
  if (p === '/categories') return { kind: 'page', page: 'categories' };
  if (p === '/dream') return { kind: 'page', page: 'dream' };
  if (p === '/settings') return { kind: 'page', page: 'settings' };
  return null;
}

/** 데스크톱 주소(북마크·메일 링크)로 휴대폰에서 들어오면 맞는 모바일 화면으로 */
export function mobilePathFor(path: string, search: string): string | null {
  const q = new URLSearchParams(search);
  switch (path.replace(/\/+$/, '')) {
    case '/board':
    case '/goals':
    case '/reviews':
      return '/plan';
    case '/plan/year':
      return '/plan/schedule?z=year' + (q.get('y') ? '&k=' + q.get('y') : '');
    case '/plan/month':
      return '/plan/schedule?z=month' + (q.get('m') ? '&k=' + q.get('m') : '');
    case '/plan/week':
      return '/plan/schedule?z=week' + (q.get('w') ? '&k=' + q.get('w') : '');
    case '/tracking':
      return '/record/review';
    case '/account':
      return '/settings';
    default:
      return null;
  }
}
