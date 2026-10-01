import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { useAccount, useToday } from '../account/AccountProvider';
import { addDays, dayLabel, diffDays, DEFAULT_DAY_START_HOUR, type DayKey } from '../lib/day';
import { PALETTE } from '../lib/palette';
import { isClosed } from '../lib/goals';
import { fmtMinutes, relOf, segments, SLOTS, timedSlots, timeOf, type DayItem, type TaskRow } from '../lib/today';
import type { Tone } from '../desktop/plan/shared';
import { useDay } from './useDay';
import { TimeTable, type BandView, type Cells, type PlanBoxView } from './TimeTable';
import { AddSheet, CalendarSheet, ConfirmSheet, JournalSheet, PlanSheet } from './Sheets';
import { ensurePush, pushSupported } from './push';

type PlanInfo = { task_id?: string | null; keyword_id?: string | null; label?: string | null };
type SheetState = null | { k: 'cal' } | { k: 'add' } | { k: 'journal' } | { k: 'plan'; key: string; isNew: boolean } | { k: 'del'; task: TaskRow; name: string };

const ICON = {
  repeat: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
  auto: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  picked: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  direct: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3 2 6M22 6l-3-3',
};
const SRC: Record<DayItem['source'], string> = { repeat: '반복', auto: '자동 배정', picked: '담은 일', direct: '직접 추가' };

