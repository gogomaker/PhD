// 기록 › 오늘: 할 일 + 10분 시간표 + 하루 기록 (SPEC 4.3~4.5, 기존 모바일 하루 플래너를 새 틀에)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../Icon';
import { useAccount, useToday } from '../../account/AccountProvider';
import { addDays, dayLabel, diffDays, DEFAULT_DAY_START_HOUR, DEFAULT_TIMEZONE, isDayKey, type DayKey } from '../../lib/day';
import { PALETTE } from '../../lib/palette';
import { fmtMinutes, nowSlot, paint, relOf, segments, SLOTS, timedSlots, timeOf, type DayItem, type TaskRow } from '../../lib/today';
import type { Tone } from '../../desktop/plan/shared';
import { useDay, type Journal } from '../useDay';
import { useSwipe } from '../useSwipe';
import { DRAFT, TimeTable, type BandView, type Cells, type PlanBoxView } from '../TimeTable';
import { AddSheet, CalendarSheet, ConfirmSheet, JournalSheet, PickSheet, PlanSheet, TaskMenuSheet } from '../Sheets';
import { ensurePush } from '../push';
import { BODY, ICON as MI, Svg } from '../ui';

type PlanInfo = { task_id?: string | null; keyword_id?: string | null; label?: string | null };
type SheetState = null | { k: 'cal' } | { k: 'add' } | { k: 'journal' } | { k: 'plan'; key: string; isNew: boolean } | { k: 'del'; task: TaskRow; name: string } | { k: 'menu'; it: DayItem; name: string } | { k: 'pick'; snap: Cells; from: number; to: number };

const ICON = {
  repeat: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
  auto: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  picked: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  direct: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3 2 6M22 6l-3-3',
};
// 저장하지 못한 하루 기록 — 다른 화면으로 옮겨 이 화면이 사라져도 남게 바깥에 둔다 (2026-10-03 UT 2차)
let unsavedJournal: { day: DayKey; j: Journal } | null = null;

// 길게 누르면 손을 떼기 전에 메뉴가 뜬다. 손을 뗄 때 오는 클릭 한 번이 메뉴 뒤 배경에 닿아 메뉴가 바로 닫히지 않게 먹는다 (2026-10-03 UT 4차)
function swallowNextClick() {
  const eat = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', eat, { capture: true, once: true });
  window.addEventListener('pointerup', () => window.setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 400), { once: true });
}

const SRC: Record<DayItem['source'], string> = { repeat: '반복', auto: '자동 배정', picked: '담은 일', direct: '직접 추가' };

