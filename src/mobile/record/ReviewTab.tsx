// 기록 › 돌아보기 (SPEC 4.7): 주간·월간 숫자 → 목표별 계획 대비 실제 → 하루 점수 달력
// 진척도와 누적 시간은 목표 편집 화면에서 (docs/MOBILE.md)
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { errorText } from '../../lib/errors';
import { useAccount, useToday, type Goal } from '../../account/AccountProvider';
import { PALETTE } from '../../lib/palette';
import { addDays, dayLabel, type DayKey } from '../../lib/day';
import { isClosed, sortGoals } from '../../lib/goals';
import { hours, periodFromKey, periodLabel, periodOf, rate, shiftPeriod, type Period, type Range } from '../../lib/tracking';
import { md } from '../../lib/plan';
import { ScrollArea } from '../../ui/ScrollArea';
import { BODY, Dot, H, ICON, Seg, Svg } from '../ui';

type Summary = { planned: number; actual: number; plan_unlinked: number; goals: { goal_id: string; planned: number; actual: number }[] };
type DayScore = { date: string; score: number | null; reason: string };
// 하루 점수 1~5 → 색 농도
const SCORE_BG = ['var(--color-accent-200)', 'var(--color-accent-300)', 'var(--color-accent-400)', 'var(--color-accent-500)', 'var(--color-accent-700)'];
const HEADS = ['일', '월', '화', '수', '목', '금', '토'];
const CARD = { flex: 'none', background: 'var(--color-surface)', borderRadius: 28, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 } as const;

export default function ReviewTab() {
  const { goals, goalCategories, toast } = useAccount();
  const today = useToday();
  const loc = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(loc.search);
  const range: Range = q.get('r') === 'month' ? 'month' : 'week';
  const key = q.get('k');
  const period = key && (range === 'week' ? /^\d{4}-\d{2}-\d{2}$/.test(key) : /^\d{4}-\d{2}$/.test(key)) ? periodFromKey(range, key) : periodOf(range, today);
  const isCurrent = period.key === periodOf(range, today).key;
  const go = (p: Period) => {
    const cur = periodOf(p.range, today).key === p.key;
    const s = new URLSearchParams();
    if (p.range === 'month') s.set('r', 'month');
    if (!cur) s.set('k', p.key);
    navigate('/record/review' + (s.toString() ? '?' + s : ''), { replace: true });
  };

  const [sum, setSum] = useState<Summary | null>(null);
  const [scores, setScores] = useState<DayScore[]>([]);
  useEffect(() => {
    let live = true;
    setSum(null);
    Promise.all([
      supabase.rpc('tracking_summary', { p_from: period.from, p_to: period.to }),
      supabase.from('day_journals').select('date, score, reason').gte('date', period.from).lte('date', period.to),
    ]).then(([s, j]) => {
      if (!live) return;
      if (s.error || j.error) return toast(errorText(s.error ?? j.error));
      setSum(s.data as Summary);
      setScores(j.data as DayScore[]);
    });
    return () => { live = false; };
  }, [period.from, period.to, toast]);

  const ordered = useMemo(() => goalCategories.flatMap(c => sortGoals(goals.filter(g => g.category_id === c.id))), [goals, goalCategories]);
  const toneOf = (g: Goal) => PALETTE[goalCategories.find(c => c.id === g.category_id)?.color ?? 'red'];
  const r = sum ? rate(sum.planned, sum.actual) : null;
  const tile = { background: 'var(--color-surface)', borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } as const;
  const big = { ...H, fontSize: 24, lineHeight: 1.1, whiteSpace: 'nowrap' } as const;

  return (
    <ScrollArea data-testid="review-tab" fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Seg tone="accent" options={[['week', '주간'], ['month', '월간']] as [Range, string][]} cur={range} onPick={rr => go(periodOf(rr, period.from <= today && today <= period.to ? today : period.from))} label="기간 단위" />
        <div style={{ flex: 1 }} />
        <button onClick={() => go(shiftPeriod(period, -1))} aria-label={range === 'week' ? '지난주' : '지난달'} className="btn m-hover" style={{ width: 34, height: 34, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={ICON.left} /></button>
        <button onClick={() => go(shiftPeriod(period, 1))} disabled={isCurrent} aria-label={range === 'week' ? '다음 주' : '다음 달'} className="btn m-hover" style={{ width: 34, height: 34, padding: 0, color: 'var(--color-neutral-700)', opacity: isCurrent ? 0.3 : 1 }}><Svg d={ICON.right} /></button>
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 6px', marginTop: -4 }}>
        <span data-testid="review-title" style={{ ...H, fontSize: 19 }}>{isCurrent ? (range === 'week' ? '이번 주' : '이번 달') : periodLabel(period)}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{range === 'week' ? `${md(period.from)} – ${md(period.to)}` : isCurrent ? periodLabel(period) : ''}</span>
        {!isCurrent && <button onClick={() => go(periodOf(range, today))} className="btn btn-secondary" style={{ marginLeft: 'auto', height: 28, padding: '0 10px', ...BODY, fontSize: 12 }}>{range === 'week' ? '이번 주' : '이번 달'}</button>}
      </div>

      <div data-testid="track-stats" style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
        <div style={tile}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>계획</span><span style={big}>{sum ? hours(sum.planned) : '–'}h</span></div>
        <div style={tile}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>실제</span><span style={big}>{sum ? hours(sum.actual) : '–'}h</span></div>
        <div style={{ ...tile, background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }}><span style={{ fontSize: 12, fontWeight: 600 }}>실행률</span><span style={big}>{r === null ? '–' : r + '%'}</span></div>
      </div>

      <GoalTimes sum={sum} goals={ordered.filter(g => g.status === 'in_progress' || sum?.goals.some(x => x.goal_id === g.id && (x.planned || x.actual)))} toneOf={toneOf} />
      <Scores period={period} today={today} scores={scores} isCurrent={isCurrent} />
    </ScrollArea>
  );
}

// 4.7-2: 목표별 계획은 할 일과 연결된 계획 블록만 센다
function GoalTimes({ sum, goals, toneOf }: { sum: Summary | null; goals: Goal[]; toneOf: (g: Goal) => (typeof PALETTE)['red'] }) {
  const rows = goals.map(g => {
    const x = sum?.goals.find(s => s.goal_id === g.id);
    return { g, planned: x?.planned ?? 0, actual: x?.actual ?? 0 };
  });
  const max = Math.max(1, ...rows.map(r => Math.max(r.planned, r.actual)));
  const empty = !!sum && sum.planned === 0 && sum.actual === 0;
  return (
    <div data-testid="track-vs" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 19 }}>목표별 시간</h3>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--color-neutral-700)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 7, borderRadius: 99, border: '2px solid var(--color-neutral-500)' }} />계획</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 7, borderRadius: 99, background: 'var(--color-neutral-700)' }} />실제</span>
        </div>
      </div>
      {empty || rows.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>아직 쌓인 기록이 없어요. 오늘 탭에서 할 일을 고르고 시간을 칠하면 목표별로 모여요.</span>
      ) : (
        rows.map(({ g, planned, actual }) => {
          const tone = toneOf(g);
          return (
            <div key={g.id} data-testid="vs-row" style={{ display: 'grid', gridTemplateColumns: '88px minmax(0,1fr) 62px', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, minWidth: 0 }}><Dot color={tone.dot} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: isClosed(g) ? 0.6 : 1 }}>{g.name}</span></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ height: 8, width: (planned / max) * 100 + '%', borderRadius: 99, border: planned ? '2px solid var(--color-neutral-500)' : 0, boxSizing: 'border-box' }} />
                <div style={{ height: 8, width: (actual / max) * 100 + '%', borderRadius: 99, background: tone.dot }} />
              </div>
              <span data-testid="vs-hours" style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{hours(actual)} / {hours(planned)}h</span>
            </div>
          );
        })
      )}
      {!empty && rows.length > 0 && (
        <span data-testid="vs-note" style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
          목표별 계획은 할 일과 연결한 계획 블록만 셌어요. 키워드만 적은 계획과 예약 할 일({sum ? hours(sum.plan_unlinked) : '–'}시간)은 전체 계획에만 들어가요.
        </span>
      )}
    </div>
  );
}

