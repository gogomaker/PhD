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
  // 이 날 서버 시간표를 안다(서버에서 읽었거나 기기에 둔 내용). 모르면 칠하지 않는다 — 빈 화면에 칠한 게 서버 기록을 덮지 않게 (2026-10-04)
  const [ready, setReady] = useState(false);
  const user = profile?.id ?? '';
  // 연결이 끊겨 못 보낸 시간표 (이 기기에 보관, 2026-10-03 UT)
  const [pendingVer, setPendingVer] = useState(0);
  const bump = useCallback(() => setPendingVer(v => v + 1), []);
  const warned = useRef(false);

  // quiet: 뒤에서 다시 읽을 때는 연결 오류를 알리지 않는다
  const loadTasks = useCallback(async (quiet = false) => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at');
    if (error) { if (!quiet && !offlineErr(error)) toast(errorText(error)); }
    // 다시 읽어도 같으면 그대로 (화면이 괜히 다시 그려지지 않게)
    else {
      setTasks(ts => (sameJson(ts, data) ? ts : (data as TaskRow[])));
      if (user) writeCache(TASKS + user, data);
    }
  }, [toast, user]);

  // 시간표를 고친 횟수. 고치기 전에 시작한 다시 읽기가 늦게 와서 방금 칠한 것을 덮지 않게 한다
  const edits = useRef(0);
  const noteEdit = useCallback(() => { edits.current++; }, []);
  // 이 기기가 마지막으로 본 서버의 시간표. 저장할 때 함께 보내 그 사이 다른 기기에서 바뀌었는지 서버가 견준다 (2026-10-03 UT 3차)
  const base = useRef<Record<'plan' | 'actual', BlockInput[] | null>>({ plan: null, actual: null });
  // 하루 시작 시각을 바꾸면 서버가 칸을 옮기므로 다시 읽는다
  const dayStart = profile?.day_start_hour;

  const loadDay = useCallback(async (quiet = false) => {
    const v = edits.current;
    const [b, j] = await Promise.all([
      supabase.from('time_blocks').select('id, date, layer, start_slot, end_slot, task_id, daily_keyword_id, label, block_key').eq('date', day).order('start_slot'),
      supabase.from('day_journals').select('id, date, score, reason, thanks, memo').eq('date', day).maybeSingle(),
    ]);
    const err = b.error ?? j.error;
    if (err) return quiet || offlineErr(err) ? undefined : toast(errorText(err));
    if (edits.current === v) {
      // 기기에 둔 내용도 서버 그대로 (이 사이 칠한 게 있으면 그 저장이 따로 고친다)
      if (user) writeDayCache(dayKey(user, dayStart ?? 5, day), { blocks: b.data, journal: j.data });
      const rows = b.data as BlockRow[];
      base.current = { plan: rows.filter(x => x.layer === 'plan').map(toInput), actual: rows.filter(x => x.layer === 'actual').map(toInput) };
      setReady(true);
      const next = withPending(rows, user ? pendingOf(user, day) : []);
      setBlocks(old => (sameJson(old, next) ? old : next));
    }
    setJournal(old => (sameJson(old, j.data) ? old : (j.data as Journal | null)));
  }, [day, toast, user, dayStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 이 기기에 둔 마지막 내용을 먼저 보이고(연결이 없어도 열리게, 2026-10-03 UT 4차) 뒤에서 새로 읽는다
    const ct = user ? readCache<TaskRow[]>(TASKS + user) : undefined;
    const cd = user ? readCache<DayCache>(dayKey(user, dayStart ?? 5, day)) : undefined;
    if (ct) setTasks(ct);
    if (cd) {
      base.current = { plan: cd.blocks.filter(x => x.layer === 'plan').map(toInput), actual: cd.blocks.filter(x => x.layer === 'actual').map(toInput) };
      setReady(true);
      setBlocks(withPending(cd.blocks, user ? pendingOf(user, day) : []));
      setJournal(cd.journal);
      setLoaded(true);
    } else {
      setLoaded(false);
      setJournal(null);
      setBlocks([]);
      base.current = { plan: null, actual: null };
      setReady(false);
    }
    Promise.all([loadTasks(), loadDay()]).then(() => setLoaded(true));
  }, [loadTasks, loadDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // 다른 기기에서 고친 것: 창으로 돌아오거나 화면이 다시 보이면, 그리고 보이는 동안 1분마다 다시 읽는다 (2026-10-03 UT 3차)
  const reload = useCallback(() => Promise.all([loadTasks(true), loadDay(true)]).then(() => undefined, () => undefined), [loadTasks, loadDay]);
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener('focus', on);
    document.addEventListener('visibilitychange', on);
    const t = setInterval(on, 60_000);
    return () => { window.removeEventListener('focus', on); document.removeEventListener('visibilitychange', on); clearInterval(t); };
  }, [reload]);

  // 마무리한 목표 → 마무리한 날 (R-D1 기준)
  const closedOn = useMemo(
    () => new Map(goals.filter(g => g.finished_at).map(g => [g.id, userDayKey(new Date(g.finished_at!), profile?.timezone, profile?.day_start_hour)])),
    [goals, profile?.timezone, profile?.day_start_hour],
  );
  const subgoalGoal = useMemo(() => new Map(subgoals.map(s => [s.id, s.goal_id])), [subgoals]);
  const list = useMemo(() => computeDay(day, today, practices, tasks, closedOn, subgoalGoal, dayStart ?? 5), [day, today, practices, tasks, closedOn, subgoalGoal, dayStart]);

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

  // 완료와 취소는 함께일 수 없어서, 하나를 켜면 다른 하나는 끈다 (2026-10-03 UT 4차)
  const toggleDone = async (it: DayItem) => {
    const id = await ensureRow(it);
    if (!id) return;
    await mutate(supabase.from('tasks').update({ done_at: it.done ? null : new Date().toISOString(), canceled_at: null }).eq('id', id));
  };
  /** 취소: 더 안 하기로 함. 줄을 그어 남기고 다음 날부터 넘어오지 않는다 */
  const toggleCancel = async (it: DayItem) => {
    const id = await ensureRow(it);
    if (!id) return false;
    return mutate(supabase.from('tasks').update({ canceled_at: it.canceled ? null : new Date().toISOString(), done_at: null }).eq('id', id));
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
      const known = base.current[layer];
      // 이 날 서버 시간표를 아직 모르면(불러오는 중, 연결 없이 처음 연 날) 서버 기록을 덮을 수 있어 칠하지 않는다
      if (!known) {
        toast(navigator.onLine ? '이 날 기록을 불러오는 중이에요. 잠시 뒤 다시 칠해 주세요' : '이 날 기록을 아직 불러오지 못했어요. 연결되면 칠할 수 있어요');
        edits.current++;
        setBlocks(bs => [...bs]);
        return false;
      }
      const { error } = await supabase.rpc('save_day_blocks', { p_date: day, p_layer: layer, p_blocks: rows, p_base: known });
      // 저장 전에 시작한 다시 읽기가 늦게 와서 덮지 않게
      edits.current++;
      if (!error) {
        base.current[layer] = rows;
        // 기기에 둔 내용도 방금 저장한 것으로 — 다시 열었을 때 옛 내용이 보이거나, 바로 칠한 게 '다른 기기에서 바뀜'으로 거절되지 않게 (2026-10-03 UT 4차 후속)
        if (user) patchDayCache(dayKey(user, dayStart ?? 5, day), day, layer, rows);
        if (user && pendingOf(user, day).some(p => p.layer === layer)) {
          dropPending(user, day, layer);
          bump();
        }
        return true;
      }
      if (user && isNetworkError(error)) {
        // 닿지 못했으면 화면은 그대로 두고 이 기기에 보관 → 연결되면 보낸다
        putPending({ user, day, layer, rows, at: Date.now(), base: known });
        bump();
        if (!warned.current) toast('연결이 끊겼어요. 칠한 시간은 이 기기에 두었다가 연결되면 저장해요');
        warned.current = true;
        return false;
      }
      // 서버가 거절하면 서버 상태로 되돌린다 (이 다시 읽기는 반영)
      toast(isStale(error) ? '다른 기기에서 이 날 시간표를 바꿔서 새로 불러왔어요. 방금 칠한 것은 다시 칠해 주세요' : errorText(error));
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
          const { error } = await supabase.rpc('save_day_blocks', { p_date: p.day, p_layer: p.layer, p_blocks: p.rows, p_base: p.base ?? null });
          if (error && isNetworkError(error)) break;
          dropPending(user, p.day, p.layer, p.at);
          changed = true;
          if (!error) patchDayCache(dayKey(user, dayStart ?? 5, p.day), p.day, p.layer, p.rows);
          if (error) toast(`${p.day.slice(5).replace('-', '.')} 시간표를 저장하지 못했어요 · ${isStale(error) ? '그 사이 다른 기기에서 바뀌었어요' : errorText(error)}`);
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
    const cols = 'id, date, score, reason, thanks, memo';
    const update = (id: string) => supabase.from('day_journals').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id).select(cols).single();
    let { data, error } = await (journal?.id ? update(journal.id) : supabase.from('day_journals').insert({ date: day, ...body }).select(cols).single());
    // 그 사이 다른 기기에서 먼저 만들었으면 그 기록을 고친다
    if (error && (error as { code?: string }).code === '23505') {
      const got = await supabase.from('day_journals').select('id').eq('date', day).maybeSingle();
      if (got.data) ({ data, error } = await update(got.data.id as string));
    }
    if (error) {
      toast(errorText(error));
      return false;
    }
    setJournal(data as Journal);
    if (user) {
      const k = dayKey(user, dayStart ?? 5, day);
      const c = readCache<DayCache>(k);
      if (c) writeCache(k, { ...c, journal: data });
    }
    return true;
  };

  return { loaded, ready, tasks, blocks, journal, list, ensureRow, toggleDone, toggleCancel, addDirect, removeTask, saveLayer, saveJournal, noteEdit, pending, reload };
}

