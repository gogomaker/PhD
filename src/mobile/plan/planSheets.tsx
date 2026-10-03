// 일정 시트: 계획 칸(연간·월간) · 실천(주간) · 참고사항 추가 / 고치기 / 보기
// DB 규칙: 칸은 기간·메모만 고칠 수 있고(R-P2), 실천은 추가·삭제만(지난 날이 없을 때) 된다. 지난 기간은 잠금(R-P12)
// 2026-10-03 기획 결정: 위 단계 계획에서 먼저 고르고(계획 밖은 한 번 더), 시작·끝은 드롭다운, 달·해를 넘으면 나눠 저장
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday, type Goal, type MonthCell, type Note, type Practice, type YearCell } from '../../account/AccountProvider';
import { addDays, dayLabel } from '../../lib/day';
import { PALETTE } from '../../lib/palette';
import { isClosed, sortGoals } from '../../lib/goals';
import { dayLocked, fmtDays, isoDow, md, monthOfWeek, outside, practiceDates, weekDays } from '../../lib/plan';
import { NOTE, type Tone } from '../../desktop/plan/shared';
import { BODY, Dot, Field, Notice, Sheet, SheetHead, chip } from '../ui';
import { endsFrom, keysOf, splitRange, unitOf, unitsOf, type Unit, type Zoom } from './units';
import { TimeToggle, badTime, type TimeValue } from '../Sheets';
import { ensurePush } from '../push';

export type { Zoom } from './units';
const pad = (n: number) => String(n).padStart(2, '0');

/** 진행 중인 목표: 카테고리 순서 → 목표 순서 */
export function useOpenGoals() {
  const { goals, goalCategories, subgoals } = useAccount();
  return useMemo(() => {
    const order = new Map(goalCategories.map((c, i) => [c.id, i]));
    const list = sortGoals(goals.filter(g => !isClosed(g))).sort((a, b) => (order.get(a.category_id) ?? 0) - (order.get(b.category_id) ?? 0));
    const toneOf = (g: Pick<Goal, 'category_id'>): Tone => PALETTE[goalCategories.find(c => c.id === g.category_id)?.color ?? 'red'];
    const subsOf = (goalId: string) => subgoals.filter(s => s.goal_id === goalId);
    const subName = (sid: string) => subgoals.find(s => s.id === sid)?.name ?? '';
    return { list, toneOf, subsOf, subName };
  }, [goals, goalCategories, subgoals]);
}

/** 시트 머리 아래 기간 설명 */
export function periodText(zoom: Zoom, key: string) {
  if (zoom === 'year') return `${key}년`;
  if (zoom === 'month') return `${key.slice(0, 4)}년 ${Number(key.slice(5))}월`;
  const { ym, index } = monthOfWeek(key);
  return `${Number(ym.slice(5))}월 ${index + 1}주차 · ${md(key)} – ${md(addDays(key, 6))}`;
}

/**
 * 위 단계 계획(R-P3): 월간이면 그 달에 걸친 연간 칸, 주간이면 그 주에 걸친 월간 칸의 (목표, 세부 목표).
 * 연간은 맨 위라 없다. 위 단계가 비어 있으면 연결을 따지지 않는다 (연간은 선택, 2026-10-03 기획 결정)
 */
export function useUpper() {
  const { yearCells, monthCells } = useAccount();
  return (zoom: Zoom, period: string): { goalId: string; subId: string }[] => {
    if (zoom === 'month') {
      const mk = period + '-01';
      return yearCells.filter(c => c.start_month <= mk && mk <= c.end_month).map(c => ({ goalId: c.goal_id, subId: c.subgoal_id }));
    }
    if (zoom === 'week') {
      const { ym, index } = monthOfWeek(period);
      return monthCells.filter(c => c.year_month === ym + '-01' && c.start_week <= index && index <= c.end_week).map(c => ({ goalId: c.goal_id, subId: c.subgoal_id }));
    }
    return [];
  };
}

/** 위 단계에 계획이 있는데 이 (목표, 세부 목표)는 없으면 '계획 밖' (lib/plan) */
export { outside };

