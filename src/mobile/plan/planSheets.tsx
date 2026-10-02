// 일정 시트: 계획 칸(연간·월간) · 실천(주간) · 참고사항 추가 / 고치기 / 보기
// DB 규칙: 칸은 기간·메모만 고칠 수 있고(R-P2), 실천은 추가·삭제만(지난 날이 없을 때) 된다. 지난 기간은 잠금(R-P12)
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday, type Goal, type MonthCell, type Note, type Practice, type YearCell } from '../../account/AccountProvider';
import { addDays, dayLabel, type DayKey } from '../../lib/day';
import { PALETTE } from '../../lib/palette';
import { isClosed, sortGoals } from '../../lib/goals';
import { dayLocked, fmtDays, isoDow, md, monthLocked, monthOfWeek, monthWeeks, practiceDates, weekDays, weekLocked } from '../../lib/plan';
import { NOTE, type Tone } from '../../desktop/plan/shared';
import { BODY, Dot, Field, Notice, Sheet, SheetHead, chip } from '../ui';

export type Zoom = 'year' | 'month' | 'week';
type Slot = { label: string; locked: boolean };
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

/** 한 기간의 칸들: 연간 = 12달, 월간 = 그 달의 주, 주간 = 7일 */
export function slotsOf(zoom: Zoom, key: string, today: DayKey): Slot[] {
  if (zoom === 'year') return Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, locked: monthLocked(`${key}-${pad(i + 1)}`, today) }));
  if (zoom === 'month') return monthWeeks(key).map((w, i) => ({ label: `${i + 1}주`, locked: weekLocked(w, today) }));
  return weekDays(key).map(d => ({ label: dayLabel(d).dow, locked: dayLocked(d, today) }));
}

/** 시트 머리 아래 기간 설명 */
export function periodText(zoom: Zoom, key: string) {
  if (zoom === 'year') return `${key}년`;
  if (zoom === 'month') return `${key.slice(0, 4)}년 ${Number(key.slice(5))}월`;
  const { ym, index } = monthOfWeek(key);
  return `${Number(ym.slice(5))}월 ${index + 1}주차 · ${md(key)} – ${md(addDays(key, 6))}`;
}

const unitOf = (zoom: Zoom) => (zoom === 'year' ? '개월' : zoom === 'month' ? '주' : '일');
const rangeText = (slots: Slot[], s: number, e: number) => (s === e ? slots[s]?.label : `${slots[s]?.label}–${slots[e]?.label}`);

/** 같은 목표(또는 참고사항)의 다른 칸이 차지한 자리 — 한 줄에 겹치지 않는다 (R-P1) */
function useOccupied(zoom: Zoom, key: string, goalId: string | 'note' | null, except?: string) {
  const { yearCells, monthCells, notes } = useAccount();
  const n = zoom === 'year' ? 12 : zoom === 'month' ? monthWeeks(key).length : 7;
  const occ = Array(n).fill(false) as boolean[];
  const mark = (s: number, e: number) => { for (let i = Math.max(0, s); i <= Math.min(n - 1, e); i++) occ[i] = true; };
  if (goalId === 'note') {
    const scope = zoom === 'month' ? 'month' : 'week';
    const pk = zoom === 'month' ? key + '-01' : key;
    notes.filter(x => x.scope === scope && x.period_key === pk && x.id !== except).forEach(x => mark(x.start_index, x.end_index));
  } else if (goalId && zoom === 'year') {
    yearCells.filter(c => c.goal_id === goalId && c.id !== except && c.start_month.startsWith(key)).forEach(c => mark(Number(c.start_month.slice(5, 7)) - 1, Number(c.end_month.slice(5, 7)) - 1));
  } else if (goalId && zoom === 'month') {
    monthCells.filter(c => c.goal_id === goalId && c.id !== except && c.year_month === key + '-01').forEach(c => mark(c.start_week, c.end_week));
  }
  return occ;
}

