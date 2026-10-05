import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday, type Goal, type Practice } from '../../account/AccountProvider';
import { addDays, dayLabel, isDayKey, type DayKey } from '../../lib/day';
import { cellSubs, dayLocked, fmtDays, isoDow, md, monthOfWeek, monthWeeks, outside, picksOf, practiceDates, weekDays, weekStartOf, WEEK_START } from '../../lib/plan';
import { MergeColumn, type MBlock } from './MergeColumn';
import { offerUndo, typing } from './undo';
import { byTime } from '../../lib/today';
import { TimeToggle, badTime, type TimeValue } from '../../mobile/Sheets';
import { Chip, ColumnHeader, ICONS, LockNote, NOTE, NoColumns, OutTag, PlanHeader, PopHead, Popover, RefRow, RowLabel, SubgoalPicker, Svg, TableFrame, useSelection, useTableGoals, type RefCell, type Tone } from './shared';

const MAX_SHOWN = 3; // R-P9
const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');

type Pop = { goalId: string; row: number; anchor: DOMRect; sub: string | null; name: string; days: number[]; time: TimeValue };

// 주간 계획: "이번 주" 줄 + 요일 7줄. 목표 열에는 병합 없이 실천을 쌓는다 (R-P6). 참고사항 열만 병합
export default function WeekPlan() {
  const { monthCells, notes, practices, run, create, toast, profile } = useAccount();
  const dayStart = profile?.day_start_hour ?? 5;
  const today = useToday();
  const ws = WEEK_START;
  const [params, setParams] = useSearchParams();
  const thisWeek = weekStartOf(today, ws);
  const asked = params.get('w');
  const week = isDayKey(asked) ? weekStartOf(asked, ws) : thisWeek;
  const days = weekDays(week);
  const labels = days.map(d => dayLabel(d).dow);
  const { ym, index } = monthOfWeek(week);
  const [y, m] = ym.split('-').map(Number);
  const tabs = monthWeeks(ym, ws);

  const [sel, setSel] = useSelection();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const todayRow = days.indexOf(today);
  // R-P12: 지난 날은 잠금
  const lockedDays = days.filter(d => dayLocked(d, today)).length;

  const go = (w: DayKey) => { setSel(null); setPop(null); setParams(w === thisWeek ? {} : { w }); };
  const subName = (goalId: string, sid: string) => subsOf(goalId).find(s => s.id === sid)?.name ?? '';
  // 월간 표에서 이번 주를 덮는 칸
  const upper = (goalId: string) => monthCells.find(c => c.goal_id === goalId && c.year_month === ym + '-01' && c.start_week <= index && index <= c.end_week);
  const upperNote = notes.find(n => n.scope === 'month' && n.period_key === ym + '-01' && n.start_index <= index && index <= n.end_index);

  // 이번 주에 걸친 실천: 요일 1개면 그 요일 칸, 2개 이상이면 "이번 주" 줄 (R-P8)
  const inWeek = practices
    .map(p => ({ p, pos: practiceDates(p.week_start_date, p.weekdays).map(d => days.indexOf(d)).filter(i => i >= 0) }))
    .filter(x => x.pos.length > 0)
    .map(x => ({ ...x, locked: dayLocked(practiceDates(x.p.week_start_date, x.p.weekdays)[0], today) }));
  // 이번 주에 실천이 있는 목표는 숨겼어도 열로
  const { cols, toneOf, catOf, subsOf, pinned } = useTableGoals(new Set(inWeek.map(x => x.p.goal_id)));
  // R-P14: 이번 주의 월간 계획 (어느 목표든)
  const ups = picksOf(monthCells.filter(c => c.year_month === ym + '-01' && c.start_week <= index && index <= c.end_week));
  const cellItems = (goalId: string, row: number) =>
    inWeek
      .filter(x => x.p.goal_id === goalId && (row === -1 ? x.p.weekdays.length > 1 : x.p.weekdays.length === 1 && x.pos[0] === row))
      .sort((a, b) => Math.min(...a.pos) - Math.min(...b.pos) || byTime(a.p, b.p, dayStart) || a.p.created_at.localeCompare(b.p.created_at));

  const noteBlocks: MBlock[] = notes.filter(n => n.scope === 'week' && n.period_key === week).map(n => ({ id: n.id, start: n.start_index, end: n.end_index, text: n.text }));
  const addNote = async (row: number, end = row) => {
    const id = await create(() => supabase.from('notes').insert({ scope: 'week', period_key: week, start_index: row, end_index: end }).select('id').single());
    if (id) { setSel(id); setFocusId(id); }
  };

  // 실천 지우기 + 되돌리기 (2026-10-03 UT 11). 고른 실천은 Delete 키로도
  const removePractice = async (p: Practice) => {
    setSel(null);
    if (!(await run(() => supabase.from('practices').delete().eq('id', p.id)))) return;
    offerUndo(toast, `'${p.name}' 실천을 지웠어요`, () => run(() => supabase.from('practices').insert({ goal_id: p.goal_id, subgoal_id: p.subgoal_id, week_start_date: p.week_start_date, name: p.name, weekdays: p.weekdays, ...(p.start_time ? { start_time: p.start_time, end_time: p.end_time } : {}) })));
  };
  useEffect(() => {
    const p = inWeek.find(x => x.p.id === sel && !x.locked)?.p;
    if (!p) return;
    const key = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing()) { e.preventDefault(); removePractice(p); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const submit = async () => {
    if (!pop || !pop.sub || !pop.name.trim() || pop.days.length === 0 || badTime(pop.time, dayStart)) return;
    const weekdays = [...new Set(pop.days.map(i => isoDow(days[i])))].sort((a, b) => a - b);
    const ok = await run(() => supabase.from('practices').insert({ goal_id: pop.goalId, subgoal_id: pop.sub, week_start_date: week, name: pop.name.trim(), weekdays, ...(pop.time.on ? { start_time: pop.time.start, end_time: pop.time.end } : {}) }));
    if (ok) setPop(null);
  };

  const refs: RefCell[] = [
    upperNote ? { col: 2, text: upperNote.text || ' ', tone: NOTE } : { col: 2, empty: true },
    ...cols.map((g, i): RefCell => {
      const u = upper(g.id);
      return u ? { col: i + 3, chips: cellSubs(u).map(sid => subName(g.id, sid)), text: u.comment, tone: toneOf(g) } : { col: i + 3, empty: true };
    }),
  ];
  const popGoal = pop && cols.find(g => g.id === pop.goalId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PlanHeader
        kicker="주간 계획"
        title={`${m}월 ${index + 1}주차`}
        sub="이번 주에 실제로 할 실천을 적어요. 여기 적은 실천이 모바일 하루 플래너의 할 일이 돼요."
        onPrev={() => go(addDays(week, -7))}
        onNext={() => go(addDays(week, 7))}
        prevLabel="지난주"
        nextLabel="다음 주"
        onToday={week !== thisWeek ? () => go(thisWeek) : undefined}
        todayLabel="이번 주"
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist" aria-label={`${y}년 ${m}월의 주`}>
        {tabs.map((w, i) => (
          <button key={w} role="tab" aria-selected={w === week} className={pill(w === week)} onClick={() => go(w)} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, gap: 8 }}>
            {i + 1}주차<span style={{ fontWeight: 500, opacity: 0.75 }}>{md(w)} – {md(addDays(w, 6))}</span>
          </button>
        ))}
      </div>
      {cols.length > 0 && lockedDays > 0 && <LockNote all={lockedDays === 7} />}
      {cols.length === 0 ? (
        <NoColumns />
      ) : (
        <TableFrame columns={'96px minmax(124px, 1fr) ' + cols.map(() => 'minmax(168px, 1fr)').join(' ')} minWidth={96 + 129 + cols.length * 173} rowHeight={56}>
          <div style={{ gridRow: 1, gridColumn: 1, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>요일</div>
          <ColumnHeader col={2} name="참고사항" sub="모바일로 가지 않는 메모" dot={NOTE.dot} />
          {cols.map((g, i) => <ColumnHeader key={g.id} col={i + 3} name={g.name} sub={catOf(g)?.name ?? ''} dot={toneOf(g).dot} goalId={g.id} pinned={pinned(g)} />)}
          <RefRow label={`월간 · ${index + 1}주차`} cells={refs} emptyText="월간 표의 이번 주 칸이 여기로 내려와요" lastCol={cols.length + 2} />
          <RowLabel row={3} label="이번 주" sub="여러 날에 걸친 실천" tone="week" />
          {days.map((d, i) => <RowLabel key={d} row={i + 4} label={labels[i]} sub={md(d)} today={i === todayRow} />)}
          <div style={{ gridRow: 3, gridColumn: 2 }} />
          <MergeColumn
            col={2}
            firstRow={4}
            rowCount={7}
            lockedBefore={lockedDays}
            label="참고사항"
            blocks={noteBlocks}
            tone={NOTE}
            noteOnly
            placeholder="메모"
            sel={sel}
            setSel={setSel}
            focusId={focusId}
            onEmpty={(row, _a, end) => addNote(row, end)}
            onRange={(b, s, e) => run(() => supabase.from('notes').update({ start_index: s, end_index: e }).eq('id', b.id))}
            onText={(b, text) => run(() => supabase.from('notes').update({ text }).eq('id', b.id))}
            onDelete={async b => {
              const n = notes.find(x => x.id === b.id);
              if (!n || !(await run(() => supabase.from('notes').delete().eq('id', b.id)))) return;
              offerUndo(toast, '참고사항을 지웠어요', () => run(() => supabase.from('notes').insert({ scope: n.scope, period_key: n.period_key, start_index: n.start_index, end_index: n.end_index, text: n.text })));
            }}
          />
          {cols.flatMap((g, ci) =>
            [-1, 0, 1, 2, 3, 4, 5, 6].map(row => {
              const key = `${week}:${g.id}:${row}`;
              return (
                <StackCell
                  key={key}
                  gridRow={row + 4}
                  col={ci + 3}
                  goal={g}
                  tone={toneOf(g)}
                  items={cellItems(g.id, row)}
                  locked={row === -1 ? lockedDays === 7 : row < lockedDays}
                  labels={labels}
                  multi={row === -1}
                  subName={sid => subName(g.id, sid)}
                  isOut={p => outside(ups, p.goal_id, p.subgoal_id)}
                  expanded={!!open[key]}
                  setExpanded={v => setOpen(o => ({ ...o, [key]: v }))}
                  sel={sel}
                  setSel={setSel}
                  popOn={pop?.goalId === g.id && pop.row === row}
                  label={`${g.name} ${row === -1 ? '이번 주' : labels[row] + '요일'}`}
                  onAdd={anchor => { setSel(null); setPop({ goalId: g.id, row, anchor, sub: null, name: '', days: row === -1 ? [] : [row], time: { on: false, start: '19:00', end: '20:00' } }); }}
                  onDelete={removePractice}
                />
              );
            }),
          )}
        </TableFrame>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
        요일을 하나 고르면 그 요일 칸에, 여러 개 고르면 '이번 주' 줄에 모여요. 실천은 고른 요일마다 모바일 할 일이 돼요. 요일 하나짜리는 못 하면 다음 날로 넘어가고, 여러 요일(↻)은 그날만 해요.
      </p>
      {pop && popGoal && (
        <Popover anchor={pop.anchor} width={300} height={680} onClose={() => setPop(null)}>
          <PracticeForm
            goal={popGoal}
            tone={toneOf(popGoal)}
            subs={subsOf(popGoal.id)}
            highlight={(() => { const u = upper(popGoal.id); return u ? cellSubs(u) : null; })()}
            upperOn={ups.length > 0}
            upperName={`월간 계획의 ${index + 1}주차`}
            when={pop.row === -1 ? '이번 주' : `${labels[pop.row]} ${md(days[pop.row])}`}
            labels={labels}
            lockedDays={lockedDays}
            pop={pop}
            setPop={setPop}
            onSubmit={submit}
          />
        </Popover>
      )}
    </div>
  );
}

function StackCell({ gridRow, col, tone, items, locked, labels, multi, subName, isOut, expanded, setExpanded, sel, setSel, popOn, label, onAdd, onDelete }: {
  gridRow: number;
  col: number;
  goal: Goal;
  tone: Tone;
  items: { p: Practice; pos: number[]; locked: boolean }[];
  /** 지난 날 칸: 실천 추가 불가 */
  locked: boolean;
  labels: string[];
  multi: boolean;
  subName: (sid: string) => string;
  isOut: (p: Practice) => boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  sel: string | null;
  setSel: (id: string | null) => void;
  popOn: boolean;
  label: string;
  onAdd: (anchor: DOMRect) => void;
  onDelete: (p: Practice) => void;
}) {
  const n = items.length;
  const shown = expanded || n <= MAX_SHOWN ? items : items.slice(0, MAX_SHOWN);
  return (
    <div
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      aria-label={locked ? undefined : label + '에 실천 추가'}
      title={locked ? '지난 날은 수정할 수 없어요' : undefined}
      data-testid="week-cell"
      data-cell={label}
      data-locked={locked || undefined}
      className={locked ? (n ? '' : 'plan-locked') : 'plan-stack'}
      onClick={e => !locked && onAdd(e.currentTarget.getBoundingClientRect())}
      onKeyDown={e => !locked && e.target === e.currentTarget && e.key === 'Enter' && onAdd(e.currentTarget.getBoundingClientRect())}
      style={{ gridRow, gridColumn: col, minWidth: 0, background: n ? tone.bg : locked ? undefined : 'var(--color-neutral-100)', border: '2px dashed ' + (popOn ? 'var(--color-accent)' : 'transparent'), borderRadius: 16, padding: 5, display: 'flex', flexDirection: 'column', gap: 4, cursor: locked ? 'default' : 'pointer', boxSizing: 'border-box', opacity: locked && n ? 0.8 : 1 }}
    >
      {shown.map(({ p, pos, locked: pLocked }) => {
        const selected = !pLocked && sel === p.id;
        return (
          <div
            key={p.id}
            data-sel={p.id}
            data-testid="practice"
            title={pLocked ? '지난 날이 들어간 실천은 지울 수 없어요' : undefined}
            onClick={e => { e.stopPropagation(); if (!pLocked) setSel(selected ? null : p.id); }}
            style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, minWidth: 0, background: 'var(--color-neutral-100)', borderRadius: 10, padding: '4px 6px', fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: 'var(--color-text)', outline: selected ? '2px solid var(--color-accent)' : '0 solid transparent', outlineOffset: 1, cursor: 'default' }}
          >
            <Chip tone={tone}>{subName(p.subgoal_id)}</Chip>
            {isOut(p) && <OutTag />}
            <span style={{ flex: '1 1 64px', minWidth: 0, textWrap: 'pretty' }}>{p.name}</span>
            {p.start_time && <span data-testid="practice-time" style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: tone.ink, whiteSpace: 'nowrap' }}>{p.start_time.slice(0, 5)}–{p.end_time?.slice(0, 5)}</span>}
            <span style={{ flex: 'none', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              {p.kind === 'repeat' && <span title="반복" aria-label="반복" style={{ color: tone.ink, display: 'flex' }}><Svg d={ICONS.repeat} size={12} /></span>}
              {multi && <span data-testid="practice-days" style={{ fontSize: 11, fontWeight: 700, color: tone.ink, whiteSpace: 'nowrap' }}>{fmtDays(pos, labels)}</span>}
              {selected && (
                <button title="실천 삭제" aria-label={p.name + ' 삭제'} onClick={e => { e.stopPropagation(); onDelete(p); }} style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', border: 0, background: 'transparent', color: 'var(--color-accent-700)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                  <Svg d={ICONS.x} size={10} />
                </button>
              )}
            </span>
          </div>
        );
      })}
      {n > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {n > MAX_SHOWN && (
            <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 700, color: tone.ink, padding: '2px 4px' }}>
              {expanded ? '접기' : `+${n - MAX_SHOWN}개 더`}
            </button>
          )}
          {/* 실천이 있는 칸에 하나 더 넣기 (마우스를 올리면 보임) */}
          {!locked && <button className="stack-add" aria-label={label + '에 실천 하나 더'} onClick={e => { e.stopPropagation(); onAdd(e.currentTarget.parentElement!.parentElement!.getBoundingClientRect()); }} style={{ marginLeft: 'auto', border: '2px dashed ' + tone.dot, background: 'transparent', borderRadius: 10, cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 700, color: tone.ink, padding: '1px 8px' }}>
            + 실천
          </button>}
        </div>
      )}
    </div>
  );
}

