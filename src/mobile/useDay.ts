import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { useAccount } from '../account/AccountProvider';
import { userDayKey, type DayKey } from '../lib/day';
import { computeDay, type DayItem, type TaskRow } from '../lib/today';
import { dropPending, isNetworkError, pendingOf, putPending, type BlockInput, type Pending } from './pendingBlocks';

export type BlockRow = { id: string; date: string; layer: 'plan' | 'actual'; start_slot: number; end_slot: number; task_id: string | null; daily_keyword_id: string | null; label: string | null; block_key: string | null };
export type Journal = { id?: string; date: string; score: number | null; reason: string; thanks: string[]; memo: string };

/** 한 날의 할 일·시간표·하루 기록. 할 일은 넘어가기 계산 때문에 전부 읽는다 */
export function useDay(day: DayKey, today: DayKey) {
  const { practices, goals, subgoals, profile, toast } = useAccount();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const user = profile?.id ?? '';
  // 연결이 끊겨 못 보낸 시간표 (이 기기에 보관, 2026-10-03 UT)
  const [pendingVer, setPendingVer] = useState(0);
  const bump = useCallback(() => setPendingVer(v => v + 1), []);
  const warned = useRef(false);

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at');
    if (error) toast(errorText(error));
    else setTasks(data as TaskRow[]);
  }, [toast]);

  // 시간표를 고친 횟수. 고치기 전에 시작한 다시 읽기가 늦게 와서 방금 칠한 것을 덮지 않게 한다
  const edits = useRef(0);
  const noteEdit = useCallback(() => { edits.current++; }, []);

  const loadDay = useCallback(async () => {
    const v = edits.current;
    const [b, j] = await Promise.all([
      supabase.from('time_blocks').select('id, date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key').eq('date', day),
      supabase.from('day_journals').select('id, date, score, reason, thanks, memo').eq('date', day).maybeSingle(),
    ]);
    if (b.error || j.error) return toast(errorText(b.error ?? j.error));
    if (edits.current === v) setBlocks(withPending(b.data as BlockRow[], user ? pendingOf(user, day) : []));
    setJournal(j.data as Journal | null);
  }, [day, toast, user]);

  useEffect(() => {
    setLoaded(false);
    setJournal(null);
    setBlocks([]);
    Promise.all([loadTasks(), loadDay()]).then(() => setLoaded(true));
  }, [loadTasks, loadDay]);

  // 마무리한 목표 → 마무리한 날 (R-D1 기준)
  const closedOn = useMemo(
    () => new Map(goals.filter(g => g.finished_at).map(g => [g.id, userDayKey(new Date(g.finished_at!), profile?.timezone, profile?.day_start_hour)])),
    [goals, profile?.timezone, profile?.day_start_hour],
  );
  const subgoalGoal = useMemo(() => new Map(subgoals.map(s => [s.id, s.goal_id])), [subgoals]);
  const list = useMemo(() => computeDay(day, today, practices, tasks, closedOn, subgoalGoal), [day, today, practices, tasks, closedOn, subgoalGoal]);

  /** 행이 없는 할 일(반복·자동·넘어온 일)은 지금 만든다. 행 id를 돌려준다 */
  const ensureRow = useCallback(
    async (it: DayItem): Promise<string | null> => {
      if (it.row) return it.row.id;
      if (!it.insert) return null;
      const { data, error } = await supabase.from('tasks').insert(it.insert).select('*').single();
      if (error) {
        toast(errorText(error));
        await loadTasks();
        return null;
      }
      setTasks(ts => [...ts, data as TaskRow]);
      return (data as TaskRow).id;
    },
    [loadTasks, toast],
  );

  const mutate = useCallback(
    async (req: PromiseLike<{ error: unknown }>, after: 'tasks' | 'day' | 'both' = 'tasks') => {
      const { error } = await req;
      if (error) toast(errorText(error));
      if (after !== 'day') await loadTasks();
      if (after !== 'tasks') await loadDay();
      return !error;
    },
    [loadTasks, loadDay, toast],
  );

  const toggleDone = async (it: DayItem) => {
    const id = await ensureRow(it);
    if (!id) return;
    await mutate(supabase.from('tasks').update({ done_at: it.done ? null : new Date().toISOString() }).eq('id', id));
  };

  const addDirect = (x: { name: string; keywordId: string | null; subgoalId?: string | null; timed: null | { start: string; end: string } }) =>
    mutate(
      supabase.from('tasks').insert({
        date: day,
        source: 'direct',
        name: x.name,
        daily_keyword_id: x.keywordId,
        subgoal_id: x.subgoalId ?? null,
        is_timed: !!x.timed,
        start_time: x.timed?.start ?? null,
        end_time: x.timed?.end ?? null,
        alarm: !!x.timed,
      }),
    );

  const removeTask = (id: string) => mutate(supabase.from('tasks').delete().eq('id', id), 'both');

  // 시간표 저장과 보관분 보내기는 한 줄로 (늦게 끝난 옛 상태가 새 상태를 덮지 않게)
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.current.then(fn, fn);
    chain.current = run.catch(() => undefined);
    return run;
  };

  const saveLayer = (layer: 'plan' | 'actual', rows: BlockInput[]) =>
    serial(async () => {
      // 화면의 칸 상태가 기준. 성공하면 다시 읽지 않는다(이어서 그린 것을 옛 상태로 덮어쓰지 않도록)
      const { error } = await supabase.rpc('save_day_blocks', { p_date: day, p_layer: layer, p_blocks: rows });
      if (!error) {
        if (user && pendingOf(user, day).some(p => p.layer === layer)) {
          dropPending(user, day, layer);
          bump();
        }
        return true;
      }
      if (user && isNetworkError(error)) {
        // 닿지 못했으면 화면은 그대로 두고 이 기기에 보관 → 연결되면 보낸다
        putPending({ user, day, layer, rows, at: Date.now() });
        bump();
        if (!warned.current) toast('연결이 끊겼어요. 칠한 시간은 이 기기에 두었다가 연결되면 저장해요');
        warned.current = true;
        return false;
      }
      // 서버가 거절하면 서버 상태로 되돌린다 (이 다시 읽기는 반영)
      toast(errorText(error));
      edits.current++;
      await loadDay();
      return false;
    });

  /** 보관해 둔 시간표를 보낸다. 지난 날이 되어 거절되면 버리고 알린다 */
  const flush = useCallback(
    () =>
      serial(async () => {
        if (!user) return;
        let changed = false;
        for (const p of pendingOf(user)) {
          const { error } = await supabase.rpc('save_day_blocks', { p_date: p.day, p_layer: p.layer, p_blocks: p.rows });
          if (error && isNetworkError(error)) break;
          dropPending(user, p.day, p.layer, p.at);
          changed = true;
          if (error) toast(`${p.day.slice(5).replace('-', '.')} 시간표를 저장하지 못했어요 · ${errorText(error)}`);
          else if (!pendingOf(user).length) toast('연결됐어요. 기다리던 시간표를 저장했어요');
        }
        if (changed) {
          warned.current = false;
          bump();
          edits.current++;
          await loadDay();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loadDay, toast, bump],
  );

  // 열 때, 연결이 돌아올 때, 보관분이 있으면 20초마다
  const hasPending = !!user && pendingOf(user).length > 0;
  useEffect(() => {
    if (!user) return;
    if (pendingOf(user).length) flush();
    const on = () => flush();
    window.addEventListener('online', on);
    const t = hasPending ? setInterval(on, 20_000) : undefined;
    return () => { window.removeEventListener('online', on); if (t) clearInterval(t); };
  }, [user, flush, hasPending]);
  const pending = !!user && pendingVer >= 0 && pendingOf(user, day).length > 0;

  const saveJournal = async (j: Journal) => {
    const body = { score: j.score, reason: j.reason, thanks: j.thanks, memo: j.memo };
    const { data, error } = await (journal?.id
      ? supabase.from('day_journals').update({ ...body, updated_at: new Date().toISOString() }).eq('id', journal.id).select('id, date, score, reason, thanks, memo').single()
      : supabase.from('day_journals').insert({ date: day, ...body }).select('id, date, score, reason, thanks, memo').single());
    if (error) {
      toast(errorText(error));
      return false;
    }
    setJournal(data as Journal);
    return true;
  };

  return { loaded, tasks, blocks, journal, list, ensureRow, toggleDone, addDirect, removeTask, saveLayer, saveJournal, noteEdit, pending };
}

/** 서버에서 읽은 블록 위에, 보관 중인 층을 덮어 보여 준다 */
function withPending(rows: BlockRow[], pend: Pending[]): BlockRow[] {
  if (!pend.length) return rows;
  const layers = new Set(pend.map(p => p.layer));
  return [
    ...rows.filter(r => !layers.has(r.layer)),
    ...pend.flatMap(p =>
      p.rows.map((r, i) => ({ id: `pending-${p.layer}-${i}`, date: p.day, layer: p.layer, start_slot: r.start, end_slot: r.end, task_id: r.task_id ?? null, daily_keyword_id: r.keyword_id ?? null, label: r.label ?? null, block_key: r.key ?? null })),
    ),
  ];
}
