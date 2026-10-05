import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday } from '../../account/AccountProvider';
import { isYearKey } from '../../lib/day';
import { cellSubs, subsRow } from '../../lib/plan';
import { MergeColumn, type MBlock } from './MergeColumn';
import { offerUndo } from './undo';
import { ColumnHeader, LockNote, NoColumns, PlanHeader, PopHead, Popover, RowLabel, SubgoalPicker, TableFrame, useSelection, useTableGoals } from './shared';

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (y: number, m0: number) => `${y}-${pad(m0 + 1)}-01`;

// 연간 계획: 1~12월 달력 연도 (기획 결정). 칸 = 세부목표 + 짧은 메모, 병합으로 기간 (R-P2)
export default function YearPlan() {
  const { yearCells, run, create, toast } = useAccount();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const thisYear = Number(today.slice(0, 4));
  const asked = params.get('y');
  const year = isYearKey(asked) ? Number(asked) : thisYear;
  // 이 해에 계획이 있는 목표는 숨겼어도 열로
  const planned = new Set(yearCells.filter(c => c.start_month.startsWith(String(year))).map(c => c.goal_id));
  const { cols, toneOf, catOf, subsOf, pinned } = useTableGoals(planned);
  const [sel, setSel] = useSelection();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pop, setPop] = useState<{ goalId: string; row: number; end: number; anchor: DOMRect } | null>(null);
  // 칸에 세부목표 더하기 (2026-10-05)
  const [subPop, setSubPop] = useState<{ cellId: string; goalId: string; anchor: DOMRect } | null>(null);

  const go = (y: number) => { setSel(null); setParams(y === thisYear ? {} : { y: String(y) }); };
  const blocksOf = (goalId: string): MBlock[] =>
    yearCells
      .filter(c => c.goal_id === goalId && c.start_month.startsWith(String(year)))
      .map(c => {
        const ids = cellSubs(c);
        return { id: c.id, start: Number(c.start_month.slice(5, 7)) - 1, end: Number(c.end_month.slice(5, 7)) - 1, subs: ids.map(sid => ({ id: sid, name: subsOf(goalId).find(s => s.id === sid)?.name ?? '' })), more: subsOf(goalId).some(s => !ids.includes(s.id)), text: c.memo };
      });
  const setSubs = (cellId: string, ids: string[]) => run(() => supabase.from('year_cells').update(subsRow(ids)).eq('id', cellId));
  const subCell = subPop && yearCells.find(c => c.id === subPop.cellId);

  const place = async (goalId: string, row: number, end: number, subgoalId: string) => {
    setPop(null);
    const id = await create(() => supabase.from('year_cells').insert({ goal_id: goalId, subgoal_id: subgoalId, start_month: monthKey(year, row), end_month: monthKey(year, end) }).select('id').single());
    if (id) { setSel(id); setFocusId(id); }
  };

  const popGoal = pop && cols.find(g => g.id === pop.goalId);
  const curMonth = Number(today.slice(5, 7)) - 1;
  // R-P12: 지난달은 잠금
  const lockedBefore = year < thisYear ? 12 : year === thisYear ? curMonth : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PlanHeader
        kicker="연간 계획"
        title={`${year}년`}
        sub="목표마다 어느 달에 어떤 세부목표를 할지 크게 배치해요. 여기서 정한 배치는 처음 계획으로 남아요."
        onPrev={() => go(year - 1)}
        onNext={() => go(year + 1)}
        prevLabel="지난해"
        nextLabel="다음 해"
        onToday={year !== thisYear ? () => go(thisYear) : undefined}
        todayLabel="올해"
      />
      {cols.length > 0 && lockedBefore > 0 && <LockNote all={lockedBefore === 12} />}
      {cols.length === 0 ? (
        <NoColumns />
      ) : (
        <TableFrame columns={'96px ' + cols.map(() => 'minmax(140px, 1fr)').join(' ')} minWidth={96 + cols.length * 145} rowHeight={56}>
          <div style={{ gridRow: 1, gridColumn: 1, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>기간</div>
          {cols.map((g, i) => <ColumnHeader key={g.id} col={i + 2} name={g.name} sub={catOf(g)?.name ?? ''} dot={toneOf(g).dot} goalId={g.id} pinned={pinned(g)} />)}
          {Array.from({ length: 12 }, (_, m) => <RowLabel key={m} row={m + 2} label={`${m + 1}월`} sub={String(year)} today={year === thisYear && m === curMonth} />)}
          {cols.map((g, i) => (
            <MergeColumn
              key={g.id}
              col={i + 2}
              firstRow={2}
              rowCount={12}
              lockedBefore={lockedBefore}
              label={g.name}
              blocks={blocksOf(g.id)}
              tone={toneOf(g)}
              placeholder="메모"
              sel={sel}
              setSel={setSel}
              focusId={focusId}
              popRow={pop?.goalId === g.id ? pop.row : null}
              popEnd={pop?.goalId === g.id ? pop.end : null}
              onEmpty={(row, anchor, end) => { setSel(null); setPop({ goalId: g.id, row, end, anchor }); }}
              onRange={(b, start, end) => run(() => supabase.from('year_cells').update({ start_month: monthKey(year, start), end_month: monthKey(year, end) }).eq('id', b.id))}
              onText={(b, memo) => run(() => supabase.from('year_cells').update({ memo }).eq('id', b.id))}
              onSubAdd={(b, anchor) => setSubPop({ cellId: b.id, goalId: g.id, anchor })}
              onSubRemove={(b, sid) => { const c = yearCells.find(x => x.id === b.id); if (c) setSubs(c.id, cellSubs(c).filter(x => x !== sid)); }}
              onDelete={async b => {
                const c = yearCells.find(x => x.id === b.id);
                if (!c || !(await run(() => supabase.from('year_cells').delete().eq('id', b.id)))) return;
                offerUndo(toast, '칸을 지웠어요', () => run(() => supabase.from('year_cells').insert({ goal_id: c.goal_id, ...subsRow(cellSubs(c)), start_month: c.start_month, end_month: c.end_month, memo: c.memo })));
              }}
            />
          ))}
        </TableFrame>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
        빈 칸을 누르거나 여러 칸을 끌어 고르면 그 목표의 세부목표를 넣고 메모를 적어요. 칸을 고른 뒤 '+ 세부목표'로 함께 할 세부목표를 더하고, ↓로 늘리고, ⠿를 끌어 옮기고, Delete로 지울 수 있어요(Ctrl+Z로 되돌리기).
      </p>
      {pop && popGoal && (
        <Popover anchor={pop.anchor} width={260} height={300} onClose={() => setPop(null)}>
          <PopHead dot={toneOf(popGoal).dot} title={`${popGoal.name} · ${pop.row + 1}월${pop.end > pop.row ? `–${pop.end + 1}월` : ''}`} hint="세부목표를 골라 넣고 메모를 적어요" />
          <SubgoalPicker subs={subsOf(popGoal.id)} badge="" tone={toneOf(popGoal)} onPick={sid => place(popGoal.id, pop.row, pop.end, sid)} />
        </Popover>
      )}
      {subPop && subCell && (() => {
        const g = cols.find(x => x.id === subPop.goalId);
        if (!g) return null;
        const s = Number(subCell.start_month.slice(5, 7)), e = Number(subCell.end_month.slice(5, 7));
        return (
          <Popover anchor={subPop.anchor} width={260} height={300} onClose={() => setSubPop(null)}>
            <PopHead dot={toneOf(g).dot} title={`${g.name} · ${s}월${e > s ? `–${e}월` : ''}`} hint="이 칸에 함께 할 세부목표를 더해요" />
            <SubgoalPicker subs={subsOf(g.id).filter(x => !cellSubs(subCell).includes(x.id))} badge="" tone={toneOf(g)} onPick={sid => { setSubPop(null); setSubs(subCell.id, [...cellSubs(subCell), sid]); }} />
          </Popover>
        );
      })()}
    </div>
  );
}