/** 시작 칸 + 길이 고르기. 지난 칸·이미 찬 칸은 시작으로 고를 수 없고, 찬 칸 앞까지만 늘어난다 */
function RangePicker({ zoom, slots, occupied, start, len, onChange, startLabel }: { zoom: Zoom; slots: Slot[]; occupied: boolean[]; start: number; len: number; onChange: (start: number, len: number) => void; startLabel: string }) {
  const maxLen = (s: number) => {
    let k = 0;
    while (s + k < slots.length && !occupied[s + k]) k++;
    return Math.max(1, k);
  };
  const cols = zoom === 'year' ? 6 : slots.length;
  return (
    <>
      <Field label={startLabel}>
        <div role="group" aria-label={startLabel} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 4 }}>
          {slots.map((s, i) => {
            const off = s.locked || occupied[i];
            const on = i === start;
            return (
              <button key={i} aria-pressed={on} disabled={off} title={s.locked ? '지난 기간이에요' : occupied[i] ? '이미 계획이 있어요' : undefined} onClick={() => onChange(i, Math.min(len, maxLen(i)))} style={{ height: 34, padding: 0, border: 0, borderRadius: 999, cursor: off ? 'not-allowed' : 'pointer', ...BODY, fontSize: 12.5, background: on ? 'var(--color-text)' : 'var(--color-surface)', color: on ? 'var(--color-bg)' : 'var(--color-text)', opacity: off ? 0.35 : 1 }}>{s.label}</button>
            );
          })}
        </div>
      </Field>
      <Field label="기간">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => onChange(start, len - 1)} disabled={len <= 1} aria-label="기간 줄이기" style={{ width: 40, height: 40, padding: 0, fontSize: 18 }}>−</button>
          <span data-testid="range-len" style={{ minWidth: 84, textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>{len}{unitOf(zoom)}</span>
          <button className="btn btn-secondary" onClick={() => onChange(start, len + 1)} disabled={len >= maxLen(start)} aria-label="기간 늘리기" style={{ width: 40, height: 40, padding: 0, fontSize: 18 }}>+</button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{rangeText(slots, start, start + len - 1)}</span>
        </div>
      </Field>
    </>
  );
}

/** 첫 번째로 고를 수 있는 시작 칸 (prefer가 되면 그것) */
function firstFree(slots: Slot[], occupied: boolean[], prefer?: number) {
  if (prefer != null && slots[prefer] && !slots[prefer].locked && !occupied[prefer]) return prefer;
  const i = slots.findIndex((s, k) => !s.locked && !occupied[k]);
  return i < 0 ? -1 : i;
}

/** 상위 계획(R-P3)에서 이 기간에 넣은 세부 목표 → 맨 앞 + 미리 고름 (R-P5, R-P7) */
function useUpperSub(zoom: Zoom, key: string) {
  const { yearCells, monthCells } = useAccount();
  return (goalId: string): string | undefined => {
    if (zoom === 'month') {
      const mk = key + '-01';
      return yearCells.find(c => c.goal_id === goalId && c.start_month <= mk && mk <= c.end_month)?.subgoal_id;
    }
    if (zoom === 'week') {
      const { ym, index } = monthOfWeek(key);
      return monthCells.find(c => c.goal_id === goalId && c.year_month === ym + '-01' && c.start_week <= index && index <= c.end_week)?.subgoal_id;
    }
    return undefined;
  };
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
      {withNote && (
        <button aria-pressed={cur === 'note'} onClick={() => onPick('note')} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, ...chip(cur === 'note', NOTE) }}>
          <Dot color={NOTE.dot} />참고사항
        </button>
      )}
    </div>
  );
}

function SubChips({ subs, cur, onPick, tone, upper, upperLabel }: { subs: { id: string; name: string }[]; cur: string | null; onPick: (id: string) => void; tone: Tone; upper?: string; upperLabel: string }) {
  const ordered = [...subs].sort((a, b) => Number(b.id === upper) - Number(a.id === upper));
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ordered.map(s => (
        <button key={s.id} aria-pressed={cur === s.id} onClick={() => onPick(s.id)} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, ...chip(cur === s.id, tone) }}>
          {s.name}
          {s.id === upper && <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.75 }}>{upperLabel}</span>}
        </button>
      ))}
    </div>
  );
}