/** 같은 목표(또는 참고사항)의 다른 칸이 차지한 칸 key들 — 한 줄에 겹치지 않는다 (R-P1) */
function useOccupied(zoom: Zoom, goalId: string | 'note' | null, except?: string) {
  const { yearCells, monthCells, notes } = useAccount();
  return useMemo(() => {
    const occ = new Set<string>();
    const add = (keys: string[]) => keys.forEach(k => occ.add(k));
    if (goalId === 'note') {
      const scope = zoom === 'month' ? 'month' : 'week';
      notes.filter(n => n.scope === scope && n.id !== except).forEach(n => add(keysOf(zoom, scope === 'month' ? n.period_key.slice(0, 7) : n.period_key, n.start_index, n.end_index)));
    } else if (goalId && zoom === 'year') {
      yearCells.filter(c => c.goal_id === goalId && c.id !== except).forEach(c => add(keysOf('year', c.start_month.slice(0, 4), Number(c.start_month.slice(5, 7)) - 1, Number(c.end_month.slice(5, 7)) - 1)));
    } else if (goalId && zoom === 'month') {
      monthCells.filter(c => c.goal_id === goalId && c.id !== except).forEach(c => add(keysOf('month', c.year_month.slice(0, 7), c.start_week, c.end_week)));
    }
    return occ;
  }, [zoom, goalId, except, yearCells, monthCells, notes]);
}

/** 시작·끝 드롭다운. 지난 칸·이미 찬 칸은 시작으로 고를 수 없다 */
function RangeSelect({ zoom, starts, endsOf, start, end, onChange }: { zoom: Zoom; starts: Unit[]; endsOf: (start: string) => Unit[]; start: string; end: string; onChange: (s: string, e: string) => void }) {
  const ends = endsOf(start);
  const what = zoom === 'year' ? '달' : zoom === 'month' ? '주' : '요일';
  const sel = { height: 44, fontWeight: 700, cursor: 'pointer', paddingInline: 12 } as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
      <Field label={'시작 ' + what}>
        <select className="input" aria-label={'시작 ' + what} value={start} onChange={e => { const s = e.target.value; onChange(s, endsOf(s).some(u => u.key === end) ? end : s); }} style={sel}>
          {starts.map(u => <option key={u.key} value={u.key}>{u.long}</option>)}
        </select>
      </Field>
      <Field label={'끝 ' + what}>
        <select className="input" aria-label={'끝 ' + what} value={end} onChange={e => onChange(start, e.target.value)} style={sel}>
          {ends.map(u => <option key={u.key} value={u.key}>{u.long}</option>)}
        </select>
      </Field>
    </div>
  );
}

/** 나눠 저장될 때 안내: '10월 2~4주 + 11월 1~3주로 나눠 저장돼요' */
function splitHint(zoom: Zoom, start: string, end: string, today: string) {
  const parts = splitRange(zoom, start, end, today);
  if (parts.length < 2) return null;
  const span = (a: number, b: number) => (a === b ? `${a + 1}` : `${a + 1}~${b + 1}`);
  const name = (p: { piece: string; s: number; e: number }) =>
    zoom === 'year' ? `${p.piece}년 ${span(p.s, p.e)}월` : `${Number(p.piece.slice(5))}월 ${span(p.s, p.e)}주`;
  return parts.map(name).join(' + ') + '로 나눠 저장돼요. 나중에 따로 고칠 수 있어요.';
}

function GoalChips({ goals, cur, onPick, withNote, toneOf }: { goals: Goal[]; cur: string | null; onPick: (id: string) => void; withNote: boolean; toneOf: (g: Goal) => Tone }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {goals.map(g => {
        const t = toneOf(g);
        return (
          <button key={g.id} aria-pressed={cur === g.id} onClick={() => onPick(g.id)} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, ...chip(cur === g.id, t) }}>
            <Dot color={t.dot} />{g.name}
          </button>
        );
      })}
      {withNote && <NoteChip on={cur === 'note'} onPick={() => onPick('note')} />}
    </div>
  );
}

function NoteChip({ on, onPick }: { on: boolean; onPick: () => void }) {
  return (
    <button aria-pressed={on} onClick={onPick} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, ...chip(on, NOTE) }}>
      <Dot color={NOTE.dot} />참고사항
    </button>
  );
}

