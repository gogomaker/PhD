import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { isNetworkError } from '../mobile/pendingBlocks';
import type { CategoryColor } from '../lib/palette';
import { DEFAULT_DAY_START_HOUR, DEFAULT_TIMEZONE, userDayKey } from '../lib/day';

export type Profile = {
  id: string;
  name: string;
  life_stage: string | null;
  dream: string | null;
  dream_why: string | null;
  dream_day: string | null;
  day_start_hour: number;
  week_start: 'sun';
  review_notify_enabled: boolean;
  review_notify_time: string;
  timezone: string;
  /** D-day 하나 (2026-10-03 기획 결정) */
  dday_name: string | null;
  dday_date: string | null;
  onboarded_at: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  kind: 'goal' | 'daily';
  name: string;
  color: CategoryColor;
  aspiration: string | null;
  position: number;
};

export type Keyword = { id: string; category_id: string; name: string; position: number; archived: boolean };

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'dropped';

export type Goal = {
  id: string;
  category_id: string;
  name: string;
  position: number;
  /** 'YYYY-MM-01' */
  due_month: string;
  reason: string | null;
  importance: 'high' | 'mid' | 'low' | null;
  fallback: string | null;
  status: GoalStatus;
  started_at: string | null;
  created_at: string;
  table_position: number;
  table_hidden: boolean;
  /** 마무리 (R-G6) */
  finished_at: string | null;
  finish_photo_path: string | null;
  retro_achieved: string | null;
  retro_regret: string | null;
  retro_next: string | null;
};

export type Subgoal = { id: string; goal_id: string; name: string; position: number };

export type YearCell = { id: string; goal_id: string; subgoal_id: string; start_month: string; end_month: string; memo: string };
export type MonthCell = { id: string; goal_id: string; subgoal_id: string; year_month: string; start_week: number; end_week: number; comment: string };
export type Note = { id: string; scope: 'month' | 'week'; period_key: string; start_index: number; end_index: number; text: string };
export type Practice = { id: string; goal_id: string; subgoal_id: string; week_start_date: string; name: string; kind: 'repeat' | 'once'; weekdays: number[]; start_time: string | null; end_time: string | null; created_at: string };

/** loading: 확인 중 / signedOut: 로그인 전 / onboarding: 가입 2~4단계 남음 / ready: 사용 가능 */
export type AccountStatus = 'loading' | 'signedOut' | 'onboarding' | 'ready';

type AccountValue = {
  status: AccountStatus;
  session: Session | null;
  profile: Profile | null;
  goalCategories: Category[];
  dailyCategory: Category | null;
  /** 쓰는 키워드 (보관한 것 제외) */
  keywords: Keyword[];
  /** 보관한 것까지 (지난 기록 표시용) */
  allKeywords: Keyword[];
  goals: Goal[];
  subgoals: Subgoal[];
  yearCells: YearCell[];
  monthCells: MonthCell[];
  notes: Note[];
  practices: Practice[];
  reload: () => Promise<void>;
  /** 서버 호출을 감싸서, 실패하면 알림을 띄우고 데이터를 다시 읽는다. 성공하면 true */
  run: (fn: () => PromiseLike<{ error: unknown }>) => Promise<boolean>;
  /** 새 행을 만들고 그 id를 돌려준다. 실패하면 알림 후 null */
  create: (fn: () => PromiseLike<{ data: { id: string } | null; error: unknown }>) => Promise<string | null>;
  /** action: 안내 옆 버튼 (예: 되돌리기) */
  toast: (message: string, action?: ToastAction) => void;
};

const AccountContext = createContext<AccountValue | null>(null);

export function useAccount() {
  const v = useContext(AccountContext);
  if (!v) throw new Error('AccountProvider 밖에서 useAccount를 불렀어요');
  return v;
}

type Data = { profile: Profile | null; categories: Category[]; keywords: Keyword[]; goals: Goal[]; subgoals: Subgoal[]; yearCells: YearCell[]; monthCells: MonthCell[]; notes: Note[]; practices: Practice[] };
const EMPTY: Data = { profile: null, categories: [], keywords: [], goals: [], subgoals: [], yearCells: [], monthCells: [], notes: [], practices: [] };

