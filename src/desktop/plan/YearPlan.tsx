import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday } from '../../account/AccountProvider';
import { MergeColumn, type MBlock } from './MergeColumn';
import { ColumnHeader, LockNote, NoColumns, PlanHeader, PopHead, Popover, RowLabel, SubgoalPicker, TableFrame, useSelection, useTableGoals } from './shared';

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (y: number, m0: number) => `${y}-${pad(m0 + 1)}-01`;

// 연간 계획: 1~12월 달력 연도 (기획 결정). 칸 = 세부목표 + 짧은 메모, 병합으로 기간 (R-P2)
export default function YearPlan() {
  const { yearCells, run, create } = useAccount();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const thisYear = Number(today.slice(0, 4));
  const year = Number(params.get('y')) || thisYear;
  // 이 해에 계획이 있는 목표는 숨겼어도 열로
  const planned = new Set(yearCells.filter(c => c.start_month.startsWith(String(year))).map(c => c.goal_id));
  const { cols, toneOf, catOf, subsOf, pinned } = useTableGoals(planned);
  const [sel, setSel] = useSelection();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pop, setPop] = useState<{ goalId: string; row: number; anchor: DOMRect } | null>(null);

  const go = (y: number) => { setSel(null); setParams(y === thisYear ? {} : { y: String(y) }); };
  const blocksOf = (goalId: string): MBlock[] =>
    yearCells
      .filter(c => c.goal_id === goalId && c.start_month.startsWith(String(year)))
      .map(c => ({ id: c.id, start: Number(c.start_month.slice(5, 7)) - 1, end: Number(c.end_month.slice(5, 7)) - 1, chip: subsOf(goalId).find(s => s.id === c.subgoal_id)?.name ?? '', text: c.memo }));

  const place = async (goalId: string, row: number, subgoalId: string) => {
    setPop(null);
    const id = await create(() => supabase.from('year_cells').insert({ goal_id: goalId, subgoal_id: subgoalId, start_month: monthKey(year, row), end_month: monthKey(year, row) }).select('id').single());
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
              onEmpty={(row, anchor) => { setSel(null); setPop({ goalId: g.id, row, anchor }); }}
              onRange={(b, start, end) => run(() => supabase.from('year_cells').update({ start_month: monthKey(year, start), end_month: monthKey(year, end) }).eq('id', b.id))}
              onText={(b, memo) => run(() => supabase.from('year_cells').update({ memo }).eq('id', b.id))}
              onDelete={b => run(() => supabase.from('year_cells').delete().eq('id', b.id))}
            />
          ))}
        </TableFrame>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
        빈 칸을 누르면 그 목표의 세부목표를 골라 넣고 메모를 적어요. 여러 달에 걸치면 칸을 선택한 뒤 ↓로 늘리고, ⠿를 끌어 같은 열의 다른 달로 옮길 수 있어요.
      </p>
      {pop && popGoal && (
        <Popover anchor={pop.anchor} width={260} height={300} onClose={() => setPop(null)}>
          <PopHead dot={toneOf(popGoal).dot} title={`${popGoal.name} · ${pop.row + 1}월`} hint="세부목표를 골라 넣고 메모를 적어요" />
          <SubgoalPicker subs={subsOf(popGoal.id)} badge="" tone={toneOf(popGoal)} onPick={sid => place(popGoal.id, pop.row, sid)} />
        </Popover>
      )}
    </div>
  );
}
