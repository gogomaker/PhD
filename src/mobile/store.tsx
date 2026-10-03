// 모바일 앱 공통 상태: 목표별 최근 진척도(4.7-3), 첫 기록 여부(시작하기 5단계)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { useAccount } from '../account/AccountProvider';

type Store = {
  /** 목표 id → 가장 최근 진척도(%) */
  progress: Record<string, number>;
  saveProgress: (goalId: string, percent: number) => Promise<boolean>;
  /** 할 일을 체크했거나 실제 시간을 칠한 적이 있는지 (모르면 null) */
  recorded: boolean | null;
  recheck: () => void;
};

const Ctx = createContext<Store | null>(null);

export function useMobile() {
  const v = useContext(Ctx);
  if (!v) throw new Error('MobileStore 밖에서 useMobile을 불렀어요');
  return v;
}

export function MobileStore({ children }: { children: ReactNode }) {
  const { session, toast } = useAccount();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [recorded, setRecorded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('goal_progress')
      .select('goal_id, percent, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast(errorText(error));
        const latest: Record<string, number> = {};
        for (const r of (data ?? []) as { goal_id: string; percent: number }[]) if (!(r.goal_id in latest)) latest[r.goal_id] = r.percent;
        setProgress(latest);
      });
  }, [session, toast]);

  const saveProgress = useCallback(
    async (goalId: string, percent: number) => {
      const { error } = await supabase.from('goal_progress').insert({ goal_id: goalId, percent });
      if (error) {
        toast(errorText(error));
        return false;
      }
      setProgress(p => ({ ...p, [goalId]: percent }));
      return true;
    },
    [toast],
  );

  const recheck = useCallback(async () => {
    if (!session) return;
    const [t, b] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).not('done_at', 'is', null),
      supabase.from('time_blocks').select('id', { count: 'exact', head: true }).eq('layer', 'actual'),
    ]);
    if (!t.error && !b.error) setRecorded((t.count ?? 0) + (b.count ?? 0) > 0);
  }, [session]);

  useEffect(() => {
    recheck();
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [recheck]);

  const value = useMemo(() => ({ progress, saveProgress, recorded, recheck }), [progress, saveProgress, recorded, recheck]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