// ───────── + 계획 / + 실천 ─────────
export function AddPlanSheet({ zoom, periodKey, initialGoal, initialStart, onClose }: { zoom: Zoom; periodKey: string; initialGoal?: string | null; initialStart?: number; onClose: () => void }) {
  const { create, run } = useAccount();
  const today = useToday();
  const navigate = useNavigate();
  const { list, toneOf, subsOf } = useOpenGoals();
  const upperOf = useUpperSub(zoom, periodKey);
  const slots = slotsOf(zoom, periodKey, today);
  const pick0 = initialGoal && list.some(g => g.id === initialGoal) ? initialGoal : list[0]?.id ?? null;
  const subOf = (gid: string | null) => (gid && gid !== 'note' ? upperOf(gid) ?? subsOf(gid)[0]?.id ?? null : null);
  const [goalId, setGoalId] = useState<string | null>(pick0);
  const [subId, setSubId] = useState<string | null>(subOf(pick0));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const isNote = goalId === 'note';
  const occupied = useOccupied(zoom, periodKey, goalId);
  const [range, setRange] = useState(() => ({ start: firstFree(slots, occupied, initialStart), len: 1 }));
  // 고른 목표가 바뀌면 시작 칸이 막혔을 수 있다
  const start = range.start >= 0 && !slots[range.start]?.locked && !occupied[range.start] ? range.start : firstFree(slots, occupied, initialStart);
  const len = start === range.start ? range.len : 1;
  // 주간 실천: 요일 고르기 (요일 1개 = 그 요일 칸, 여러 개 = 반복)
  const [days, setDays] = useState<number[]>(() => (zoom === 'week' && initialStart != null && !slots[initialStart]?.locked ? [initialStart] : []));

  const goal = list.find(g => g.id === goalId);
  const tone = goal ? toneOf(goal) : NOTE;
  const subs = goal ? subsOf(goal.id) : [];
  const title = zoom === 'week' ? '실천 추가' : zoom === 'year' ? '연간 계획 추가' : '월간 계획 추가';
  const practice = zoom === 'week' && !isNote;
  const allLocked = slots.every(s => s.locked);

  const pickGoal = (id: string) => {
    setGoalId(id);
    setSubId(subOf(id));
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    let ok = false;
    const end = start + len - 1;
    if (practice) {
      const wd = weekDays(periodKey);
      const weekdays = [...new Set(days.map(i => isoDow(wd[i])))].sort((a, b) => a - b);
      ok = await run(() => supabase.from('practices').insert({ goal_id: goalId, subgoal_id: subId, week_start_date: periodKey, name: text.trim(), weekdays }));
    } else if (isNote) {
      const scope = zoom === 'month' ? 'month' : 'week';
      ok = !!(await create(() => supabase.from('notes').insert({ scope, period_key: zoom === 'month' ? periodKey + '-01' : periodKey, start_index: start, end_index: end, text: text.trim() }).select('id').single()));
    } else if (zoom === 'year') {
      ok = !!(await create(() => supabase.from('year_cells').insert({ goal_id: goalId, subgoal_id: subId, start_month: `${periodKey}-${pad(start + 1)}-01`, end_month: `${periodKey}-${pad(end + 1)}-01`, memo: text.trim() }).select('id').single()));
    } else {
      ok = !!(await create(() => supabase.from('month_cells').insert({ goal_id: goalId, subgoal_id: subId, year_month: periodKey + '-01', start_week: start, end_week: end, comment: text.trim() }).select('id').single()));
    }
    setBusy(false);
    if (ok) onClose();
  };

  const off = busy || !goalId || (practice ? !subId || !text.trim() || days.length === 0 : isNote ? start < 0 || !text.trim() : !subId || start < 0);
  const dayHint = days.length === 0 ? '요일을 하나 이상 골라 주세요.' : days.length === 1 ? `${slots[days[0]].label}요일 할 일이 돼요. 못 하면 다음 날로 넘어가요.` : `${fmtDays(days, slots.map(s => s.label))}마다 반복하는 할 일이 돼요.`;

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
          <Field label="목표">
            <GoalChips goals={list} cur={goalId} onPick={pickGoal} withNote={zoom !== 'year'} toneOf={toneOf} />
          </Field>
          {!isNote && goal && (
            <Field label="세부 목표">
              <SubChips subs={subs} cur={subId} onPick={setSubId} tone={tone} upper={upperOf(goal.id)} upperLabel={zoom === 'month' ? '연간 계획' : '이번 주 계획'} />
              {subs.length === 0 && (
                <button onClick={() => { onClose(); navigate('/goal/' + goal.id, { replace: true }); }} className="btn btn-secondary" style={{ alignSelf: 'flex-start', height: 36, ...BODY, fontSize: 13 }}>이 목표에 세부 목표 추가하기</button>
              )}
            </Field>
          )}
          {practice ? (
            <>
              <Field label="실천">
                <input className="input" aria-label="실천 이름" maxLength={40} value={text} onChange={e => setText(e.target.value)} placeholder="예: Part 3 대화 듣기" />
              </Field>
              <Field label="요일" hint={dayHint}>
                <div role="group" aria-label="요일" style={{ display: 'flex', gap: 4 }}>
                  {slots.map((s, i) => {
                    const on = days.includes(i);
                    return (
                      <button key={i} aria-pressed={on} aria-label={s.label + '요일'} disabled={s.locked} title={s.locked ? '지난 날은 고를 수 없어요' : undefined} onClick={() => setDays(on ? days.filter(x => x !== i) : [...days, i])} style={{ flex: 1, height: 36, padding: 0, border: 0, borderRadius: 999, cursor: s.locked ? 'not-allowed' : 'pointer', ...BODY, fontSize: 13, background: on ? tone.ink : 'var(--color-surface)', color: on ? 'var(--color-bg)' : 'var(--color-text)', opacity: s.locked ? 0.35 : 1 }}>{s.label}</button>
                    );
                  })}
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label={isNote ? '참고사항' : zoom === 'year' ? '메모' : '코멘트'} hint={isNote ? '할 일로 가지 않는 메모예요.' : undefined}>
                <input className="input" aria-label={isNote ? '참고사항' : zoom === 'year' ? '메모' : '코멘트'} maxLength={200} value={text} onChange={e => setText(e.target.value)} placeholder={isNote ? '예: 추석 연휴' : zoom === 'year' ? '예: 기출 5회' : '예: 시험 일정에 맞춰 당김'} />
              </Field>
              {start < 0 ? (
                <Notice>이 기간에는 더 넣을 자리가 없어요.</Notice>
              ) : (
                <RangePicker zoom={zoom} slots={slots} occupied={occupied} start={start} len={len} onChange={(s, l) => setRange({ start: s, len: l })} startLabel={zoom === 'year' ? '시작 달' : zoom === 'month' ? '시작 주' : '시작 요일'} />
              )}
            </>
          )}
          <button className="btn btn-primary" onClick={submit} disabled={off} style={{ flex: 'none', height: 46 }}>추가</button>
        </>
      )}
    </Sheet>
  );
}