export type ToastAction = { label: string; run: () => void };

// 이 기기에 둔 마지막 계정 데이터 (빠른 시작). 로그아웃하면 지운다
const CACHE = 'phd-data:';
function readCache(userId: string): Data | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE + userId) ?? 'null');
    return v && v.profile ? { ...EMPTY, ...v } : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(userId: string, d: Data) {
  try { localStorage.setItem(CACHE + userId, JSON.stringify(d)); } catch { /* 저장 공간이 없으면 다음엔 그냥 읽는다 */ }
}
// 기기에 둔 것 모두: 계정 데이터 + 할 일·하루 내용(useDay, 2026-10-03 UT 4차)
function clearCache() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE) || k.startsWith('phd-tasks:') || k.startsWith('phd-day:')) localStorage.removeItem(k); } catch { /* 없음 */ }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [data, setData] = useState<Data | undefined>(undefined);
  const [toastMsg, setToastMsg] = useState<{ text: string; action?: ToastAction } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const toast = useCallback((message: string, action?: ToastAction) => {
    setToastMsg({ text: message, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), action ? 6000 : 3200);
  }, []);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [p, c, k, g, sg, yc, mc, nt, pr] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('categories').select('id, kind, name, color, aspiration, position').order('position'),
      supabase.from('daily_keywords').select('id, category_id, name, position, archived').order('position').order('created_at'),
      supabase.from('goals').select('id, category_id, name, position, due_month, reason, importance, fallback, status, started_at, created_at, table_position, table_hidden, finished_at, finish_photo_path, retro_achieved, retro_regret, retro_next').order('position').order('created_at'),
      supabase.from('subgoals').select('id, goal_id, name, position').order('position').order('created_at'),
      supabase.from('year_cells').select('id, goal_id, subgoal_id, start_month, end_month, memo'),
      supabase.from('month_cells').select('id, goal_id, subgoal_id, year_month, start_week, end_week, comment'),
      supabase.from('notes').select('id, scope, period_key, start_index, end_index, text'),
      supabase.from('practices').select('id, goal_id, subgoal_id, week_start_date, name, kind, weekdays, start_time, end_time, created_at').order('created_at'),
    ]);
    const err = p.error ?? c.error ?? k.error ?? g.error ?? sg.error ?? yc.error ?? mc.error ?? nt.error ?? pr.error;
    if (err) {
      // 연결이 없으면 위쪽 '오프라인' 표시로 알리고, 이 기기에 둔 내용으로 연다 (2026-10-03 UT 4차).
      // 둔 내용도 없으면 빈 계정으로 보지 않는다(가입 화면으로 보내지 않게) — 연결되면 다시 읽는다
      const net = isNetworkError(err);
      if (!net) toast(errorText(err));
      setData(d => d ?? (net ? undefined : EMPTY));
      return;
    }
    const next: Data = {
      profile: p.data as Profile | null,
      categories: (c.data ?? []) as Category[],
      keywords: (k.data ?? []) as Keyword[],
      goals: (g.data ?? []) as Goal[],
      subgoals: (sg.data ?? []) as Subgoal[],
      yearCells: (yc.data ?? []) as YearCell[],
      monthCells: (mc.data ?? []) as MonthCell[],
      notes: (nt.data ?? []) as Note[],
      practices: (pr.data ?? []) as Practice[],
    };
    setData(next);
    writeCache(userId, next);
  }, [userId, toast]);

  // 빠른 시작 (2026-10-03 UT 13): 지난번에 본 내용을 이 기기에서 바로 보여 주고, 뒤에서 새로 읽는다
  useEffect(() => {
    setData(userId ? readCache(userId) : undefined);
    if (userId) reload();
  }, [userId, reload]);
  // 오늘 앱을 열었음을 하루 한 번 남긴다 — 관리 페이지의 DAU·WAU (2026-10-04, 한국 날짜 기준)
  useEffect(() => {
    if (!userId) return;
    const key = 'phd-active:' + userId;
    const touch = () => {
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
      let last: string | null = null;
      try { last = localStorage.getItem(key); } catch { /* 없음 */ }
      if (last === day || document.visibilityState !== 'visible') return;
      supabase.rpc('touch_active').then(({ error }) => {
        if (!error) try { localStorage.setItem(key, day); } catch { /* 다음에 다시 */ }
      }, () => {});
    };
    touch();
    window.addEventListener('focus', touch);
    document.addEventListener('visibilitychange', touch);
    return () => { window.removeEventListener('focus', touch); document.removeEventListener('visibilitychange', touch); };
  }, [userId]);

  // 로그아웃했으면 이 기기에 둔 데이터도 지운다 (로그인 확인 전에는 지우지 않는다)
  useEffect(() => {
    if (session === null) clearCache();
  }, [session]);

  // 다른 기기·탭에서 고친 것 반영 (2026-10-03 UT 15): 창으로 돌아오거나 보일 때, 보이는 동안 1분마다
  useEffect(() => {
    if (!userId) return;
    let last = Date.now();
    const again = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 5000) return;
      last = Date.now();
      reload();
    };
    const back = () => { last = Date.now(); reload(); };
    window.addEventListener('focus', again);
    window.addEventListener('online', back);
    document.addEventListener('visibilitychange', again);
    const t = window.setInterval(again, 60_000);
    return () => { window.removeEventListener('focus', again); window.removeEventListener('online', back); document.removeEventListener('visibilitychange', again); window.clearInterval(t); };
  }, [userId, reload]);

  const run = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>) => {
      try {
        const { error } = await fn();
        if (error) {
          toast(errorText(error));
          await reload();
          return false;
        }
        await reload();
        return true;
      } catch (e) {
        toast(errorText(e));
        return false;
      }
    },
    [reload, toast],
  );

  const create = useCallback(
    async (fn: () => PromiseLike<{ data: { id: string } | null; error: unknown }>) => {
      try {
        const { data, error } = await fn();
        await reload();
        if (error || !data) {
          toast(errorText(error));
          return null;
        }
        return data.id;
      } catch (e) {
        toast(errorText(e));
        return null;
      }
    },
    [reload, toast],
  );

  const value = useMemo<AccountValue>(() => {
    const d = data ?? EMPTY;
    let status: AccountStatus;
    if (session === undefined) status = 'loading';
    else if (session === null) status = 'signedOut';
    else if (data === undefined) status = 'loading';
    else status = d.profile?.onboarded_at ? 'ready' : 'onboarding';
    return {
      status,
      session: session ?? null,
      profile: d.profile,
      goalCategories: d.categories.filter(c => c.kind === 'goal'),
      dailyCategory: d.categories.find(c => c.kind === 'daily') ?? null,
      keywords: d.keywords.filter(k => !k.archived),
      allKeywords: d.keywords,
      goals: d.goals,
      subgoals: d.subgoals,
      yearCells: d.yearCells,
      monthCells: d.monthCells,
      notes: d.notes,
      practices: d.practices,
      reload,
      run,
      create,
      toast,
    };
  }, [session, data, reload, run, create, toast]);

  return (
    <AccountContext.Provider value={value}>
      {children}
      {toastMsg && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 100, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', padding: toastMsg.action ? '6px 6px 6px 20px' : '12px 20px', borderRadius: 999, background: 'var(--color-neutral-900)', color: 'var(--color-neutral-100)', fontSize: 14, fontWeight: 600, boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {toastMsg.text}
          {toastMsg.action && (
            <button onClick={() => { const a = toastMsg.action!; setToastMsg(null); a.run(); }} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-900)' }}>
              {toastMsg.action.label}
            </button>
          )}
        </div>
      )}
    </AccountContext.Provider>
  );
}

/** R-D1: 사용자 시간대 + 하루 시작 시각 기준 오늘 */
export function useToday() {
  const { profile } = useAccount();
  return userDayKey(new Date(), profile?.timezone ?? DEFAULT_TIMEZONE, profile?.day_start_hour ?? DEFAULT_DAY_START_HOUR);
}