// R-P7: 세부목표 → 이름 → 요일 칩(복수). 요일 칸에서 열면 그 요일이 미리 골라져 있다. 단발/반복은 요일 수로 정해진다(기획 결정)
function PracticeForm({ goal, tone, subs, highlight, upperOn, upperName, when, labels, lockedDays, pop, setPop, onSubmit }: {
  goal: Goal;
  tone: Tone;
  subs: { id: string; name: string }[];
  highlight?: string[] | null;
  upperOn: boolean;
  upperName: string;
  when: string;
  labels: string[];
  /** 앞에서부터 이만큼은 지난 날 → 고를 수 없음 */
  lockedDays: number;
  pop: Pop;
  setPop: (p: Pop) => void;
  onSubmit: () => void;
}) {
  const ds = pop.days;
  const dayStart = useAccount().profile?.day_start_hour ?? 5;
  const dayHint = ds.length === 0 ? '요일을 하나 이상 골라 주세요.' : ds.length === 1 ? `${labels[ds[0]]}요일 칸에 들어가요. 못 하면 다음 날로 넘어가요.` : `'이번 주' 줄에 들어가요 · ${fmtDays(ds, labels)}마다 할 일이 돼요.`;
  return (
    <>
      <PopHead dot={tone.dot} title={`${goal.name} · ${when}`} hint="세부목표를 고르고 실천을 적어요" />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)', padding: '2px 12px 4px' }}>1. 세부목표</span>
      {subs.length === 0 ? (
        <span style={{ fontSize: 13, padding: '4px 10px 8px' }}>이 목표에 세부목표가 없어요. <Link to="/board">꿈 보드에서 추가하기</Link></span>
      ) : (
        <SubgoalPicker subs={subs} highlight={highlight} badge="이번 주 계획" upperOn={upperOn} upperName={upperName} selected={pop.sub} tone={tone} onPick={id => setPop({ ...pop, sub: id })} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 6px 4px' }}>
        <div className="field">
          <label htmlFor="practice-name">2. 실천 이름</label>
          <input id="practice-name" className="input" maxLength={40} value={pop.name} onChange={e => setPop({ ...pop, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && onSubmit()} placeholder="예: 매일 단어 40개" />
        </div>
        <div className="field">
          <label>3. 요일</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {labels.map((k, i) => {
              const on = ds.includes(i);
              const past = i < lockedDays;
              return (
                <button key={i} type="button" aria-pressed={on} aria-label={k + '요일'} disabled={past} title={past ? '지난 날은 고를 수 없어요' : undefined} onClick={() => setPop({ ...pop, days: on ? ds.filter(x => x !== i) : [...ds, i] })} style={{ flex: 1, height: 34, padding: 0, borderRadius: 999, border: 0, cursor: past ? 'not-allowed' : 'pointer', opacity: past ? 0.35 : 1, font: 'inherit', fontSize: 13, fontWeight: 700, background: on ? tone.ink : 'var(--color-neutral-200)', color: on ? 'var(--color-neutral-100)' : 'var(--color-text)' }}>{k}</button>
              );
            })}
          </div>
          <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--color-neutral-700)' }}>{dayHint}</span>
        </div>
        <TimeToggle value={pop.time} onChange={time => setPop({ ...pop, time })} label="4. 시간 (선택)" sub="고른 요일마다 휴대폰 시간표에 놓이고 알람이 울려요" />
        <button className="btn btn-primary" disabled={!(pop.sub && pop.name.trim() && ds.length) || badTime(pop.time, dayStart)} onClick={onSubmit}>실천 추가</button>
      </div>
    </>
  );
}
