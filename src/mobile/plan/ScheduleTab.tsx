// 계획 › 일정: 연간(줄 = 달) · 월간(줄 = 주) · 주간(줄 = 여러 요일 + 요일). 목표 필터, 상위 계획 참고(R-P3), 지난 기간 잠금(R-P12)
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useSwipe } from '../useSwipe';
import { byTime } from '../../lib/today';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount, useToday, type MonthCell, type Note, type Practice, type YearCell } from '../../account/AccountProvider';
import { addDays, dayLabel, isDayKey, isYearKey, isYearMonth, type DayKey } from '../../lib/day';
import { addMonths, fmtDays, md, monthOfWeek, monthWeeks, practiceDates, weekDays, weekStartOf, ymOf } from '../../lib/plan';

const slotsOf = (zoom: Zoom, key: string, today: string) => unitsOf(zoom, key, today);
import { NOTE, type Tone } from '../../desktop/plan/shared';
import { ScrollArea } from '../../ui/ScrollArea';
import { BODY, Dot, ICON, Notice, Seg, Svg, chip } from '../ui';
import { AddPlanSheet, EditCellSheet, EditNoteSheet, PracticeSheet, outside, useOpenGoals, useUpper, type Zoom } from './planSheets';
import { unitsOf } from './units';

const ZOOMS: [Zoom, string][] = [['year', '연간'], ['month', '월간'], ['week', '주간']];

type Item = { id: string; tone: Tone; meta: string; name: string; span?: string; onTap: () => void; cont?: boolean; out?: boolean };
type Row = { key: string; label: string; sub?: string; now?: boolean; past?: boolean; notes: { id: string; text: string; onTap: () => void }[]; items: Item[]; onDrill?: () => void; go?: { label: string; primary?: boolean; onTap: () => void } };
type SheetState = null | { k: 'add'; start?: number } | { k: 'year'; cell: YearCell } | { k: 'month'; cell: MonthCell } | { k: 'note'; note: Note } | { k: 'practice'; practice: Practice };