function SubChips({ subs, cur, onPick, tone }: { subs: { id: string; name: string }[]; cur: string | null; onPick: (id: string) => void; tone: Tone }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {subs.map(s => (
        <button key={s.id} aria-pressed={cur === s.id} onClick={() => onPick(s.id)} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, ...chip(cur === s.id, tone) }}>{s.name}</button>
      ))}
    </div>
  );
}

// ───────── + 계획 / + 실천 ─────────
export function AddPlanSheet({ zoom, periodKey, initialGoal, initialStart, onClose }: { zoom: Zoom; periodKey: string; initialGoal?: string | null; initialStart?: number; onClose: () => void }) {
  const { run } = useAccount();
  const today = useToday();
  const navigate = useNavigate();
  const { list, toneOf, subsOf, subName } = useOpenGoals();
  const upperOf = useUpper();
  const units = unitsOf(zoom, periodKey, today);
  // 위 단계 계획에서 고르기 (진행 중 목표만, 같은 쌍은 한 번)
  const upper = upperOf(zoom, periodKey).filter((u, i, a) => list.some(g => g.id === u.goalId) && a.findIndex(x => x.goalId === u.goalId && x.subId === u.subId) === i);
  const upperName = zoom === 'month' ? '연간 계획' : '월간 계획';
  const [mode, setMode] = useState<'upper' | 'all'>(upper.length ? 'upper' : 'all');
  const first = upper.find(u => !initialGoal || u.goalId === initialGoal);
  const g0 = mode === 'upper' && first ? first.goalId : initialGoal && list.some(g => g.id === initialGoal) ? initialGoal : list[0]?.id ?? null;
  const [goalId, setGoalId] = useState<string | null>(g0);
  const [subId, setSubId] = useState<string | null>(mode === 'upper' && first ? first.subId : g0 ? subsOf(g0)[0]?.id ?? null : null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const isNote = goalId === 'note';
  const practice = zoom === 'week' && !isNote;
  const occupied = useOccupied(zoom, goalId);
  const starts = units.filter(u => !u.locked && !occupied.has(u.key));
  const pref = initialStart != null ? units[initialStart]?.key : undefined;
  const [range, setRange] = useState<{ s: string; e: string } | null>(null);
  // 고른 목표가 바뀌어 시작 칸이 막혔으면 첫 빈 칸으로
  const s0 = range && starts.some(u => u.key === range.s) ? range.s : starts.find(u => u.key === pref)?.key ?? starts[0]?.key;
  const within = zoom === 'week' ? periodKey : undefined;
  const endsOf = (s: string) => endsFrom(zoom, s, occupied, today, within);
  const e0 = s0 && range && range.s === s0 && endsOf(s0).some(u => u.key === range.e) ? range.e : s0;
  const [days, setDays] = useState<number[]>(() => (zoom === 'week' && initialStart != null && !units[initialStart]?.locked ? [initialStart] : []));
  // 실천 시간 (선택, 2026-10-03 UT 5)
  const [time, setTime] = useState<TimeValue>({ on: false, start: '19:00', end: '20:00' });

  const goal = list.find(g => g.id === goalId);
  const tone = goal ? toneOf(goal) : NOTE;
  const subs = goal ? subsOf(goal.id) : [];
  const title = zoom === 'week' ? '실천 추가' : zoom === 'year' ? '연간 계획 추가' : '월간 계획 추가';
  const allLocked = units.every(u => u.locked);
  const out = !isNote && goalId && subId ? outside(upper, goalId, subId) : false;

  const pickGoal = (id: string) => {
    setGoalId(id);
    setSubId(id === 'note' ? null : subsOf(id)[0]?.id ?? null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    let ok = false;
    if (practice) {
      const wd = weekDays(periodKey);
      const weekdays = [...new Set(days.map(i => isoDow(wd[i])))].sort((a, b) => a - b);
      const tm = time.on ? { start_time: time.start, end_time: time.end } : {};
      if (time.on) ensurePush(); // 실천 알람 — 처음 한 번 알림 허락을 받는다
      ok = await run(() => supabase.from('practices').insert({ goal_id: goalId, subgoal_id: subId, week_start_date: periodKey, name: text.trim(), weekdays, ...tm }));
    } else if (s0 && e0) {
      // 달(월간)·해(연간)를 넘으면 나눠 저장 (2026-10-03 기획 결정)
      const parts = splitRange(zoom, s0, e0, today);
      if (isNote) {
        const scope = zoom === 'month' ? 'month' : 'week';
        ok = await run(() => supabase.from('notes').insert(parts.map(p => ({ scope, period_key: scope === 'month' ? p.piece + '-01' : p.piece, start_index: p.s, end_index: p.e, text: text.trim() }))));
      } else if (zoom === 'year') {
        ok = await run(() => supabase.from('year_cells').insert(parts.map(p => ({ goal_id: goalId, subgoal_id: subId, start_month: `${p.piece}-${pad(p.s + 1)}-01`, end_month: `${p.piece}-${pad(p.e + 1)}-01`, memo: text.trim() }))));
      } else {
        ok = await run(() => supabase.from('month_cells').insert(parts.map(p => ({ goal_id: goalId, subgoal_id: subId, year_month: p.piece + '-01', start_week: p.s, end_week: p.e, comment: text.trim() }))));
      }
    }
    setBusy(false);
    if (ok) onClose();
  };

  const off = busy || !goalId || (practice ? !subId || !text.trim() || days.length === 0 || badTime(time) : isNote ? !s0 || !text.trim() : !subId || !s0);
  const labels = units.map(u => u.label);
  const dayHint = days.length === 0 ? '요일을 하나 이상 골라 주세요.' : days.length === 1 ? `${labels[days[0]]}요일 할 일이 돼요. 못 하면 다음 날로 넘어가요.` : `${fmtDays(days, labels)}마다 반복하는 할 일이 돼요.`;

  return (
    <Sheet onClose={onClose} label={title}>
      <SheetHead title={title} sub={periodText(zoom, periodKey)} />
      {list.length === 0 ? (
        <>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>목표를 먼저 만들어 주세요.</span>
          <button className="btn btn-primary" onClick={() => { onClose(); navigate('/plan', { replace: true }); }} style={{ flex: 'none', height: 46 }}>목표 만들러 가기</button>
        </>
      ) : allLocked ? (
        <Notice>지난 기간이라 새로 넣을 수 없어요.</Notice>
      ) : (
        <>
          {mode === 'upper' ? (
            <Field label={`${zoom === 'month' ? '이 달' : '이번 주'} ${upperName}에서 고르기`}>
              <div data-testid="upper-picks" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {upper.map(u => {
                  const g = list.find(x => x.id === u.goalId)!;
                  const t = toneOf(g);
                  const on = goalId === u.goalId && subId === u.subId;
                  return (
                    <button key={u.goalId + u.subId} aria-pressed={on} onClick={() => { setGoalId(u.goalId); setSubId(u.subId); }} style={{ minHeight: 34, padding: '6px 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', ...chip(on, t) }}>
                      <Dot color={t.dot} />{g.name} · {subName(u.subId)}
                    </button>
                  );
                })}
                {zoom !== 'year' && <NoteChip on={isNote} onPick={() => pickGoal('note')} />}
              </div>
              <button onClick={() => setMode('all')} className="btn btn-ghost" style={{ alignSelf: 'flex-start', height: 32, padding: '0 6px', ...BODY, fontSize: 12.5 }}>{upperName} 밖에서 추가</button>
            </Field>
          ) : (
            <>
              {zoom !== 'year' && upper.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>{zoom === 'month' ? '이 달 연간 계획이 비어 있어요. 모든 목표에서 골라요.' : '이번 주 월간 계획이 비어 있어요. 모든 목표에서 골라요.'}</span>}
              <Field label="목표">
                <GoalChips goals={list} cur={goalId} onPick={pickGoal} withNote={zoom !== 'year'} toneOf={toneOf} />
              </Field>
              {!isNote && goal && (
                <Field label="세부 목표" hint={out ? `${upperName}에 없는 세부 목표예요. 일정에 '계획 밖'으로 표시돼요.` : undefined}>
                  <SubChips subs={subs} cur={subId} onPick={setSubId} tone={tone} />
                  {subs.length === 0 && (
                    <button onClick={() => { onClose(); navigate('/goal/' + goal.id, { replace: true }); }} className="btn btn-secondary" style={{ alignSelf: 'flex-start', height: 36, ...BODY, fontSize: 13 }}>이 목표에 세부 목표 추가하기</button>
                  )}
                </Field>
              )}
              {upper.length > 0 && <button onClick={() => { setMode('upper'); setGoalId(upper[0].goalId); setSubId(upper[0].subId); }} className="btn btn-ghost" style={{ alignSelf: 'flex-start', height: 32, padding: '0 6px', ...BODY, fontSize: 12.5, marginTop: -6 }}>← {upperName}에서 고르기</button>}
            </>
          )}
          {practice ? (
            <>
              <Field label="실천">
                <input className="input" aria-label="실천 이름" maxLength={40} value={text} onChange={e => setText(e.target.value)} placeholder="예: Part 3 대화 듣기" />
              </Field>
              <Field label="요일" hint={dayHint}>
                <div role="group" aria-label="요일" style={{ display: 'flex', gap: 4 }}>
                  {units.map((u, i) => {
                    const on = days.includes(i);
                    return (
                      <button key={i} aria-pressed={on} aria-label={u.label + '요일'} disabled={u.locked} title={u.locked ? '지난 날은 고를 수 없어요' : undefined} onClick={() => setDays(on ? days.filter(x => x !== i) : [...days, i])} style={{ flex: 1, height: 36, padding: 0, border: 0, borderRadius: 999, cursor: u.locked ? 'not-allowed' : 'pointer', ...BODY, fontSize: 13, background: on ? tone.ink : 'var(--color-surface)', color: on ? 'var(--color-bg)' : 'var(--color-text)', opacity: u.locked ? 0.35 : 1 }}>{u.label}</button>
                    );
                  })}
                </div>
              </Field>
              <TimeToggle value={time} onChange={setTime} label="시간 정하기" sub="고른 요일마다 시간표에 계획으로 놓이고 알람이 울려요 (선택)" />
            </>
          ) : (
            <>
              <Field label={isNote ? '참고사항' : zoom === 'year' ? '메모' : '코멘트'} hint={isNote ? '할 일로 가지 않는 메모예요.' : undefined}>
                <input className="input" aria-label={isNote ? '참고사항' : zoom === 'year' ? '메모' : '코멘트'} maxLength={200} value={text} onChange={e => setText(e.target.value)} placeholder={isNote ? '예: 추석 연휴' : zoom === 'year' ? '예: 기출 5회' : '예: 시험 일정에 맞춰 당김'} />
              </Field>
              {!s0 || !e0 ? (
                <Notice>이 기간에는 더 넣을 자리가 없어요. 한 기간에는 목표마다 세부 목표 하나만 들어가요.</Notice>
              ) : (
                <>
                  <RangeSelect zoom={zoom} starts={starts} endsOf={endsOf} start={s0} end={e0} onChange={(s, e) => setRange({ s, e })} />
                  {splitHint(zoom, s0, e0, today) && <span data-testid="split-hint" style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -8, textWrap: 'pretty' }}>{splitHint(zoom, s0, e0, today)}</span>}
                </>
              )}
            </>
          )}
          <button className="btn btn-primary" onClick={submit} disabled={off} style={{ flex: 'none', height: 46 }}>추가</button>
        </>
      )}
    </Sheet>
  );
}

