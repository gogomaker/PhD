import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
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
export type Practice = { id: string; goal_id: string; subgoal_id: string; week_start_date: string; name: string; kind: 'repeat' | 'once'; weekdays: number[]; created_at: string };

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
  toast: (message: string) => void;
};

const AccountContext = createContext<AccountValue | null>(null);

export function useAccount() {
  const v = useContext(AccountContext);
  if (!v) throw new Error('AccountProvider 밖에서 useAccount를 불렀어요');
  return v;
}

type Data = { profile: Profile | null; categories: Category[]; keywords: Keyword[]; goals: Goal[]; subgoals: Subgoal[]; yearCells: YearCell[]; monthCells: MonthCell[]; notes: Note[]; practices: Practice[] };
const EMPTY: Data = { profile: null, categories: [], keywords: [], goals: [], subgoals: [], yearCells: [], monthCells: [], notes: [], practices: [] };

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [data, setData] = useState<Data | undefined>(undefined);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200);
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
      supabase.from('practices').select('id, goal_id, subgoal_id, week_start_date, name, kind, weekdays, created_at').order('created_at'),
    ]);
    const err = p.error ?? c.error ?? k.error ?? g.error ?? sg.error ?? yc.error ?? mc.error ?? nt.error ?? pr.error;
    if (err) {
      toast(errorText(err));
      setData(d => d ?? EMPTY);
      return;
    }
    setData({
      profile: p.data as Profile | null,
      categories: (c.data ?? []) as Category[],
      keywords: (k.data ?? []) as Keyword[],
      goals: (g.data ?? []) as Goal[],
      subgoals: (sg.data ?? []) as Subgoal[],
      yearCells: (yc.data ?? []) as YearCell[],
      monthCells: (mc.data ?? []) as MonthCell[],
      notes: (nt.data ?? []) as Note[],
      practices: (pr.data ?? []) as Practice[],
    });
  }, [userId, toast]);

  useEffect(() => {
    setData(undefined);
    if (userId) reload();
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
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 100, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', padding: '12px 20px', borderRadius: 999, background: 'var(--color-neutral-900)', color: 'var(--color-neutral-100)', fontSize: 14, fontWeight: 600, boxShadow: 'var(--shadow-md)' }}>
          {toastMsg}
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
