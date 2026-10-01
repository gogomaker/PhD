import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import type { CategoryColor } from '../lib/palette';

export type Profile = {
  id: string;
  name: string;
  life_stage: string | null;
  dream: string | null;
  dream_why: string | null;
  dream_day: string | null;
  day_start_hour: number;
  week_start: 'mon' | 'sun';
  review_notify_enabled: boolean;
  review_notify_time: string;
  timezone: string;
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

export type Keyword = { id: string; category_id: string; name: string; position: number };

/** loading: 확인 중 / signedOut: 로그인 전 / onboarding: 가입 2~4단계 남음 / ready: 사용 가능 */
export type AccountStatus = 'loading' | 'signedOut' | 'onboarding' | 'ready';

type AccountValue = {
  status: AccountStatus;
  session: Session | null;
  profile: Profile | null;
  goalCategories: Category[];
  dailyCategory: Category | null;
  keywords: Keyword[];
  reload: () => Promise<void>;
  /** 서버 호출을 감싸서, 실패하면 알림을 띄우고 데이터를 다시 읽는다. 성공하면 true */
  run: (fn: () => PromiseLike<{ error: unknown }>) => Promise<boolean>;
  toast: (message: string) => void;
};

const AccountContext = createContext<AccountValue | null>(null);

export function useAccount() {
  const v = useContext(AccountContext);
  if (!v) throw new Error('AccountProvider 밖에서 useAccount를 불렀어요');
  return v;
}

type Data = { profile: Profile | null; categories: Category[]; keywords: Keyword[] };
const EMPTY: Data = { profile: null, categories: [], keywords: [] };

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
    const [p, c, k] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('categories').select('id, kind, name, color, aspiration, position').order('position'),
      supabase.from('daily_keywords').select('id, category_id, name, position').order('position').order('created_at'),
    ]);
    const err = p.error ?? c.error ?? k.error;
    if (err) {
      toast(errorText(err));
      setData(d => d ?? EMPTY);
      return;
    }
    setData({ profile: p.data as Profile | null, categories: (c.data ?? []) as Category[], keywords: (k.data ?? []) as Keyword[] });
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
      keywords: d.keywords,
      reload,
      run,
      toast,
    };
  }, [session, data, reload, run, toast]);

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