function Scores({ period, today, scores, isCurrent }: { period: Period; today: DayKey; scores: DayScore[]; isCurrent: boolean }) {
  const days: DayKey[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) days.push(d);
  const lead = new Date(period.from + 'T00:00:00Z').getUTCDay();
  const scoreOf = (d: DayKey) => scores.find(s => s.date === d && s.score != null);
  const withScore = scores.filter(s => s.score != null);
  const avg = withScore.length ? (withScore.reduce((a, s) => a + s.score!, 0) / withScore.length).toFixed(1) : null;
  const fallback = today >= period.from && today <= period.to ? today : period.to < today ? period.to : period.from;
  const [sel, setSel] = useState<DayKey | null>(null);
  const picked = sel && sel >= period.from && sel <= period.to ? sel : fallback;
  const ps = scoreOf(picked);
  const pl = dayLabel(picked);
  const scope = period.range === 'week' ? (isCurrent ? '이번 주' : '이 주') : isCurrent ? '이번 달' : '이 달';
  return (
    <div data-testid="track-score" style={{ ...CARD, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 19 }}>하루 점수</h3>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent-700)' }}>{avg ? `평균 ${avg}점` : `${scope}는 아직 점수가 없어요`}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>
        {HEADS.map(h => <span key={h} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{h}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
        {days.map(d => {
          const s = scoreOf(d)?.score ?? null;
          const future = d > today;
          const on = d === picked;
          const l = dayLabel(d);
          return (
            <button
              key={d}
              data-testid="score-day"
              disabled={future}
              aria-pressed={on}
              aria-label={`${l.md} ${s ? s + '점' : '점수 없음'}`}
              onClick={() => setSel(d)}
              style={{ height: 38, border: 0, borderRadius: 12, cursor: future ? 'default' : 'pointer', ...BODY, fontSize: 12, background: s ? SCORE_BG[s - 1] : future ? 'transparent' : 'var(--color-bg)', color: s ? (s >= 4 ? 'var(--color-neutral-100)' : 'var(--color-accent-900)') : 'var(--color-neutral-500)', boxShadow: on ? '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text)' : d === today ? 'inset 0 0 0 2px var(--color-accent)' : 'none', opacity: future ? 0.5 : 1 }}
            >
              {period.range === 'week' || Number(d.slice(8)) === 1 ? l.md : Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <div data-testid="score-detail" style={{ background: 'var(--color-bg)', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ ...H, fontSize: 24, lineHeight: 1.1 }}>{ps ? ps.score + '점' : '–'}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{Number(picked.slice(5, 7))}월 {Number(picked.slice(8))}일 ({pl.dow})</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, textWrap: 'pretty', color: ps?.reason ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>{ps ? ps.reason || '이유를 적지 않았어요' : '이날은 하루 기록이 없어요'}</p>
      </div>
    </div>
  );
}