// ───────── 계획 칸 고치기 (기간·메모만) ─────────
export function EditCellSheet({ zoom, cell, onClose }: { zoom: 'year' | 'month'; cell: YearCell | MonthCell; onClose: () => void }) {
  const { goals, run } = useAccount();
  const today = useToday();
  const { toneOf, subName } = useOpenGoals();
  const isYear = zoom === 'year';
  const key = isYear ? (cell as YearCell).start_month.slice(0, 4) : (cell as MonthCell).year_month.slice(0, 7);
  const slots = slotsOf(zoom, key, today);
  const s0 = isYear ? Number((cell as YearCell).start_month.slice(5, 7)) - 1 : (cell as MonthCell).start_week;
  const e0 = isYear ? Number((cell as YearCell).end_month.slice(5, 7)) - 1 : (cell as MonthCell).end_week;
  const occupied = useOccupied(zoom, key, cell.goal_id, cell.id);
  const [range, setRange] = useState({ start: s0, len: e0 - s0 + 1 });
  const [text, setText] = useState(isYear ? (cell as YearCell).memo : (cell as MonthCell).comment);
  const [busy, setBusy] = useState(false);
  const goal = goals.find(g => g.id === cell.goal_id);
  const tone = goal ? toneOf(goal) : NOTE;
  const locked = slots[s0]?.locked || (goal ? isClosed(goal) : true);
  const label = isYear ? '메모' : '코멘트';

  const save = async () => {
    setBusy(true);
    const s = range.start, e = range.start + range.len - 1;
    const ok = await run(() =>
      isYear
        ? supabase.from('year_cells').update({ start_month: `${key}-${pad(s + 1)}-01`, end_month: `${key}-${pad(e + 1)}-01`, memo: text.trim() }).eq('id', cell.id)
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
      <SheetHead title={locked ? '계획 보기' : '계획 수정'} sub={`${periodText(zoom, key)} · ${rangeText(slots, s0, e0)}`} />
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
          <RangePicker zoom={zoom} slots={slots} occupied={occupied} start={range.start} len={range.len} onChange={(s, l) => setRange({ start: s, len: l })} startLabel={isYear ? '시작 달' : '시작 주'} />
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: -6, textWrap: 'pretty' }}>다른 세부 목표로 바꾸려면 지우고 새로 넣어 주세요.</span>
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
  const key = note.scope === 'month' ? note.period_key.slice(0, 7) : note.period_key;
  const slots = slotsOf(zoom, key, today);
  const occupied = useOccupied(zoom, key, 'note', note.id);
  const [range, setRange] = useState({ start: note.start_index, len: note.end_index - note.start_index + 1 });
  const [text, setText] = useState(note.text);
  const [busy, setBusy] = useState(false);
  const locked = !!slots[note.start_index]?.locked;

  const save = async () => {
    setBusy(true);
    const ok = await run(() => supabase.from('notes').update({ start_index: range.start, end_index: range.start + range.len - 1, text: text.trim() }).eq('id', note.id));
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
      <SheetHead title="참고사항" sub={`${periodText(zoom, key)} · ${rangeText(slots, note.start_index, note.end_index)}`} />
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
          <RangePicker zoom={zoom} slots={slots} occupied={occupied} start={range.start} len={range.len} onChange={(s, l) => setRange({ start: s, len: l })} startLabel={zoom === 'month' ? '시작 주' : '시작 요일'} />
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