/** base = 이 화면 주소 (휴대폰 /record, PC /today), weekPath = 주간 실천 적는 곳, wide = PC 폭 (시간표를 넓게) */
export default function TodayTab({ base = '/record', weekPath = '/plan/schedule?z=week', wide = false }: { base?: string; weekPath?: string; wide?: boolean } = {}) {
  const { profile, subgoals, goals, goalCategories, dailyCategory, keywords, allKeywords, practices, toast } = useAccount();
  const dayStart = profile?.day_start_hour ?? DEFAULT_DAY_START_HOUR;
  const today = useToday();
  const loc = useLocation();
  const navigate = useNavigate();
  // 보는 날은 주소에 (?d=날짜, 없으면 오늘)
  const asked = new URLSearchParams(loc.search).get('d');
  const day = isDayKey(asked) ? asked : today;
  const rel = relOf(day, today);
  const D = useDay(day, today);
  const [sheet, setSheet] = useState<SheetState>(null);
  const journalDraft = unsavedJournal?.day === day ? unsavedJournal.j : null;
  const [mode, setMode] = useState<'plan' | 'actual'>(rel === 0 ? 'actual' : 'plan');
  const [brush, setBrush] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ cells: Cells; info: Record<string, PlanInfo> }>({ cells: Array(SLOTS).fill(null), info: {} });
  const [actual, setActual] = useState<Cells>(Array(SLOTS).fill(null));

  // 4.4 날짜별 권한
  const canCheck = rel === 0;
  const canAdd = rel === 0 || rel === 1;
  // 이 날 기록을 불러오기 전에는 칠하지 않는다 (빈 화면에 칠한 게 서버 기록을 덮지 않게, 2026-10-04)
  const canPlan = canAdd && D.ready;
  const canAct = rel === 0 && D.ready;
  // 하루 기록은 불러온 뒤에 연다 (덜 불러온 채 열면 빈 기록으로 보이므로)
  const canJournal = rel <= 0 && D.loaded;
  const effMode = rel === 0 ? mode : 'plan';
  // 실제 시간은 지금 칸까지만 (2026-10-03 UT). 30초마다 다시 본다
  const tz = profile?.timezone ?? DEFAULT_TIMEZONE;
  const [slotNow, setSlotNow] = useState(() => nowSlot(new Date(), tz, dayStart));
  useEffect(() => {
    const tick = () => setSlotNow(nowSlot(new Date(), tz, dayStart));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [tz, dayStart]);
  const actualUntil = rel === 0 ? slotNow : SLOTS - 1;

  const go = (d: DayKey) => {
    setSheet(null);
    navigate(d === today ? base : base + '?d=' + d, { replace: true });
  };
  // 날이 바뀌면 붓과 모드를 처음으로
  useEffect(() => {
    setBrush(null);
    setMode(day === today ? 'actual' : 'plan');
  }, [day, today]);
  // 안내의 '다시 열기'로 들어오면 쓰던 하루 기록을 바로 연다
  const reopen = (loc.state as { journal?: boolean } | null)?.journal === true;
  useEffect(() => {
    if (!reopen) return;
    if (journalDraft) setSheet({ k: 'journal' });
    navigate(loc.pathname + loc.search, { replace: true, state: null });
  }, [reopen]); // eslint-disable-line react-hooks/exhaustive-deps

  // DB 블록 → 칸 배열
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
    // 목표의 세부목표에 연결한 직접 추가 (2026-10-03 UT 9): 실천처럼 목표 색 + 세부목표 이름
    if (t?.subgoal_id) {
      const sg = subgoals.find(x => x.id === t.subgoal_id);
      const g = sg && goals.find(x => x.id === sg.goal_id);
      const c = g && goalCategories.find(x => x.id === g.category_id);
      return { tone: PALETTE[c?.color ?? 'red'], tag: sg?.name ?? '', name: t.name ?? '' };
    }
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
  // 시간을 정한 실천 (2026-10-03 UT 5): 그날(넘어온 날 말고) 시간표에 예약처럼
  const timedPractices = items.filter(it => it.practice?.start_time && it.practice.end_time && !it.carried).map(it => it.practice!);
  const reserved = useMemo(() => {
    const r: Cells = Array(SLOTS).fill(null);
    for (const t of timed) {
      const [s, e] = timedSlots(t, dayStart);
      for (let i = s; i < e; i++) r[i] = 'res:' + t.id;
    }
    for (const p of timedPractices) {
      const [s, e] = timedSlots(p as { start_time: string; end_time: string }, dayStart);
      for (let i = s; i < e; i++) r[i] ??= 'resp:' + p.id;
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, dayStart, timedPractices.map(p => p.id + p.start_time + p.end_time).join()]);
  const planView = (key: string): PlanBoxView => {
    if (key.startsWith('res:')) return { name: D.tasks.find(t => t.id === key.slice(4))?.name ?? '', alarm: true };
    if (key.startsWith('resp:')) { const m = practiceMeta(key.slice(5)); return { name: m.name, dot: m.tone.dot, alarm: true }; }
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
    if (v === DRAFT) return { dot: 'var(--color-neutral-500)', mark: '' };
    if (v.startsWith('kw:')) return { dot: dailyTone.dot, mark: (allKeywords.find(k => k.id === v.slice(3))?.name ?? '').slice(0, 1) };
    const id = v.slice(5);
    const t = D.tasks.find(x => x.id === id);
    const it = itemByRow(id);
    return { dot: t ? rowMeta(t).tone.dot : 'var(--color-neutral-500)', mark: it ? String(it.num) : '' };
  };

  // 시간표 저장은 순서대로 하나씩 (빠르게 이어서 그려도 나중 것이 이긴다)
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = (fn: () => Promise<unknown>) => {
    D.noteEdit();
    return (queue.current = queue.current.then(fn, fn));
  };
  const savePlan = (cells: Cells, info: Record<string, PlanInfo>) =>
    enqueue(() => D.saveLayer('plan', segments(cells).map(s => ({ start: s.start, end: s.end, key: s.value, ...info[s.value] }))));
  // 아직 오지 않은 칸은 저장하지 않는다 (예전에 칠해 둔 것도 이때 빠진다)
  const saveActual = (all: Cells) => {
    const cells = all.map((v, i) => (i > actualUntil ? null : v));
    return enqueue(() => D.saveLayer('actual', segments(cells).map(s => (s.value.startsWith('task:') ? { start: s.start, end: s.end, task_id: s.value.slice(5) } : { start: s.start, end: s.end, keyword_id: s.value.slice(3) }))));
  };

  // R-S10: 계획 시간 / 실제 시간 (가장 가까운 목표 기한은 탭 줄 오른쪽)
  const plannedMin = plan.cells.filter((v, i) => v || reserved[i]).length * 10;
  const actualMin = actual.filter(Boolean).length * 10;

  const { md, dow } = dayLabel(day);
  const badge = rel === 0 ? ['오늘', 'tag tag-accent'] : rel === 1 ? ['내일', 'tag tag-accent-2'] : rel > 1 ? ['보기 전용', 'tag tag-neutral'] : ['지난 기록', 'tag tag-neutral'];
  const banner = rel < 0 ? '지난 기록은 수정할 수 없어요' : rel > 1 ? '보기 전용 · 주간 표에서 배정된 실천만 보여요' : '';

  const brushItem = brush?.startsWith('task:') ? itemByRow(brush.slice(5)) : undefined;
  const brushKw = brush?.startsWith('kw:') ? allKeywords.find(k => k.id === brush.slice(3)) : undefined;
  const hint = rel <= 1 && !D.ready ? (navigator.onLine ? '불러오는 중이에요…' : '연결되면 칠할 수 있어요') : !canPlan ? (rel < 0 ? '지난 기록 · 보기만 할 수 있어요' : '보기 전용') : effMode === 'plan' ? '드래그해서 계획을 회색으로' : brushItem ? '칠하는 중 · ' + meta(brushItem).name : brushKw ? '칠하는 중 · 일상 · ' + brushKw.name : '칠하면 무엇을 했는지 골라요';

  const j = D.journal;
  const nThanks = j ? j.thanks.filter(x => x.trim()).length : 0;
  const jSummary = [j?.score && '★' + j.score, nThanks && '감사 ' + nThanks, j?.memo.trim() && '메모'].filter(Boolean).join(' · ');

  // 앱바 좌우 스와이프 (R-D3: 앱바 영역에서만)
  const rootRef = useRef<HTMLDivElement>(null);
  const goRef = useRef({ prev: () => {}, next: () => {} });
  goRef.current = { prev: () => go(addDays(day, -1)), next: () => go(addDays(day, 1)) };
  useSwipe(rootRef, useCallback(() => goRef.current.prev(), []), useCallback(() => goRef.current.next(), []));

  // 할 일 길게 누르기 → 메뉴: 취소(오늘, 완료와 따로 — 2026-10-03 UT 4차) · 삭제(오늘·내일 직접 추가한 것, 기획 결정)
  const press = useRef<{ t: number; fired: boolean } | null>(null);
  const canDeleteItem = (it: DayItem) => it.source === 'direct' && !it.carried && canAdd && !!it.row;
  const canCancelItem = (it: DayItem) => canCheck && !it.done;
  const startPress = (it: DayItem) => {
    press.current = null;
    if (!canDeleteItem(it) && !canCancelItem(it)) return;
    const st = { t: window.setTimeout(() => { st.fired = true; swallowNextClick(); setSheet({ k: 'menu', it, name: meta(it).name }); }, 600), fired: false };
    press.current = st;
  };
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.t);
  };

  const pickBrush = async (it: DayItem) => {
    if (press.current?.fired) return (press.current = null);
    // 붓 고르기는 시간표를 바꾸지 않아서 불러오는 중에도 된다 (칠하기만 불러온 뒤에)
    if (rel !== 0) return;
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
    const sel = rel === 0 && !!it.row && brush === 'task:' + it.row.id;
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
        style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 6px 6px 3px', borderRadius: 16, background: sel ? 'var(--color-neutral-100)' : 'transparent', boxShadow: sel ? 'inset 0 0 0 2px ' + m.tone.dot : 'none', cursor: rel === 0 ? 'pointer' : 'default', opacity: rel > 1 ? 0.5 : 1, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <span style={{ flex: 'none', width: 12, textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, lineHeight: 1, color: 'var(--color-neutral-700)' }}>{it.num}</span>
        <span title={SRC[it.source] + (it.carried ? ' · ' + carriedLabel : '')} style={{ flex: 'none', width: 14, display: 'grid', placeItems: 'center', color: 'var(--color-neutral-600)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-label={SRC[it.source]}><path d={ICON[it.source]} /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 자리가 모자라면 시각·'…에서'는 다음 줄로 (태그가 한 글자로 줄지 않게, 2026-10-03 UT 4차) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 4px', minWidth: 0 }}>
            <span data-testid="todo-tag" style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, padding: '2px 7px', borderRadius: 999, background: m.tone.bg, color: m.tone.ink }}>{m.tag}</span>
            {it.canceled && <span data-testid="canceled" style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>취소함</span>}
            {carriedLabel && <span data-testid="carried" style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>{carriedLabel}</span>}
            {(() => {
              const tm = t?.is_timed ? t : it.practice?.start_time && !it.carried ? it.practice : null;
              return tm && (
                <span data-testid="todo-time" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-label="알람"><path d={ICON.alarm} /></svg>
                  {tm.start_time?.slice(0, 5)}–{tm.end_time?.slice(0, 5)}
                </span>
              );
            })()}
          </div>
          <span data-testid="todo-name" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, textDecoration: it.done || it.canceled ? 'line-through' : 'none', color: it.canceled ? 'var(--color-neutral-500)' : it.done ? 'var(--color-neutral-600)' : 'var(--color-text)', wordBreak: 'keep-all', overflowWrap: 'anywhere', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.name}</span>
        </div>
        {rel <= 0 && (
          <button
            // 취소한 일은 ×로 (완료 ✓와 따로). 누르면 취소를 푼다
            aria-label={(it.canceled ? '취소 풀기 ' : it.done ? '완료 풀기 ' : '완료 ') + m.name}
            aria-pressed={it.done}
            disabled={!canCheck}
            onClick={e => { e.stopPropagation(); if (canCheck) void (it.canceled ? D.toggleCancel(it) : D.toggleDone(it)); }}
            onPointerDown={e => e.stopPropagation()}
            style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', border: it.canceled ? '2px dashed var(--color-neutral-500)' : '2px solid ' + m.tone.dot, background: it.done ? m.tone.dot : 'transparent', display: 'grid', placeItems: 'center', padding: 0, cursor: canCheck ? 'pointer' : 'default', color: it.canceled ? 'var(--color-neutral-600)' : 'var(--color-neutral-100)' }}
          >
            {it.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
            {it.canceled && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>}
          </button>
        )}
      </div>
    );
  };

  // 취소한 일은 세지 않는다 (완료 / 남은 일)
  const doneCount = D.list.day.filter(x => x.done).length;
  const dayCount = D.list.day.filter(x => !x.canceled).length;
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
    <div ref={rootRef} data-testid="today-tab" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px max(16px, env(safe-area-inset-bottom))' }}>
      {/* 날짜 줄: ‹ 10.1 목 › 오늘 · 계획/실제 (R-D3: 화면을 좌우로 밀면 날짜 이동 — 시간표 위는 칠하기라 빼고, 2026-10-03 UT) */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, padding: '0 4px 0 0', minHeight: 40, userSelect: 'none' }}>
        <button onClick={() => go(addDays(day, -1))} aria-label="전날" className="btn m-hover" style={{ width: 32, height: 32, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={MI.left} /></button>
        <button onClick={() => setSheet({ k: 'cal' })} aria-label="달력 열기" style={{ border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--color-text)', padding: '4px 2px', borderRadius: 999, display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span data-testid="day-label" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{md}</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, color: 'var(--color-accent-700)' }}>{dow}</span>
        </button>
        <button onClick={() => go(addDays(day, 1))} aria-label="다음 날" className="btn m-hover" style={{ width: 32, height: 32, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={MI.right} /></button>
        {/* 지난날·모레 이후 안내는 줄을 끼워 넣지 않고 배지에 담는다 — 날마다 레이아웃이 같게 (지류 다이어리처럼, 2026-10-03 기획 피드백) */}
        {banner ? (
          // 좁은 휴대폰(360px 이하)에서는 배지 글자가 먼저 줄어든다 — '오늘' 버튼·합계가 깨지지 않게 (2026-10-03 UT 4차)
          <button data-testid="day-badge" className={badge[1]} title={banner} aria-label={badge[0] + ' · ' + banner} onClick={() => toast(banner)} style={{ border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap', gap: 4, flex: '0 1 auto', minWidth: 0, overflow: 'hidden' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={ICON.lock} /></svg>
            <span data-testid="day-badge-text" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{badge[0]}</span>
          </button>
        ) : (
          <span data-testid="day-badge" className={badge[1]} style={{ fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap' }}>{badge[0]}</span>
        )}
        {rel !== 0 && <button onClick={() => go(today)} className="btn btn-secondary" style={{ flex: 'none', height: 28, padding: '0 10px', marginLeft: 4, ...BODY, fontSize: 12, whiteSpace: 'nowrap' }}>오늘</button>}
        <div style={{ flex: 1 }} />
        {/* 연결이 끊겨 못 보낸 시간표가 있을 때만 (늘 자리를 잡아 두면 좁은 휴대폰에서 합계가 잘려서, 2026-10-03 UT 4차) */}
        <button
          data-testid="save-pending"
          aria-hidden={!D.pending || undefined}
          tabIndex={D.pending ? 0 : -1}
          onClick={() => toast('연결이 끊겨 이 기기에 두었어요. 연결되면 자동으로 저장해요')}
          className="tag tag-neutral"
          style={{ display: D.pending ? undefined : 'none', flex: 'none', border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', marginRight: 6 }}
        >
          저장 대기
        </button>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, fontSize: 11.5, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
          <span>계획 <b data-testid="planned" style={{ color: 'var(--color-text)' }}>{fmtMinutes(plannedMin)}</b></span>
          <span>실제 <b data-testid="actual" style={{ color: 'var(--color-accent-700)' }}>{fmtMinutes(actualMin)}</b></span>
        </div>
      </div>

      {/* 할 일 | 시간표 — 폭 비율 고정 (SPEC 5장 알려진 문제) */}
      <div className="today-body" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: wide ? 'minmax(260px, 1fr) minmax(0, 1.5fr)' : 'minmax(0,1fr) 166px', gap: wide ? 14 : 8 }}>
        <div style={{ position: 'relative', minHeight: 0, background: 'var(--color-surface)', borderRadius: 24, overflow: 'hidden' }}>
          <div ref={listRef} onScroll={measure} style={{ position: 'absolute', inset: 0, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '2px 8px 4px', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>반복</span>
            </div>
            {D.list.repeat.map(row)}
            {D.list.repeat.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', padding: '4px 8px 6px' }}>반복 실천이 없어요</span>}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '10px 8px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{rel === 0 ? '오늘 할 일' : '할 일'}</span>
              {D.list.day.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{doneCount} / {dayCount}</span>}
            </div>
            {D.list.day.map(row)}
            {D.list.day.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', padding: '4px 8px 6px', lineHeight: 1.45, textWrap: 'pretty' }}>
                {D.loaded && items.length === 0 && rel <= 1 ? '주간 계획에서 실천을 적으면 여기에 나타나요' : '할 일이 없어요'}
              </span>
            )}
            {(canAdd || (D.loaded && items.length === 0 && rel <= 1)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 2px 2px' }}>
                {D.loaded && items.length === 0 && rel <= 1 && <button onClick={() => navigate(weekPath)} className="btn btn-secondary" style={{ height: 36, ...BODY, fontSize: 12.5, borderRadius: 16, padding: '0 10px' }}>주간 실천 적으러 가기</button>}
                {canAdd && <button onClick={() => setSheet({ k: 'add' })} className="btn add-dashed" style={{ height: 36, border: '2px dashed var(--color-neutral-400)', color: 'var(--color-neutral-800)', ...BODY, fontSize: 12.5, borderRadius: 16, padding: '0 10px' }}>+ 직접 추가</button>}
                {rel === 0 && items.length > 0 && <span data-testid="press-hint" style={{ fontSize: 10.5, color: 'var(--color-neutral-600)', textAlign: 'center', padding: '2px 4px' }}>할 일을 길게 누르면 취소할 수 있어요</span>}
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
                ['actual', '실제 칠하기', rel === 0],
              ] as const
            ).map(([k, label, ok]) => {
              const on = ok && effMode === k;
              return (
                <button key={k} aria-pressed={on} disabled={!ok} onClick={() => setMode(k)} style={{ flex: 1, height: 28, border: 0, borderRadius: 999, cursor: ok ? 'pointer' : 'default', font: 'inherit', fontSize: 11.5, fontWeight: 700, padding: 0, background: on ? (k === 'plan' ? 'var(--color-neutral-700)' : 'var(--color-accent)') : 'var(--color-neutral-100)', color: on ? 'var(--color-neutral-100)' : 'var(--color-text)', opacity: ok ? 1 : 0.45 }}>{label}</button>
              );
            })}
          </div>
          {/* 키워드 붓 줄은 늘 자리를 차지한다 — 계획/실제를 바꿔도 시간표 칸 높이가 그대로 (2026-10-03 기획 피드백) */}
          {(() => { const show = rel === 0 && effMode === 'actual'; return (
            <div data-testid="brush-row" aria-hidden={!show || undefined} inert={!show || undefined} style={{ flex: 'none', height: 22, display: 'flex', gap: 3, paddingLeft: 2, visibility: show ? 'visible' : 'hidden' }}>
              {keywords.map(k => {
                const on = brush === 'kw:' + k.id;
                return (
                  <button key={k.id} aria-pressed={on} aria-label={'키워드 ' + k.name + '로 칠하기'} onClick={() => setBrush('kw:' + k.id)} style={{ flex: 1, minWidth: 0, height: 22, border: 0, borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 10, fontWeight: 700, padding: 0, overflow: 'hidden', whiteSpace: 'nowrap', background: on ? dailyTone.bg : 'var(--color-neutral-100)', color: on ? dailyTone.ink : 'var(--color-text)', boxShadow: on ? 'inset 0 0 0 2px ' + dailyTone.dot : 'none' }}>{k.name}</button>
                );
              })}
            </div>
          ); })()}
          <TimeTable
            dayStart={dayStart}
            mode={effMode}
            canPlan={canPlan}
            canAct={canAct}
            actualUntil={actualUntil}
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
            onDraft={(snap, from, to) => setSheet({ k: 'pick', snap, from, to })}
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
        onClick={async () => {
          if (!canJournal) return;
          // 다른 기기에서 쓴 기록이 있으면 그걸로 연다 (오래 걸리면 기다리지 않음, 2026-10-03 UT 3차)
          await Promise.race([D.reload(), new Promise(res => setTimeout(res, 1500))]);
          setSheet({ k: 'journal' });
        }}
        disabled={!canJournal}
        style={{ flex: 'none', height: 46, border: 0, borderRadius: 999, background: 'var(--color-surface)', cursor: canJournal ? 'pointer' : 'default', font: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 18px', opacity: canJournal ? 1 : 0.55 }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>하루 기록</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12.5, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {jSummary || (rel === 0 ? '오늘을 짧게 남겨요' : rel < 0 ? '남긴 기록이 없어요' : '그날이 되면 쓸 수 있어요')}
        </span>
        <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center' }}><Icon name="chevronUp" size={14} /></span>
      </button>

      {sheet?.k === 'pick' && (() => {
        const pk = sheet;
        const apply = (value: string) => {
          const cells = paint(pk.snap, pk.from, pk.to, value, Array.from({ length: SLOTS }, (_, i) => i > actualUntil));
          setBrush(value); // 이어서 칠할 때도 같은 것으로
          setActual(cells);
          saveActual(cells);
          setSheet(null);
        };
        return (
          <PickSheet
            range={`${timeOf(pk.from, dayStart)} – ${timeOf(pk.to + 1, dayStart)}`}
            todos={items.map(it => { const m = meta(it); return { key: it.key, tag: m.tag, name: m.name, tone: m.tone, on: false }; })}
            keywords={keywords}
            dailyTone={dailyTone}
            onTodo={async key => {
              const it = items.find(x => x.key === key);
              const id = it && (await D.ensureRow(it));
              if (id) apply('task:' + id);
            }}
            onKeyword={id => apply('kw:' + id)}
            onClose={() => { setActual(pk.snap); setSheet(null); }}
          />
        );
      })()}
      {sheet?.k === 'cal' && <CalendarSheet day={day} today={today} onPick={go} onClose={() => setSheet(null)} />}
      {sheet?.k === 'add' && (
        <AddSheet
          keywords={keywords}
          tone={dailyTone}
          goals={goals.filter(g => g.status === 'not_started' || g.status === 'in_progress').map(g => ({ id: g.id, name: g.name, tone: PALETTE[goalCategories.find(c => c.id === g.category_id)?.color ?? 'red'], subs: subgoals.filter(x => x.goal_id === g.id).map(x => ({ id: x.id, name: x.name })) }))}
          onSubmit={async x => {
            if (x.timed) ensurePush(); // 예약 할 일 알람 (R-T3) — 처음 한 번 알림 허락을 받는다
            return D.addDirect(x);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.k === 'journal' && <JournalSheet key={day + (D.journal?.id ?? '')} day={day} journal={journalDraft ?? D.journal} readOnly={rel !== 0} onSave={async j => {
            // 회고 알림(4.6)을 켰으면 이 휴대폰도 알림 받을 곳으로 — 처음 한 번 허락을 받는다
            if (profile?.review_notify_enabled) ensurePush();
            // 시트는 바로 닫고 뒤에서 저장한다 (2026-10-03 UT)
            unsavedJournal = null;
            const ok = await D.saveJournal(j);
            // 못 했으면 쓰던 내용을 남겨 두고 안내만 (다른 화면으로 옮긴 뒤 시트가 갑자기 뜨지 않게, 2026-10-03 UT 2차)
            if (!ok) {
              unsavedJournal = { day, j };
              toast('하루 기록을 저장하지 못했어요. 쓰던 내용은 남아 있어요', { label: '다시 열기', run: () => navigate(day === today ? base : base + '?d=' + day, { state: { journal: true } }) });
            }
            return ok;
          }} onClose={() => setSheet(null)} />}
      {sheet?.k === 'menu' && (
        <TaskMenuSheet
          name={sheet.name}
          canceled={sheet.it.canceled}
          canCancel={canCancelItem(sheet.it)}
          canDelete={canDeleteItem(sheet.it)}
          onCancel={async () => {
            const it = sheet.it;
            setSheet(null);
            if (await D.toggleCancel(it)) toast(it.canceled ? '취소를 풀었어요' : `‘${sheet.name}’을(를) 취소했어요. 내일부터 넘어오지 않아요`);
          }}
          onDelete={() => setSheet({ k: 'del', task: sheet.it.row!, name: sheet.name })}
          onClose={() => setSheet(null)}
        />
      )}
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