// ───────── 계획 칸 고치기 (기간·메모만, 그 해·그 달 안에서) ─────────
export function EditCellSheet({ zoom, cell, onClose }: { zoom: 'year' | 'month'; cell: YearCell | MonthCell; onClose: () => void }) {
  const { goals, run } = useAccount();
  const today = useToday();
  const { toneOf, subName } = useOpenGoals();
  const isYear = zoom === 'year';
  const piece = isYear ? (cell as YearCell).start_month.slice(0, 4) : (cell as MonthCell).year_month.slice(0, 7);
  const units = unitsOf(zoom, piece, today);
  const s0 = isYear ? Number((cell as YearCell).start_month.slice(5, 7)) - 1 : (cell as MonthCell).start_week;
  const e0 = isYear ? Number((cell as YearCell).end_month.slice(5, 7)) - 1 : (cell as MonthCell).end_week;
  const occupied = useOccupied(zoom, cell.goal_id, cell.id);
  const [range, setRange] = useState({ s: units[s0]?.key ?? '', e: units[e0]?.key ?? '' });
  const [text, setText] = useState(isYear ? (cell as YearCell).memo : (cell as MonthCell).comment);
  const [busy, setBusy] = useState(false);
  const goal = goals.find(g => g.id === cell.goal_id);
  const tone = goal ? toneOf(goal) : NOTE;
  const locked = !!units[s0]?.locked || (goal ? isClosed(goal) : true);
  const label = isYear ? '메모' : '코멘트';
  const starts = units.filter(u => (!u.locked && !occupied.has(u.key)) || u.key === range.s);
  const endsOf = (s: string) => endsFrom(zoom, s, occupied, today, piece);
  const span = (a: number, b: number) => (a === b ? units[a]?.label : `${units[a]?.label}–${units[b]?.label}`);

  const save = async () => {
    setBusy(true);
    const s = unitOf(zoom, range.s, today).idx, e = unitOf(zoom, range.e, today).idx;
    const ok = await run(() =>
      isYear
        ? supabase.from('year_cells').update({ start_month: `${piece}-${pad(s + 1)}-01`, end_month: `${piece}-${pad(e + 1)}-01`, memo: text.trim() }).eq('id', cell.id)
        : supabase.from('month_cells').update({ start_week: s, end_week: e, comment: text.trim() }).eq('id', cell.id),
    );
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    setBusy(true);
    const ok = await run(() => supabase.from(isYear ? 'year_cells' : 'month_cells').delete().eq('id', cell.id));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet onClose={onClose} label="계획 칸">
      <SheetHead title={locked ? '계획 보기' : '계획 수정'} sub={`${periodText(zoom, piece)} · ${span(s0, e0)}`} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 18, background: tone.bg, color: tone.ink, ...BODY, fontSize: 13.5 }}>
        <Dot color={tone.dot} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal?.name} · {subName(cell.subgoal_id)}</span>
      </div>
      {locked ? (
        <>
          {text && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{text}</p>}
          <Notice>지난 기간 계획은 볼 수만 있어요.</Notice>
          <button className="btn btn-primary" onClick={onClose} style={{ flex: 'none', height: 46 }}>닫기</button>
        </>
      ) : (
        <>
          <Field label={label}>
            <input className="input" aria-label={label} maxLength={200} value={text} onChange={e => setText(e.target.value)} />
          </Field>
          <RangeSelect zoom={zoom} starts={starts} endsOf={endsOf} start={range.s} end={range.e} onChange={(s, e) => setRange({ s, e })} />
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -6, textWrap: 'pretty' }}>{isYear ? '이 해' : '이 달'} 안에서 고칠 수 있어요. 다른 세부 목표로 바꾸려면 지우고 새로 넣어 주세요.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={remove} disabled={busy} style={{ flex: 'none', height: 46, padding: '0 20px', ...BODY, color: 'var(--color-accent-700)' }}>삭제</button>
            <button className="btn btn-primary" onClick={save} disabled={busy} style={{ flex: 1, height: 46 }}>저장</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ───────── 참고사항 고치기 ─────────
