// 지난주 실천 가져오기 (2026-10-06 기획 결정) — 휴대폰 일정(주간)과 PC 주간 계획에서 같이 쓴다
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAccount, useToday } from '../../account/AccountProvider';
import { isClosed } from '../../lib/goals';
import { addDays, type DayKey } from '../../lib/day';
import { dayLocked, isoDow, md, weekDays } from '../../lib/plan';
import { dayLabel } from '../../lib/day';
import { copyDays, copyRow, prevWeekItems, type CopyItem } from '../../lib/copyWeek';
import { Dialog, PILL_STYLE } from '../../ui/Dialog';
import { BODY, Dot, Sheet, SheetHead } from '../ui';
import { useOpenGoals } from './planSheets';
import { ensurePush } from '../push';

/** 이 주(week)에 가져올 수 있는 앞 주의 실천 */
export function useCopyPrevWeek(week: DayKey) {
  const { practices, goals } = useAccount();
  const today = useToday();
  return useMemo(() => prevWeekItems(practices, week, today, id => { const g = goals.find(x => x.id === id); return !!g && !isClosed(g); }), [practices, goals, week, today]);
}

function useCopy(week: DayKey, items: CopyItem[], onDone: () => void) {
  const { run, toast } = useAccount();
  const [off, setOff] = useState<Set<string>>(new Set());
  // 요일은 가져오면서 고칠 수 있다 — 주 중간에 넣어 '수–토'였던 것을 다음 주엔 '매일'로 (2026-10-06)
  const [days, setDays] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const daysOf = (x: CopyItem) => days[x.src.id] ?? x.weekdays;
  const chosen = items.filter(x => !off.has(x.src.id) && daysOf(x).length > 0);
  const toggle = (id: string) => setOff(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleDay = (x: CopyItem, w: number) => { const cur = daysOf(x); setDays(d => ({ ...d, [x.src.id]: cur.includes(w) ? cur.filter(y => y !== w) : [...cur, w] })); };
  const submit = async () => {
    if (busy || !chosen.length) return;
    setBusy(true);
    if (chosen.some(x => x.src.start_time)) ensurePush(); // 시간 있는 실천은 알람 — 처음 한 번 허락
    const ok = await run(() => supabase.from('practices').insert(chosen.map(x => copyRow(x, week, daysOf(x)))));
    setBusy(false);
    if (ok) { toast(`지난주 실천 ${chosen.length}개를 가져왔어요`); onDone(); }
  };
  return { off, toggle, daysOf, toggleDay, chosen, busy, submit };
}

type C = ReturnType<typeof useCopy>;
function CopyList({ week, items, c }: { week: DayKey; items: CopyItem[]; c: C }) {
  const { goals, subgoals } = useAccount();
  const { toneOf } = useOpenGoals();
  const today = useToday();
  const wd = weekDays(week);
  return (
    <div data-testid="copy-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(x => {
        const g = goals.find(y => y.id === x.src.goal_id);
        const tone = g ? toneOf(g) : null;
        const sel = c.daysOf(x);
        const on = !c.off.has(x.src.id) && sel.length > 0;
        const time = x.src.start_time ? ` · ${x.src.start_time.slice(0, 5)}–${x.src.end_time?.slice(0, 5)}` : '';
        return (
          <div key={x.src.id} data-testid="copy-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 16, background: on && tone ? tone.bg : 'var(--color-surface)', cursor: 'pointer', opacity: on ? 1 : 0.6 }}>
            <input type="checkbox" checked={on} onChange={() => c.toggle(x.src.id)} aria-label={x.src.name} style={{ width: 18, height: 18, flex: 'none', marginTop: 2, accentColor: tone?.dot }} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tone?.ink ?? 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {tone && <Dot color={tone.dot} size={6} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g?.name} · {subgoals.find(s => s.id === x.src.subgoal_id)?.name}</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{x.src.name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
                {sel.length ? copyDays(week, sel) : '요일을 골라 주세요'}{time}
                {x.trimmed && <span data-testid="copy-trimmed"> · 지난 요일({copyDays(addDays(week, -7), x.src.weekdays.filter(w => !x.weekdays.includes(w)))})은 빼요</span>}
              </span>
              <span role="group" aria-label={x.src.name + ' 요일'} style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {wd.map(d => {
                  const w = isoDow(d);
                  const past = dayLocked(d, today);
                  const dOn = sel.includes(w);
                  return (
                    <button key={d} type="button" aria-pressed={dOn} aria-label={dayLabel(d).dow + '요일'} disabled={past} title={past ? '지난 날은 고를 수 없어요' : undefined} onClick={() => c.toggleDay(x, w)} style={{ flex: 1, minWidth: 0, height: 30, padding: 0, border: 0, borderRadius: 999, cursor: past ? 'not-allowed' : 'pointer', ...BODY, fontSize: 12, background: dOn ? tone?.ink ?? 'var(--color-text)' : 'var(--color-bg)', color: dOn ? 'var(--color-bg)' : 'var(--color-text)', opacity: past ? 0.35 : 1 }}>{dayLabel(d).dow}</button>
                  );
                })}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const sub = (week: DayKey) => `${md(addDays(week, -7))} 주 → ${md(week)} 주. 고른 것만 넣어요. 요일은 여기서 고칠 수 있어요.`;

/** 휴대폰: 아래에서 올라오는 시트 */
export function CopyWeekSheet({ week, items, onClose }: { week: DayKey; items: CopyItem[]; onClose: () => void }) {
  const c = useCopy(week, items, onClose);
  return (
    <Sheet onClose={onClose} label="지난주 실천 가져오기">
      <SheetHead title="지난주 실천 가져오기" sub={sub(week)} />
      <CopyList week={week} items={items} c={c} />
      <button className="btn btn-primary" onClick={c.submit} disabled={c.busy || !c.chosen.length} style={{ flex: 'none', height: 46, ...BODY }}>{c.chosen.length}개 가져오기</button>
    </Sheet>
  );
}

/** PC: 가운데 상자 */
export function CopyWeekDialog({ week, items, onClose }: { week: DayKey; items: CopyItem[]; onClose: () => void }) {
  const c = useCopy(week, items, onClose);
  return (
    <Dialog title="지난주 실천 가져오기" onClose={onClose}>
      <p className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>{sub(week)}</p>
      <div style={{ maxHeight: '50vh', overflowY: 'auto' }}><CopyList week={week} items={items} c={c} /></div>
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose} style={PILL_STYLE}>취소</button>
        <button className="btn btn-primary" onClick={c.submit} disabled={c.busy || !c.chosen.length}>{c.chosen.length}개 가져오기</button>
      </div>
    </Dialog>
  );
}
