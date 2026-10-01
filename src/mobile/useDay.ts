import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { useAccount } from '../account/AccountProvider';
import type { DayKey } from '../lib/day';
import { computeDay, type DayItem, type TaskRow } from '../lib/today';

export type BlockRow = { id: string; date: string; layer: 'plan' | 'actual'; start_slot: number; end_slot: number; task_id: string | null; daily_keyword_id: string | null; label: string | null; block_key: string | null };
export type Journal = { id?: string; date: string; score: number | null; reason: string; thanks: string[]; memo: string };

/** 한 날의 할 일·시간표·하루 기록. 할 일은 넘어가기 계산 때문에 전부 읽는다 */
export function useDay(day: DayKey, today: DayKey) {
  const { practices, toast } = useAccount();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at');
    if (error) toast(errorText(error));
    else setTasks(data as TaskRow[]);
  }, [toast]);

  const loadDay = useCallback(async () => {
    const [b, j] = await Promise.all([
      supabase.from('time_blocks').select('id, date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key').eq('date', day),
      supabase.from('day_journals').select('id, date, score, reason, thanks, memo').eq('date', day).maybeSingle(),
    ]);
    if (b.error || j.error) return toast(errorText(b.error ?? j.error));
    setBlocks(b.data as BlockRow[]);
    setJournal(j.data as Journal | null);
  }, [day, toast]);

  useEffect(() => {
    setLoaded(false);
    setJournal(null);
    setBlocks([]);
    Promise.all([loadTasks(), loadDay()]).then(() => setLoaded(true));
  }, [loadTasks, loadDay]);

  const list = useMemo(() => computeDay(day, today, practices, tasks), [day, today, practices, tasks]);

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

  const addDirect = (x: { name: string; keywordId: string; timed: null | { start: string; end: string } }) =>
    mutate(
      supabase.from('tasks').insert({
        date: day,
        source: 'direct',
        name: x.name,
        daily_keyword_id: x.keywordId,
        is_timed: !!x.timed,
        start_time: x.timed?.start ?? null,
        end_time: x.timed?.end ?? null,
        alarm: !!x.timed,
      }),
    );

  const removeTask = (id: string) => mutate(supabase.from('tasks').delete().eq('id', id), 'both');

  const saveLayer = async (layer: 'plan' | 'actual', rows: { start: number; end: number; task_id?: string | null; keyword_id?: string | null; label?: string | null; key?: string }[]) => {
    // 화면의 칸 상태가 기준. 성공하면 다시 읽지 않는다(이어서 그린 것을 옛 상태로 덮어쓰지 않도록), 실패하면 서버 상태로 되돌린다
    const { error } = await supabase.rpc('save_day_blocks', { p_date: day, p_layer: layer, p_blocks: rows });
    if (error) {
      toast(errorText(error));
      await loadDay();
    }
    return !error;
  };

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

  return { loaded, tasks, blocks, journal, list, ensureRow, toggleDone, addDirect, removeTask, saveLayer, saveJournal };
}