export function EditNoteSheet({ note, onClose }: { note: Note; onClose: () => void }) {
  const { run } = useAccount();
  const today = useToday();
  const zoom: Zoom = note.scope === 'month' ? 'month' : 'week';
  const piece = note.scope === 'month' ? note.period_key.slice(0, 7) : note.period_key;
  const units = unitsOf(zoom, piece, today);
  const occupied = useOccupied(zoom, 'note', note.id);
  const [range, setRange] = useState({ s: units[note.start_index]?.key ?? '', e: units[note.end_index]?.key ?? '' });
  const [text, setText] = useState(note.text);
  const [busy, setBusy] = useState(false);
  const locked = !!units[note.start_index]?.locked;
  const starts = units.filter(u => (!u.locked && !occupied.has(u.key)) || u.key === range.s);
  const endsOf = (s: string) => endsFrom(zoom, s, occupied, today, piece);
  const span = note.start_index === note.end_index ? units[note.start_index]?.label : `${units[note.start_index]?.label}–${units[note.end_index]?.label}`;

  const save = async () => {
    setBusy(true);
    const ok = await run(() => supabase.from('notes').update({ start_index: unitOf(zoom, range.s, today).idx, end_index: unitOf(zoom, range.e, today).idx, text: text.trim() }).eq('id', note.id));
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    setBusy(true);
    const ok = await run(() => supabase.from('notes').delete().eq('id', note.id));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet onClose={onClose} label="참고사항">
      <SheetHead title="참고사항" sub={`${periodText(zoom, piece)} · ${span}`} />
      {locked ? (
        <>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{note.text || '(비어 있음)'}</p>
          <Notice>지난 기간 참고사항은 볼 수만 있어요.</Notice>
          <button className="btn btn-primary" onClick={onClose} style={{ flex: 'none', height: 46 }}>닫기</button>
        </>
      ) : (
        <>
          <Field label="참고사항" hint="할 일로 가지 않는 메모예요.">
            <input className="input" aria-label="참고사항" maxLength={200} value={text} onChange={e => setText(e.target.value)} />
          </Field>
          <RangeSelect zoom={zoom} starts={starts} endsOf={endsOf} start={range.s} end={range.e} onChange={(s, e) => setRange({ s, e })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={remove} disabled={busy} style={{ flex: 'none', height: 46, padding: '0 20px', ...BODY, color: 'var(--color-accent-700)' }}>삭제</button>
            <button className="btn btn-primary" onClick={save} disabled={busy || !text.trim()} style={{ flex: 1, height: 46 }}>저장</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ───────── 실천 보기 (+ 지난 날이 없으면 지우기) ─────────
export function PracticeSheet({ practice: p, onClose }: { practice: Practice; onClose: () => void }) {
  const { goals, run } = useAccount();
  const today = useToday();
  const { toneOf, subName } = useOpenGoals();
  const [busy, setBusy] = useState(false);
  const goal = goals.find(g => g.id === p.goal_id);
  const tone = goal ? toneOf(goal) : NOTE;
  const dates = practiceDates(p.week_start_date, p.weekdays);
  const wd = weekDays(p.week_start_date);
  const labels = wd.map(d => dayLabel(d).dow);
  const pos = dates.map(d => wd.indexOf(d));
  const locked = dayLocked(dates[0], today) || (goal ? isClosed(goal) : true);
  const remove = async () => {
    setBusy(true);
    const ok = await run(() => supabase.from('practices').delete().eq('id', p.id));
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet onClose={onClose} label="실천">
      <SheetHead title={p.name} sub={periodText('week', p.week_start_date)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 18, background: tone.bg, color: tone.ink, ...BODY, fontSize: 13.5 }}>
        <Dot color={tone.dot} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal?.name} · {subName(p.subgoal_id)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
        <span><b>{fmtDays(pos, labels)}</b> {p.weekdays.length > 1 ? '· 고른 요일마다 반복해요' : '· 못 하면 다음 날로 넘어가요'}</span>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{dates.map(d => md(d)).join(', ')}</span>
        {p.start_time && <span data-testid="practice-time"><b>{p.start_time.slice(0, 5)}–{p.end_time?.slice(0, 5)}</b> · 시간표에 놓이고 알람이 울려요</span>}
      </div>
      {locked ? (
        <Notice>지난 날이 들어간 실천은 지울 수 없어요.</Notice>
      ) : (
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>실천은 고칠 수 없어요. 바꾸려면 지우고 다시 적어 주세요.</span>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {!locked && <button className="btn btn-ghost" onClick={remove} disabled={busy} style={{ flex: 'none', height: 46, padding: '0 20px', ...BODY, color: 'var(--color-accent-700)' }}>삭제</button>}
        <button className="btn btn-primary" onClick={onClose} style={{ flex: 1, height: 46 }}>닫기</button>
      </div>
    </Sheet>
  );
}