/** 서버에서 읽은 블록 위에, 보관 중인 층을 덮어 보여 준다 */
// 이 기기에 둔 할 일·하루 내용 (로그아웃하면 AccountProvider가 지운다)
export const TASKS = 'phd-tasks:';
export const DAY = 'phd-day:';
function readCache<T>(key: string): T | undefined {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined; } catch { return undefined; }
}
function writeCache(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장 공간이 없으면 다음엔 그냥 읽는다 */ }
}
/** 하루 내용은 최근 것만 (8일 넘게 지난 날은 지운다) */
type DayCache = { blocks: BlockRow[]; journal: Journal | null };
// 칸 번호는 하루 시작 시각 기준이라 키에 넣는다 (바꾸면 옛 내용을 쓰지 않게)
const dayKey = (user: string, dayStart: number, day: string) => `${DAY}${user}:${dayStart}:${day}`;
/** 저장에 성공한 층을 기기에 둔 내용에 반영 */
function patchDayCache(key: string, day: string, layer: 'plan' | 'actual', rows: BlockInput[]) {
  const c = readCache<DayCache>(key);
  if (!c) return;
  const mine: BlockRow[] = rows.map((x, i) => ({ id: `saved-${layer}-${i}`, date: day, layer, start_slot: x.start, end_slot: x.end, task_id: x.task_id ?? null, daily_keyword_id: x.keyword_id ?? null, label: x.label?.trim() || null, block_key: x.key ?? null }));
  writeCache(key, { ...c, blocks: [...c.blocks.filter(b => b.layer !== layer), ...mine].sort((a, b) => a.start_slot - b.start_slot) });
}
function writeDayCache(key: string, v: unknown) {
  writeCache(key, v);
  const user = key.slice(DAY.length).split(':')[0];
  try {
    const old = new Date(Date.now() - 8 * 86400_000).toISOString().slice(0, 10);
    for (const k of Object.keys(localStorage)) if (k.startsWith(DAY + user + ':') && k.slice(-10) < old) localStorage.removeItem(k);
  } catch { /* 없음 */ }
}
const offlineErr = (e: unknown) => isNetworkError(e);

const toInput = (b: BlockRow): BlockInput => ({ start: b.start_slot, end: b.end_slot, task_id: b.task_id, keyword_id: b.daily_keyword_id, label: b.label, key: b.block_key ?? undefined });
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isStale = (e: unknown) => /stale_day/.test(String((e as { message?: string } | null)?.message ?? ''));

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