export default function DayPlanner() {
  const { profile, goals, subgoals, goalCategories, dailyCategory, keywords, allKeywords, practices } = useAccount();
  const dayStart = profile?.day_start_hour ?? DEFAULT_DAY_START_HOUR;
  const today = useToday();
  const [day, setDay] = useState(today);
  const rel = relOf(day, today);
  const D = useDay(day, today);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [mode, setMode] = useState<'plan' | 'actual'>(rel === 0 ? 'actual' : 'plan');
  const [brush, setBrush] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ cells: Cells; info: Record<string, PlanInfo> }>({ cells: Array(SLOTS).fill(null), info: {} });
  const [actual, setActual] = useState<Cells>(Array(SLOTS).fill(null));

  // 4.4 날짜별 권한
  const canCheck = rel === 0;
  const canAdd = rel === 0 || rel === 1;
  const canPlan = canAdd;
  const canAct = rel === 0;
  // 하루 기록은 불러온 뒤에 연다 (덜 불러온 채 열면 빈 기록으로 보이므로)
  const canJournal = rel <= 0 && D.loaded;
  const effMode = canAct ? mode : 'plan';

  const go = (d: DayKey) => {
    setDay(d);
    setSheet(null);
    setBrush(null);
    setMode(d === today ? 'actual' : 'plan');
  };

  // DB 블록 → 칸 배열
  // 이미 알림을 허락한 기기는 조용히 다시 등록 (회고 알림·알람)
  useEffect(() => {
    if (profile?.review_notify_enabled && pushSupported() && Notification.permission === 'granted') ensurePush();
  }, [profile?.review_notify_enabled]);

  useEffect(() => {
    const cells: Cells = Array(SLOTS).fill(null);
    const info: Record<string, PlanInfo> = {};
    const act: Cells = Array(SLOTS).fill(null);
    for (const b of D.blocks) {
      if (b.layer === 'plan') {
        const key = b.block_key ?? b.id;
        for (let i = b.start_slot; i <= b.end_slot; i++) cells[i] = key;
        info[key] = { task_id: b.task_id, keyword_id: b.daily_keyword_id, label: b.label };
      } else {
        const v = b.task_id ? 'task:' + b.task_id : 'kw:' + b.daily_keyword_id;
        for (let i = b.start_slot; i <= b.end_slot; i++) act[i] = v;
      }
    }
    setPlan({ cells, info });
    setActual(act);
  }, [D.blocks]);

  // ───────── 할 일 표시 (R-T4: 목표에서 온 것 = 세부목표 이름, 직접 추가 = "일상 · 키워드") ─────────
  const dailyTone: Tone = PALETTE[dailyCategory?.color ?? 'purple'];
  const practiceMeta = (pid: string | null) => {
    const p = practices.find(x => x.id === pid);
    const g = p && goals.find(x => x.id === p.goal_id);
    const c = g && goalCategories.find(x => x.id === g.category_id);
    return { tone: PALETTE[c?.color ?? 'red'], tag: subgoals.find(s => s.id === p?.subgoal_id)?.name ?? '', name: p?.name ?? '' };
  };
  const directMeta = (t: TaskRow | undefined) => {
    const k = allKeywords.find(x => x.id === t?.daily_keyword_id);
    return { tone: dailyTone, tag: `${dailyCategory?.name ?? '일상'} · ${k?.name ?? ''}`, name: t?.name ?? '' };
  };
  const meta = (it: DayItem) => (it.practice ? practiceMeta(it.practice.id) : directMeta(it.direct));
  const rowMeta = (t: TaskRow) => {
    if (t.practice_id) return practiceMeta(t.practice_id);
    return directMeta(t.carried_task_id ? D.tasks.find(x => x.id === t.carried_task_id) : t);
  };
  const items = [...D.list.repeat, ...D.list.day];
  const itemByRow = (rowId: string) => items.find(it => it.row?.id === rowId);

  // ───────── 시간표 ─────────
  const timed = D.tasks.filter(t => t.date === day && t.source === 'direct' && t.is_timed);
  const reserved = useMemo(() => {
    const r: Cells = Array(SLOTS).fill(null);
    for (const t of timed) {
      const [s, e] = timedSlots(t, dayStart);
      for (let i = s; i < e; i++) r[i] = 'res:' + t.id;
    }
    return r;
  }, [timed, dayStart]);
  const planView = (key: string): PlanBoxView => {
    if (key.startsWith('res:')) return { name: D.tasks.find(t => t.id === key.slice(4))?.name ?? '', alarm: true };
    const inf = plan.info[key] ?? {};
    if (inf.task_id) {
      const t = D.tasks.find(x => x.id === inf.task_id);
      const m = t ? rowMeta(t) : null;
      return { name: m?.name ?? '', dot: m?.tone.dot };
    }
    if (inf.keyword_id) return { name: allKeywords.find(k => k.id === inf.keyword_id)?.name ?? '' };
    return { name: inf.label ?? '' };
  };
  const bandView = (v: string): BandView => {
    if (v.startsWith('kw:')) return { dot: dailyTone.dot, mark: (allKeywords.find(k => k.id === v.slice(3))?.name ?? '').slice(0, 1) };
    const id = v.slice(5);
    const t = D.tasks.find(x => x.id === id);
    const it = itemByRow(id);
    return { dot: t ? rowMeta(t).tone.dot : 'var(--color-neutral-500)', mark: it ? String(it.num) : '' };
  };

  // 시간표 저장은 순서대로 하나씩 (빠르게 이어서 그려도 나중 것이 이긴다)
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = (fn: () => Promise<unknown>) => (queue.current = queue.current.then(fn, fn));
  const savePlan = (cells: Cells, info: Record<string, PlanInfo>) =>
    enqueue(() => D.saveLayer('plan', segments(cells).map(s => ({ start: s.start, end: s.end, key: s.value, ...info[s.value] }))));
  const saveActual = (cells: Cells) =>
    enqueue(() => D.saveLayer('actual', segments(cells).map(s => (s.value.startsWith('task:') ? { start: s.start, end: s.end, task_id: s.value.slice(5) } : { start: s.start, end: s.end, keyword_id: s.value.slice(3) }))));

  // R-S10: 계획 시간 / 실제 시간, 가장 가까운 목표 기한
  const plannedMin = plan.cells.filter((v, i) => v || reserved[i]).length * 10;
  const actualMin = actual.filter(Boolean).length * 10;
  const dday = useMemo(() => {
    const cand = goals
      .filter(g => !isClosed(g))
      .map(g => {
        const [y, m] = g.due_month.split('-').map(Number);
        const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
        return { g, n: diffDays(day, end) };
      })
      .filter(x => x.n >= 0)
      .sort((a, b) => a.n - b.n)[0];
    return cand ? { n: 'D-' + cand.n, goal: cand.g.name } : null;
  }, [goals, day]);

  const { md, dow } = dayLabel(day);
  const badge = rel === 0 ? ['오늘', 'tag tag-accent'] : rel === 1 ? ['내일', 'tag tag-accent-2'] : rel > 1 ? ['보기 전용', 'tag tag-neutral'] : ['지난 기록', 'tag tag-neutral'];
  const banner = rel < 0 ? '지난 기록은 수정할 수 없어요' : rel > 1 ? '보기 전용 · 주간 표에서 배정된 실천만 보여요' : '';

  const brushItem = brush?.startsWith('task:') ? itemByRow(brush.slice(5)) : undefined;
  const brushKw = brush?.startsWith('kw:') ? allKeywords.find(k => k.id === brush.slice(3)) : undefined;
  const hint = !canPlan ? (rel < 0 ? '지난 기록 · 보기만 할 수 있어요' : '보기 전용') : effMode === 'plan' ? '드래그해서 계획을 회색으로' : brushItem ? '칠하는 중 · ' + meta(brushItem).name : brushKw ? '칠하는 중 · 일상 · ' + brushKw.name : '할 일을 먼저 골라 주세요';

  const j = D.journal;
  const nThanks = j ? j.thanks.filter(x => x.trim()).length : 0;
  const jSummary = [j?.score && '★' + j.score, nThanks && '감사 ' + nThanks, j?.memo.trim() && '메모'].filter(Boolean).join(' · ');

  // 앱바 좌우 스와이프 (R-D3: 앱바 영역에서만)
  const sw = useRef<number | null>(null);

  // 할 일 길게 누르기 → 삭제 (오늘·내일 직접 추가한 것, 기획 결정)
  const press = useRef<{ t: number; fired: boolean } | null>(null);
  const startPress = (it: DayItem) => {
    press.current = null;
    if (!(it.source === 'direct' && !it.carried && canAdd && it.row)) return;
    const st = { t: window.setTimeout(() => { st.fired = true; setSheet({ k: 'del', task: it.row!, name: meta(it).name }); }, 600), fired: false };
    press.current = st;
  };
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.t);
  };

  const pickBrush = async (it: DayItem) => {
    if (press.current?.fired) return (press.current = null);
    if (!canAct) return;
    const id = await D.ensureRow(it);
    if (id) {
      setBrush('task:' + id);
      setMode('actual');
    }
  };

  // 목록 위·아래 가장자리 그라데이션 (SPEC 5장 공통)
  const listRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const measure = () => {
    const el = listRef.current;
    if (el) setFade({ top: el.scrollTop > 2, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2 });
  };
  useEffect(measure, [D.list]);

  const row = (it: DayItem) => {
    const m = meta(it);
    const sel = canAct && !!it.row && brush === 'task:' + it.row.id;
    const t = it.direct;
    const carriedLabel = it.carried ? (diffDays(it.originDate, day) === 1 ? '어제에서' : md0(it.originDate) + '에서') : '';
    return (
      <div
        key={it.key}
        data-testid="todo"
        data-key={it.key}
        data-source={it.source}
        onClick={() => pickBrush(it)}
        onPointerDown={() => startPress(it)}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={e => e.preventDefault()}
        style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 6px 6px 3px', borderRadius: 16, background: sel ? 'var(--color-neutral-100)' : 'transparent', boxShadow: sel ? 'inset 0 0 0 2px ' + m.tone.dot : 'none', cursor: canAct ? 'pointer' : 'default', opacity: rel > 1 ? 0.5 : 1, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <span style={{ flex: 'none', width: 12, textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, lineHeight: 1, color: 'var(--color-neutral-700)' }}>{it.num}</span>
        <span title={SRC[it.source] + (it.carried ? ' · ' + carriedLabel : '')} style={{ flex: 'none', width: 14, display: 'grid', placeItems: 'center', color: 'var(--color-neutral-600)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-label={SRC[it.source]}><path d={ICON[it.source]} /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span data-testid="todo-tag" style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, padding: '2px 7px', borderRadius: 999, background: m.tone.bg, color: m.tone.ink }}>{m.tag}</span>
            {carriedLabel && <span data-testid="carried" style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>{carriedLabel}</span>}
            {t?.is_timed && (
              <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-label="알람"><path d={ICON.alarm} /></svg>
                {t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)}
              </span>
            )}
          </div>
          <span data-testid="todo-name" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--color-neutral-600)' : 'var(--color-text)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.name}</span>
        </div>
        {rel <= 0 && (
          <button
            aria-label={(it.done ? '완료 취소 ' : '완료 ') + m.name}
            aria-pressed={it.done}
            disabled={!canCheck}
            onClick={e => { e.stopPropagation(); if (canCheck) D.toggleDone(it); }}
            onPointerDown={e => e.stopPropagation()}
            style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', border: '2px solid ' + m.tone.dot, background: it.done ? m.tone.dot : 'transparent', display: 'grid', placeItems: 'center', padding: 0, cursor: canCheck ? 'pointer' : 'default', color: 'var(--color-neutral-100)' }}
          >
            {it.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
          </button>
        )}
      </div>
    );
  };

  const doneCount = D.list.day.filter(x => x.done).length;
  const planSheet = sheet?.k === 'plan' ? sheet : null;
  const planRange = (() => {
    if (!planSheet) return '';
    const idx = plan.cells.map((v, i) => (v === planSheet.key ? i : -1)).filter(i => i >= 0);
    return idx.length ? `${timeOf(idx[0], dayStart)} – ${timeOf(idx[idx.length - 1] + 1, dayStart)}` : '';
  })();
  const setPlanInfo = async (key: string, inf: PlanInfo) => {
    const info = { ...plan.info, [key]: inf };
    setPlan({ cells: plan.cells, info });
    setSheet(null);
    await savePlan(plan.cells, info);
  };

  return (
    <div style={{ position: 'relative', height: '100dvh', overflow: 'hidden', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', padding: 'max(12px, env(safe-area-inset-top)) 12px max(16px, env(safe-area-inset-bottom))', boxSizing: 'border-box', gap: 8 }}>
      {/* 앱바 */}
      <div
        onPointerDown={e => { sw.current = e.clientX; }}
        onPointerUp={e => {
          if (sw.current == null) return;
          const dx = e.clientX - sw.current;
          sw.current = null;
          if (Math.abs(dx) > 50) go(addDays(day, dx < 0 ? 1 : -1));
        }}
        style={{ flex: 'none', height: 46, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 4, touchAction: 'pan-y', userSelect: 'none' }}
      >
        <span data-testid="day-badge" className={badge[1]} style={{ justifySelf: 'start', fontWeight: 700, fontSize: 11.5 }}>{badge[0]}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => go(addDays(day, -1))} aria-label="전날" className="btn" style={{ width: 36, height: 36, padding: 0, color: 'var(--color-neutral-700)' }}><Icon name="chevronLeft" /></button>
          <button onClick={() => setSheet({ k: 'cal' })} aria-label="달력 열기" style={{ border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--color-text)', padding: '4px 10px', borderRadius: 999, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span data-testid="day-label" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{md}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, color: 'var(--color-accent-700)' }}>{dow}</span>
          </button>
          <button onClick={() => go(addDays(day, 1))} aria-label="다음 날" className="btn" style={{ width: 36, height: 36, padding: 0, color: 'var(--color-neutral-700)' }}><Icon name="chevronRight" /></button>
        </div>
        {rel !== 0 && <button onClick={() => go(today)} className="btn btn-secondary" style={{ justifySelf: 'end', height: 30, padding: '0 12px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12 }}>오늘</button>}
      </div>

      {/* 요약 (R-S10) */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 4px' }}>
        {dday ? (
          <span className="tag" style={{ flex: '0 1 auto', background: 'var(--color-text)', color: 'var(--color-neutral-100)', fontWeight: 700, fontSize: 11.5, gap: 5, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <span>{dday.n}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dday.goal}</span>
          </span>
        ) : <span />}
        <div style={{ flex: 'none', display: 'flex', gap: 10, fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-neutral-400)' }} />계획 <b data-testid="planned" style={{ color: 'var(--color-text)' }}>{fmtMinutes(plannedMin)}</b></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-accent)' }} />실제 <b data-testid="actual" style={{ color: 'var(--color-accent-700)' }}>{fmtMinutes(actualMin)}</b></span>
        </div>
      </div>

      {banner && (
        <div data-testid="day-banner" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)', fontSize: 12.5, fontWeight: 600 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden="true"><path d={ICON.lock} /></svg>
          {banner}
        </div>
      )}

      {/* 할 일 | 시간표 — 폭 비율 고정 (SPEC 5장 알려진 문제) */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 166px', gap: 8 }}>
        <div style={{ position: 'relative', minHeight: 0, background: 'var(--color-surface)', borderRadius: 24, overflow: 'hidden' }}>
          <div ref={listRef} onScroll={measure} style={{ position: 'absolute', inset: 0, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '2px 8px 4px', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>반복</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>다음 날로 넘어가지 않아요</span>
            </div>
            {D.list.repeat.map(row)}
            {D.list.repeat.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', padding: '4px 8px 6px' }}>반복 실천이 없어요</span>}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '10px 8px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{rel === 0 ? '오늘 할 일' : '할 일'}</span>
              {D.list.day.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{doneCount} / {D.list.day.length}</span>}
            </div>
            {D.list.day.map(row)}
            {D.list.day.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', padding: '4px 8px 6px', lineHeight: 1.45 }}>
                {D.loaded && items.length === 0 && rel <= 1 ? '데스크톱 주간 표에서 실천을 적으면 여기에 나타나요' : '할 일이 없어요'}
              </span>
            )}
            {canAdd && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 2px 2px' }}>
                <button onClick={() => setSheet({ k: 'add' })} className="btn add-dashed" style={{ height: 36, border: '2px dashed var(--color-neutral-400)', color: 'var(--color-neutral-800)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, borderRadius: 16, padding: '0 10px' }}>+ 직접 추가</button>
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, pointerEvents: 'none', background: 'linear-gradient(var(--color-surface), transparent)', opacity: fade.top ? 1 : 0, transition: 'opacity .15s' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, pointerEvents: 'none', background: 'linear-gradient(transparent, var(--color-surface))', opacity: fade.bottom ? 1 : 0, transition: 'opacity .15s' }} />
        </div>

        <div style={{ background: 'var(--color-surface)', borderRadius: 24, padding: '6px 6px 6px 4px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 3, paddingLeft: 2 }}>
            {(
              [
                ['plan', '계획 그리기', canPlan],
                ['actual', '실제 칠하기', canAct],
              ] as const
            ).map(([k, label, ok]) => {
              const on = ok && effMode === k;
              return (
                <button key={k} aria-pressed={on} disabled={!ok} onClick={() => setMode(k)} style={{ flex: 1, height: 28, border: 0, borderRadius: 999, cursor: ok ? 'pointer' : 'default', font: 'inherit', fontSize: 11.5, fontWeight: 700, padding: 0, background: on ? (k === 'plan' ? 'var(--color-neutral-700)' : 'var(--color-accent)') : 'var(--color-neutral-100)', color: on ? 'var(--color-neutral-100)' : 'var(--color-text)', opacity: ok ? 1 : 0.45 }}>{label}</button>
              );
            })}
          </div>
          {canAct && effMode === 'actual' && (
            <div style={{ display: 'flex', gap: 3, paddingLeft: 2 }}>
              {keywords.map(k => {
                const on = brush === 'kw:' + k.id;
                return (
                  <button key={k.id} aria-pressed={on} aria-label={'키워드 ' + k.name + '로 칠하기'} onClick={() => setBrush('kw:' + k.id)} style={{ flex: 1, minWidth: 0, height: 22, border: 0, borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 10, fontWeight: 700, padding: 0, overflow: 'hidden', whiteSpace: 'nowrap', background: on ? dailyTone.bg : 'var(--color-neutral-100)', color: on ? dailyTone.ink : 'var(--color-text)', boxShadow: on ? 'inset 0 0 0 2px ' + dailyTone.dot : 'none' }}>{k.name}</button>
                );
              })}
            </div>
          )}
          <TimeTable
            dayStart={dayStart}
            mode={effMode}
            canPlan={canPlan}
            canAct={canAct}
            brush={brush}
            plan={plan.cells}
            actual={actual}
            reserved={reserved}
            planView={planView}
            bandView={bandView}
            hint={hint}
            onPreview={(layer, cells) => (layer === 'plan' ? setPlan(p => ({ ...p, cells })) : setActual(cells))}
            onPlanTap={key => setSheet({ k: 'plan', key, isNew: false })}
            onPlanDrawn={(cells, key) => {
              const info = { ...plan.info, [key]: {} };
              setPlan({ cells, info });
              savePlan(cells, info);
              setSheet({ k: 'plan', key, isNew: true });
            }}
            onCommit={(layer, cells) => {
              if (layer === 'plan') {
                setPlan(p => ({ ...p, cells }));
                savePlan(cells, plan.info);
              } else {
                setActual(cells);
                saveActual(cells);
              }
            }}
          />
        </div>
      </div>

      {/* 하루 기록 (R-J1) */}
      <button
        data-testid="journal-button"
        onClick={() => canJournal && setSheet({ k: 'journal' })}
        disabled={!canJournal}
        style={{ flex: 'none', height: 46, border: 0, borderRadius: 999, background: 'var(--color-surface)', cursor: canJournal ? 'pointer' : 'default', font: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 18px', opacity: canJournal ? 1 : 0.55 }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>하루 기록</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12.5, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {jSummary || (rel === 0 ? '오늘을 짧게 남겨요' : rel < 0 ? '남긴 기록이 없어요' : '그날이 되면 쓸 수 있어요')}
        </span>
        <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center' }}><Icon name="chevronUp" size={14} /></span>
      </button>

      {sheet?.k === 'cal' && <CalendarSheet day={day} today={today} onPick={go} onClose={() => setSheet(null)} />}
      {sheet?.k === 'add' && (
        <AddSheet
          keywords={keywords}
          tone={dailyTone}
          onSubmit={async x => {
            if (x.timed) ensurePush(); // 예약 할 일 알람 (R-T3) — 처음 한 번 알림 허락을 받는다
            return D.addDirect(x);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.k === 'journal' && <JournalSheet key={day + (D.journal?.id ?? '')} day={day} journal={D.journal} readOnly={rel !== 0} onSave={j => {
            // 회고 알림(4.6)을 켰으면 이 휴대폰도 알림 받을 곳으로 — 처음 한 번 허락을 받는다
            if (profile?.review_notify_enabled) ensurePush();
            return D.saveJournal(j);
          }} onClose={() => setSheet(null)} />}
      {sheet?.k === 'del' && (
        <ConfirmSheet
          title="할 일을 지울까요?"
          body={`‘${sheet.name}’을(를) 지워요. 시간표에 칠한 것도 함께 지워져요.`}
          confirmLabel="지우기"
          onConfirm={() => { D.removeTask(sheet.task.id); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
      {planSheet && (
        <PlanSheet
          key={planSheet.key}
          isNew={planSheet.isNew}
          range={planRange}
          dailyTone={dailyTone}
          current={plan.info[planSheet.key]?.label ?? null}
          todos={items.map(it => {
            const m = meta(it);
            return { key: it.key, tag: m.tag, name: m.name, tone: m.tone, on: !!it.row && plan.info[planSheet.key]?.task_id === it.row.id };
          })}
          keywords={keywords.map(k => ({ id: k.id, name: k.name, on: plan.info[planSheet.key]?.keyword_id === k.id }))}
          onTodo={async key => {
            const it = items.find(x => x.key === key);
            const id = it && (await D.ensureRow(it));
            if (id) setPlanInfo(planSheet.key, { task_id: id });
          }}
          onKeyword={id => setPlanInfo(planSheet.key, { keyword_id: id })}
          onLabel={text => text && setPlanInfo(planSheet.key, { label: text })}
          onSecondary={() => {
            setSheet(null);
            if (planSheet.isNew) return;
            const cells = plan.cells.map(v => (v === planSheet.key ? null : v));
            setPlan(p => ({ ...p, cells }));
            savePlan(cells, plan.info);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function md0(d: DayKey) {
  return dayLabel(d).md;
}
