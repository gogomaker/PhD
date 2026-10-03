import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday } from '../../account/AccountProvider';
import { addDays, isYearMonth } from '../../lib/day';
import { addMonths, md, monthOfWeek, monthWeeks, outside, weekLocked, weekStartOf, WEEK_START } from '../../lib/plan';
import { MergeColumn, type MBlock } from './MergeColumn';
import { offerUndo } from './undo';
import { ColumnHeader, LockNote, NOTE, NoColumns, PlanHeader, PopHead, Popover, RefRow, RowLabel, SubgoalPicker, TableFrame, useSelection, useTableGoals, type RefCell } from './shared';

// 월간 계획: 행 = 그 달의 주차. 연간의 이번 달 칸이 상위 계획 줄로 내려온다 (R-P3). 여기서 바꿔도 연간은 그대로 (R-P4)
export default function MonthPlan() {
  const { yearCells, monthCells, notes, run, create, toast } = useAccount();
  const today = useToday();
  const ws = WEEK_START;
  const [params, setParams] = useSearchParams();
  const thisYm = monthOfWeek(weekStartOf(today, ws)).ym;
  const asked = params.get('m');
  const ym = isYearMonth(asked) ? asked : thisYm;
  const ymKey = ym + '-01';
  const weeks = monthWeeks(ym, ws);
  const todayWeek = weeks.indexOf(weekStartOf(today, ws));
  // R-P12: 지난주는 잠금
  const lockedBefore = weeks.filter(w => weekLocked(w, today)).length;
  // 이 달에 계획이 있는 목표는 숨겼어도 열로
  const planned = new Set(monthCells.filter(c => c.year_month === ymKey).map(c => c.goal_id));
  const { cols, toneOf, catOf, subsOf, pinned } = useTableGoals(planned);
  // R-P14: 이 달의 연간 계획 (어느 목표든)
  const ups = yearCells.filter(c => c.start_month <= ymKey && ymKey <= c.end_month).map(c => ({ goalId: c.goal_id, subId: c.subgoal_id }));
  const [sel, setSel] = useSelection();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pop, setPop] = useState<{ goalId: string; row: number; end: number; anchor: DOMRect } | null>(null);
  const [y, m] = ym.split('-').map(Number);

  const go = (next: string) => { setSel(null); setParams(next === thisYm ? {} : { m: next }); };
  const subName = (goalId: string, sid: string) => subsOf(goalId).find(s => s.id === sid)?.name ?? '';
  // 연간 표에서 이번 달을 덮는 칸
  const upper = (goalId: string) => yearCells.find(c => c.goal_id === goalId && c.start_month <= ymKey && ymKey <= c.end_month);

  const goalBlocks = (goalId: string): MBlock[] =>
    monthCells.filter(c => c.goal_id === goalId && c.year_month === ymKey).map(c => ({ id: c.id, start: c.start_week, end: c.end_week, chip: subName(goalId, c.subgoal_id), text: c.comment, out: outside(ups, goalId, c.subgoal_id) }));
  const noteBlocks: MBlock[] = notes.filter(n => n.scope === 'month' && n.period_key === ymKey).map(n => ({ id: n.id, start: n.start_index, end: n.end_index, text: n.text }));

  const place = async (goalId: string, row: number, end: number, subgoalId: string) => {
    setPop(null);
    const id = await create(() => supabase.from('month_cells').insert({ goal_id: goalId, subgoal_id: subgoalId, year_month: ymKey, start_week: row, end_week: end }).select('id').single());
    if (id) { setSel(id); setFocusId(id); }
  };
  const addNote = async (row: number, end = row) => {
    const id = await create(() => supabase.from('notes').insert({ scope: 'month', period_key: ymKey, start_index: row, end_index: end }).select('id').single());
    if (id) { setSel(id); setFocusId(id); }
  };

  const refs: RefCell[] = [{ col: 2, empty: true }, ...cols.map((g, i): RefCell => {
    const u = upper(g.id);
    return u ? { col: i + 3, chip: subName(g.id, u.subgoal_id), text: u.memo, tone: toneOf(g) } : { col: i + 3, empty: true };
  })];
  const popGoal = pop && cols.find(g => g.id === pop.goalId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PlanHeader
        kicker="월간 계획"
        title={`${y}년 ${m}월`}
        sub={`연간 계획의 ${m}월 칸을 참고해, 이번 달 사정에 맞게 세부목표를 주차별로 다시 나눠요. 바꾼 이유는 코멘트로 남겨요.`}
        onPrev={() => go(addMonths(ym, -1))}
        onNext={() => go(addMonths(ym, 1))}
        prevLabel="지난달"
        nextLabel="다음 달"
        onToday={ym !== thisYm ? () => go(thisYm) : undefined}
        todayLabel="이번 달"
      />
      {cols.length > 0 && lockedBefore > 0 && <LockNote all={lockedBefore === weeks.length} />}
      {cols.length === 0 ? (
        <NoColumns />
      ) : (
        <TableFrame columns={'96px minmax(124px, 1fr) ' + cols.map(() => 'minmax(140px, 1fr)').join(' ')} minWidth={96 + 129 + cols.length * 145} rowHeight={56}>
          <div style={{ gridRow: 1, gridColumn: 1, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>기간</div>
          <ColumnHeader col={2} name="참고사항" sub="모바일로 가지 않는 메모" dot={NOTE.dot} />
          {cols.map((g, i) => <ColumnHeader key={g.id} col={i + 3} name={g.name} sub={catOf(g)?.name ?? ''} dot={toneOf(g).dot} goalId={g.id} pinned={pinned(g)} />)}
          <RefRow label={`연간 · ${m}월`} cells={refs} emptyText="연간 표의 이번 달 칸이 여기로 내려와요" lastCol={cols.length + 2} />
          {weeks.map((w, i) => <RowLabel key={w} row={i + 3} label={`${i + 1}주차`} sub={`${md(w)} – ${md(addDays(w, 6))}`} today={i === todayWeek} />)}
          <MergeColumn
            col={2}
            firstRow={3}
            rowCount={weeks.length}
            lockedBefore={lockedBefore}
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
          {cols.map((g, i) => (
            <MergeColumn
              key={g.id}
              col={i + 3}
              firstRow={3}
              rowCount={weeks.length}
              lockedBefore={lockedBefore}
              label={g.name}
              blocks={goalBlocks(g.id)}
              tone={toneOf(g)}
              placeholder="코멘트"
              sel={sel}
              setSel={setSel}
              focusId={focusId}
              popRow={pop?.goalId === g.id ? pop.row : null}
              popEnd={pop?.goalId === g.id ? pop.end : null}
              onEmpty={(row, anchor, end) => { setSel(null); setPop({ goalId: g.id, row, end, anchor }); }}
              onRange={(b, s, e) => run(() => supabase.from('month_cells').update({ start_week: s, end_week: e }).eq('id', b.id))}
              onText={(b, comment) => run(() => supabase.from('month_cells').update({ comment }).eq('id', b.id))}
              onDelete={async b => {
                const c = monthCells.find(x => x.id === b.id);
                if (!c || !(await run(() => supabase.from('month_cells').delete().eq('id', b.id)))) return;
                offerUndo(toast, '칸을 지웠어요', () => run(() => supabase.from('month_cells').insert({ goal_id: c.goal_id, subgoal_id: c.subgoal_id, year_month: c.year_month, start_week: c.start_week, end_week: c.end_week, comment: c.comment })));
              }}
            />
          ))}
        </TableFrame>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
        빈 칸을 누르면 그 목표의 세부목표를 골라 넣고 코멘트를 적어요. 연간 계획에서 이번 달에 배치한 세부목표를 먼저 골라요. 그 밖의 세부목표는 '계획 밖'으로 표시돼요. 여기서 바꾼 내용은 연간 계획에 반영되지 않아요.
      </p>
      {pop && popGoal && (
        <Popover anchor={pop.anchor} width={260} height={300} onClose={() => setPop(null)}>
          <PopHead dot={toneOf(popGoal).dot} title={`${popGoal.name} · ${pop.row + 1}주차${pop.end > pop.row ? `–${pop.end + 1}주차` : ''}`} hint="세부목표를 골라 넣고 코멘트를 적어요" />
          <SubgoalPicker subs={subsOf(popGoal.id)} highlight={upper(popGoal.id)?.subgoal_id} badge="이번 달 계획" upperOn={ups.length > 0} upperName={`연간 계획의 ${m}월`} tone={toneOf(popGoal)} onPick={sid => place(popGoal.id, pop.row, pop.end, sid)} />
        </Popover>
      )}
    </div>
  );
}

