// 연결이 끊겼을 때 못 보낸 시간표(하루·한 층의 최신 상태)를 이 기기에 보관했다가, 연결되면 보낸다 (2026-10-03 UT)
// 시간표 저장은 하루치를 통째로 바꾸는 방식이라, 마지막 상태 하나만 갖고 있으면 된다
export type BlockInput = { start: number; end: number; task_id?: string | null; keyword_id?: string | null; label?: string | null; key?: string };
export type Pending = { user: string; day: string; layer: 'plan' | 'actual'; rows: BlockInput[]; at: number };

const KEY = 'phd-pending-blocks';

function read(): Pending[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(list: Pending[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장 공간을 못 쓰면 이 화면이 열려 있는 동안만 기억 */
  }
}
const same = (a: Pending, user: string, day: string, layer: string) => a.user === user && a.day === day && a.layer === layer;

export function putPending(p: Pending) {
  write([...read().filter(x => !same(x, p.user, p.day, p.layer)), p]);
}
/** at을 주면 그 사이 새로 들어온 게 없을 때만 지운다 */
export function dropPending(user: string, day: string, layer: string, at?: number) {
  write(read().filter(x => !(same(x, user, day, layer) && (at === undefined || x.at === at))));
}
export function pendingOf(user: string, day?: string) {
  return read().filter(x => x.user === user && (day === undefined || x.day === day));
}

/** 서버가 거절한 게 아니라 닿지 못한 오류 */
export function isNetworkError(e: unknown) {
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '');
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || /Failed to fetch|NetworkError|Load failed/i.test(msg);
}