export default function ScheduleTab() {
  const { yearCells, monthCells, notes, practices } = useAccount();
  const today = useToday();
  const loc = useLocation();
  const navigate = useNavigate();
  const { list, toneOf, subsOf, subName } = useOpenGoals();
  const [sheet, setSheet] = useState<SheetState>(null);

  // ── 주소: z = 연간·월간·주간, k = 기간, f = 목표 필터 ──
  const q = new URLSearchParams(loc.search);
  const zoom: Zoom = q.get('z') === 'year' || q.get('z') === 'month' ? (q.get('z') as Zoom) : 'week';
  const thisWeek = weekStartOf(today);
  const thisYm = monthOfWeek(thisWeek).ym;
  const thisYear = today.slice(0, 4);
  const k = q.get('k') ?? '';
  const key = zoom === 'year' ? (isYearKey(k) ? k : thisYear) : zoom === 'month' ? (isYearMonth(k) ? k : thisYm) : isDayKey(k) ? weekStartOf(k) : thisWeek;
  const filter = list.some(g => g.id === q.get('f')) ? q.get('f') : null;
  const set = (z: Zoom, kk: string, f: string | null = filter) => {
    const p = new URLSearchParams();
    if (z !== 'week') p.set('z', z);
    const cur = z === 'year' ? thisYear : z === 'month' ? thisYm : thisWeek;
    if (kk !== cur) p.set('k', kk);
    if (f) p.set('f', f);
    const s = p.toString();
    navigate('/plan/schedule' + (s ? '?' + s : ''), { replace: true });
  };
  // 확대 단계를 바꾸면 보던 기간을 이어서 (주 → 그 주의 달 → 그 해)
  const zoomTo = (z: Zoom) => {
    if (z === zoom) return;
    const anchor: DayKey = zoom === 'week' ? addDays(key, 3) : zoom === 'month' ? (key === thisYm ? today : key + '-01') : key === thisYear ? today : key + '-01-01';
    set(z, z === 'year' ? anchor.slice(0, 4) : z === 'month' ? (zoom === 'week' ? monthOfWeek(key).ym : ymOf(anchor)) : anchor === today ? thisWeek : monthWeeks(ymOf(anchor))[0]);
  };
  // 화면을 좌우로 밀면 이전·다음 기간 (2026-10-03 UT 6)
  const rootRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef<(n: number) => void>(() => {});
  useSwipe(rootRef, useCallback(() => shiftRef.current(-1), []), useCallback(() => shiftRef.current(1), []));
  const shift = (n: number) => set(zoom, zoom === 'year' ? String(Number(key) + n) : zoom === 'month' ? addMonths(key, n) : addDays(key, 7 * n));
  shiftRef.current = shift;
  // 이번 주가 지난달에 속하는 달 초(4번째 날 규칙)에는 달력상 이번 달도 '이번 달'로 본다
  const isCur = zoom === 'month' ? key === thisYm || key === ymOf(today) : key === (zoom === 'year' ? thisYear : thisWeek);
  const shown = (goalId: string) => list.some(g => g.id === goalId) && (!filter || filter === goalId);
  const goalName = (id: string) => list.find(g => g.id === id)?.name ?? '';
  const toneById = (id: string) => { const g = list.find(x => x.id === id); return g ? toneOf(g) : NOTE; };
  const cellItem = (goalId: string, sid: string, text: string, span: string, onTap: () => void): Item => ({
    id: '', tone: toneById(goalId), meta: goalName(goalId) + (text ? ' · ' + subName(sid) : ''), name: text || subName(sid), span, onTap,
  });

  // ── 줄 만들기 ──
  // 여러 기간에 걸친 칸은 걸친 줄마다 보인다 (첫 줄 = 기간 표시, 다음 줄 = '이어짐', 2026-10-03 기획 결정)
  const slots = slotsOf(zoom, key, today);
  const upperOf = useUpper();
  let rows: Row[] = [];
  let title = '';
  let sub = '';
  let upper: { label: string; sub: string; items: Item[] } | null = null;
  let headNote: ReactNode = null;

  if (zoom === 'year') {
    title = `${key}년`;
    sub = '1월 – 12월';
    const cells = yearCells.filter(c => shown(c.goal_id) && c.start_month.startsWith(key));
    rows = slots.map((s, i) => {
      const ym = `${key}-${String(i + 1).padStart(2, '0')}`;
      const mk = ym + '-01';
      // 달 초에 이번 주가 지난달에 속하면, 그 달에서 이번 주 계획을 세울 수 있게 길을 열어 둔다
      const weekHere = ym === thisYm && thisYm !== ymOf(today);
      return {
        key: ym,
        label: s.label,
        now: ym === ymOf(today),
        past: s.locked && !weekHere,
        notes: [],
        items: cells
          .filter(c => c.start_month <= mk && mk <= c.end_month)
          .map(c => {
            const st = Number(c.start_month.slice(5, 7));
            const e = Number(c.end_month.slice(5, 7));
            const cont = st !== i + 1;
            return { ...cellItem(c.goal_id, c.subgoal_id, c.memo, cont ? '이어짐' : e > st ? `${st}월–${e}월` : '', () => setSheet({ k: 'year', cell: c })), id: c.id + ':' + i, cont };
          }),
        onDrill: () => set('month', ym),
        go: ym === ymOf(today) ? { label: '이번 달 펼쳐 보기', onTap: () => set('month', ymOf(today)) } : weekHere ? { label: `이번 주(${Number(thisYm.slice(5))}월 ${monthOfWeek(thisWeek).index + 1}주차) 펼쳐 보기`, onTap: () => set('month', thisYm) } : undefined,
      };
    });
  } else if (zoom === 'month') {
    const [y, m] = key.split('-').map(Number);
    const weeks = monthWeeks(key);
    title = `${y}년 ${m}월`;
    sub = `${weeks.length}주`;
    const mk = key + '-01';
    const cells = monthCells.filter(c => shown(c.goal_id) && c.year_month === mk);
    const mNotes = notes.filter(n => n.scope === 'month' && n.period_key === mk);
    const ups = upperOf('month', key);
    rows = weeks.map((w, i) => ({
      key: w,
      label: `${i + 1}주`,
      sub: `${md(w)}–${md(addDays(w, 6))}`,
      now: w === thisWeek,
      past: slots[i].locked,
      notes: mNotes.filter(n => n.start_index <= i && i <= n.end_index).map(n => ({ id: n.id + ':' + i, text: n.start_index === i ? n.text + (n.end_index > i ? ` ~${n.end_index + 1}주` : '') : n.text + ' · 이어짐', onTap: () => setSheet({ k: 'note', note: n }) })),
      items: cells
        .filter(c => c.start_week <= i && i <= c.end_week)
        .map(c => {
          const cont = c.start_week !== i;
          return { ...cellItem(c.goal_id, c.subgoal_id, c.comment, cont ? '이어짐' : c.end_week > i ? `~${c.end_week + 1}주` : '', () => setSheet({ k: 'month', cell: c })), id: c.id + ':' + i, cont, out: outside(ups, c.goal_id, c.subgoal_id) };
        }),
      onDrill: () => set('week', w),
      go: w === thisWeek ? { label: '이번 주 펼쳐 보기', onTap: () => set('week', thisWeek) } : undefined,
    }));
    // R-P3: 연간 계획에서 이 달에 걸친 칸
    const yc = yearCells.filter(c => shown(c.goal_id) && c.start_month <= mk && mk <= c.end_month);
    if (yc.length) upper = { label: '연간', sub: `${m}월`, items: yc.map(c => ({ ...cellItem(c.goal_id, c.subgoal_id, c.memo, '', () => {}), id: c.id })) };
    // 달 초: 이번 주가 지난달 마지막 주이면 그 달로 가는 길
    if (key === ymOf(today) && thisYm !== key) {
      headNote = (
        <Notice action={<button className="btn btn-secondary" onClick={() => set('month', thisYm)} style={{ height: 36, ...BODY, fontSize: 13 }}>{Number(thisYm.slice(5))}월 보기</button>}>
          이번 주({md(thisWeek)}–{md(addDays(thisWeek, 6))})는 {Number(thisYm.slice(5))}월 {monthOfWeek(thisWeek).index + 1}주차예요. 이번 주 계획은 {Number(thisYm.slice(5))}월에서 세워요.
        </Notice>
      );
    }
  } else {
    const days = weekDays(key);
    const labels = days.map(d => dayLabel(d).dow);
    const { ym, index } = monthOfWeek(key);
    title = `${Number(ym.slice(5))}월 ${index + 1}주차`;
    sub = `${md(key)} – ${md(addDays(key, 6))}`;
    const ups = upperOf('week', key);
    const acts = practices
      .filter(p => p.week_start_date === key && shown(p.goal_id))
      .map(p => ({ p, pos: practiceDates(p.week_start_date, p.weekdays).map(d => days.indexOf(d)).filter(i => i >= 0) }))
      .sort((a, b) => Math.min(...a.pos) - Math.min(...b.pos) || byTime(a.p, b.p) || a.p.created_at.localeCompare(b.p.created_at));
    const actItem = (p: Practice, span: string): Item => ({ id: p.id, tone: toneById(p.goal_id), meta: goalName(p.goal_id) + ' · ' + subName(p.subgoal_id), name: p.name, span: [span, p.start_time ? `${p.start_time.slice(0, 5)}–${p.end_time?.slice(0, 5)}` : ''].filter(Boolean).join(' · '), onTap: () => setSheet({ k: 'practice', practice: p }), out: outside(ups, p.goal_id, p.subgoal_id) });
    const wNotes = notes.filter(n => n.scope === 'week' && n.period_key === key);
    rows = [
      {
        key: 'multi',
        label: '주간',
        sub: '여러 요일',
        past: slots.every(s => s.locked),
        notes: [],
        items: acts.filter(a => a.p.weekdays.length > 1).map(a => actItem(a.p, fmtDays(a.pos, labels))),
      },
      ...days.map((d, i) => ({
        key: d,
        label: labels[i],
        sub: md(d),
        now: d === today,
        past: slots[i].locked,
        notes: wNotes.filter(n => n.start_index <= i && i <= n.end_index).map(n => ({ id: n.id + ':' + i, text: n.start_index === i ? n.text + (n.end_index > i ? ` ~${labels[n.end_index]}` : '') : n.text + ' · 이어짐', onTap: () => setSheet({ k: 'note', note: n }) })),
        items: acts.filter(a => a.p.weekdays.length === 1 && a.pos[0] === i).map(a => actItem(a.p, '')),
        go: d === today ? { label: '오늘 기록하기', primary: true, onTap: () => navigate('/record') } : undefined,
      })),
    ];
    // R-P3: 월간 계획에서 이 주에 걸친 칸 (+ 참고사항)
    const mk = ym + '-01';
    const mc = monthCells.filter(c => shown(c.goal_id) && c.year_month === mk && c.start_week <= index && index <= c.end_week);
    const upNote = notes.find(n => n.scope === 'month' && n.period_key === mk && n.start_index <= index && index <= n.end_index);
    const items = mc.map(c => ({ ...cellItem(c.goal_id, c.subgoal_id, c.comment, '', () => {}), id: c.id }));
    if (upNote?.text) items.unshift({ id: upNote.id, tone: NOTE, meta: '참고사항', name: upNote.text, onTap: () => {} });
    if (items.length) upper = { label: '월간', sub: `${index + 1}주차`, items };
  }

  const noSubs = list.length > 0 && list.every(g => subsOf(g.id).length === 0);
  const firstGoal = list[0];
  const weekEmpty = zoom === 'week' && !practices.some(p => p.week_start_date === key);
  const msg: ReactNode =
    list.length === 0 ? (
      <Notice action={<button className="btn btn-primary" onClick={() => navigate('/plan')} style={{ height: 38, fontSize: 13 }}>목표 만들러 가기</button>}>목표를 먼저 만들면 여기에 계획을 넣을 수 있어요.</Notice>
    ) : noSubs ? (
      <Notice action={<button className="btn btn-primary" onClick={() => navigate('/goal/' + firstGoal.id)} style={{ height: 38, fontSize: 13 }}>세부 목표 나누기</button>}>세부 목표가 있어야 계획에 넣을 수 있어요.</Notice>
    ) : weekEmpty && !slots.every(s => s.locked) ? (
      <Notice>이 주에는 아직 실천이 없어요. 오른쪽 위 ‘실천’으로 적어 주세요.</Notice>
    ) : null;

  return (
    <div ref={rootRef} data-testid="schedule-tab" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 16px' }}>
        <Seg options={ZOOMS} cur={zoom} onPick={zoomTo} label="보기 단위" />
        <button onClick={() => setSheet({ k: 'add' })} aria-label={zoom === 'week' ? '실천 추가' : '계획 추가'} className="btn btn-primary" style={{ height: 40, padding: '0 16px', gap: 6, fontSize: 14 }}>
          <Svg d={ICON.plus} size={14} width={3} />{zoom === 'week' ? '실천' : '계획'}
        </button>
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0 14px 0 22px', minHeight: 34 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span data-testid="sched-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, lineHeight: 1 }}>{title}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{sub}</span>
        </div>
        {!isCur && <button onClick={() => set(zoom, zoom === 'year' ? thisYear : zoom === 'month' ? thisYm : thisWeek)} className="btn btn-secondary" style={{ height: 30, padding: '0 10px', ...BODY, fontSize: 12 }}>{zoom === 'year' ? '올해' : zoom === 'month' ? '이번 달' : '이번 주'}</button>}
        <button onClick={() => shift(-1)} aria-label="이전" className="btn m-hover" style={{ width: 34, height: 34, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={ICON.left} /></button>
        <button onClick={() => shift(1)} aria-label="다음" className="btn m-hover" style={{ width: 34, height: 34, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={ICON.right} /></button>
      </div>
      {list.length > 0 && (
        <div role="group" aria-label="목표 필터" data-no-swipe style={{ flex: 'none', display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px' }}>
          <button aria-pressed={!filter} onClick={() => set(zoom, key, null)} style={{ flex: 'none', height: 32, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, whiteSpace: 'nowrap', background: !filter ? 'var(--color-text)' : 'var(--color-surface)', color: !filter ? 'var(--color-bg)' : 'var(--color-text)' }}>전체</button>
          {list.map(g => {
            const on = filter === g.id;
            const t = toneOf(g);
            return (
              <button key={g.id} aria-pressed={on} onClick={() => set(zoom, key, on ? null : g.id)} style={{ flex: 'none', height: 32, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', ...chip(on, t) }}>
                <Dot color={t.dot} />{g.name}
              </button>
            );
          })}
        </div>
      )}

      <ScrollArea fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '2px 12px 40px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {msg && <div style={{ flex: 'none', margin: '0 4px 6px' }}>{msg}</div>}
        {headNote && <div data-testid="week-elsewhere" style={{ flex: 'none', margin: '0 4px 6px' }}>{headNote}</div>}
        {upper && (
          <div data-testid="sched-upper" style={{ flex: 'none', display: 'grid', gridTemplateColumns: '46px minmax(0,1fr)', gap: 10, padding: '6px 10px 10px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 2 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{upper.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{upper.sub}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
              {upper.items.map(it => (
                <span key={it.id} data-testid="sched-upper-item" title={it.meta + ' — ' + it.name} style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 999, border: '1.5px dashed ' + it.tone.dot, color: it.tone.ink, fontSize: 11.5, fontWeight: 700, boxSizing: 'border-box', minWidth: 0 }}>
                  <Dot color={it.tone.dot} size={6} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {rows.map(r => (
          <div key={r.key} data-testid="sched-row" data-label={r.label} data-past={r.past || undefined} style={{ flex: 'none', display: 'grid', gridTemplateColumns: '46px minmax(0,1fr)', gap: 10, padding: 10, borderRadius: 24, background: r.now ? 'var(--color-surface)' : 'transparent', opacity: r.past ? 0.55 : 1 }}>
            <button onClick={r.onDrill} disabled={!r.onDrill} aria-label={r.onDrill ? r.label + ' 펼쳐 보기' : undefined} style={{ border: 0, background: 'transparent', padding: '5px 0 0', textAlign: 'left', cursor: r.onDrill ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 3, alignSelf: 'start', ...BODY, fontWeight: 400, color: 'var(--color-text)' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, lineHeight: 1, color: r.now ? 'var(--color-accent-2-800)' : 'var(--color-text)' }}>{r.label}</span>
              {r.sub && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{r.sub}</span>}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              {r.notes.map(n => (
                <button key={n.id} data-testid="sched-note" onClick={n.onTap} style={{ alignSelf: 'flex-start', maxWidth: '100%', border: 0, cursor: 'pointer', ...BODY, fontSize: 11.5, padding: '4px 10px', borderRadius: 999, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.text || '참고사항'}</button>
              ))}
              {r.items.map(it => (
                <button key={it.id} data-testid="sched-item" data-cont={it.cont || undefined} onClick={it.onTap} style={{ border: 0, cursor: 'pointer', textAlign: 'left', ...BODY, fontWeight: 400, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, padding: it.cont ? '6px 12px' : '8px 12px', borderRadius: 16, background: it.tone.bg, opacity: it.cont ? 0.6 : 1 }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: it.tone.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.meta}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, textWrap: 'pretty' }}>{it.name}</span>
                  </span>
                  {(it.span || it.out) && (
                    <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      {it.span && <span style={{ fontSize: 11, fontWeight: 700, color: it.tone.ink, whiteSpace: 'nowrap' }}>{it.span}</span>}
                      {it.out && <span data-testid="out-of-plan" title="위 단계 계획에 없는 세부 목표" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, border: '1.5px dashed ' + it.tone.dot, color: it.tone.ink, whiteSpace: 'nowrap' }}>계획 밖</span>}
                    </span>
                  )}
                </button>
              ))}
              {!r.items.length && !r.notes.length && !r.go && <span style={{ fontSize: 13, color: 'var(--color-neutral-500)', padding: '4px 2px' }}>—</span>}
              {r.go && (
                <button onClick={r.go.onTap} className={r.go.primary ? 'btn btn-primary' : 'btn btn-secondary'} style={{ alignSelf: 'flex-start', height: 36, padding: '0 14px', gap: 6, ...BODY, fontSize: 13 }}>
                  {r.go.label}<Svg d={ICON.arrow} size={13} width={3} />
                </button>
              )}
            </div>
          </div>
        ))}
      </ScrollArea>

      {sheet?.k === 'add' && <AddPlanSheet zoom={zoom} periodKey={key} initialGoal={filter} initialStart={sheet.start ?? defaultStart(zoom, key, today)} onClose={() => setSheet(null)} />}
      {sheet?.k === 'year' && <EditCellSheet zoom="year" cell={sheet.cell} onClose={() => setSheet(null)} />}
      {sheet?.k === 'month' && <EditCellSheet zoom="month" cell={sheet.cell} onClose={() => setSheet(null)} />}
      {sheet?.k === 'note' && <EditNoteSheet note={sheet.note} onClose={() => setSheet(null)} />}
      {sheet?.k === 'practice' && <PracticeSheet practice={sheet.practice} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** 지금 보고 있는 기간 안에서 오늘이 든 칸 */
function defaultStart(zoom: Zoom, key: string, today: DayKey) {
  if (zoom === 'year') return key === today.slice(0, 4) ? Number(today.slice(5, 7)) - 1 : undefined;
  if (zoom === 'month') {
    const i = monthWeeks(key).indexOf(weekStartOf(today));
    return i >= 0 ? i : undefined;
  }
  const i = weekDays(key).indexOf(today);
  return i >= 0 ? i : undefined;
}
