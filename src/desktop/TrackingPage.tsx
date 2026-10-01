import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { useAccount, useToday, type Goal } from '../account/AccountProvider';
import { PALETTE } from '../lib/palette';
import { addDays, dayLabel, userDayKey, type DayKey } from '../lib/day';
import { isClosed, sortGoals, STATUS_LABEL } from '../lib/goals';
import { hours, periodFromKey, periodLabel, periodOf, periodTitle, rate, shiftPeriod, type Period, type Range } from '../lib/tracking';
import { ICONS, Svg } from './plan/shared';

const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');
const PILL = { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 } as const;
const CARD = { background: 'var(--color-surface)', borderRadius: 32, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 18 } as const;
// 하루 점수 1~5 → 색 농도 (목업 SCORE_BG)
const SCORE_BG = ['var(--color-accent-200)', 'var(--color-accent-300)', 'var(--color-accent-400)', 'var(--color-accent-500)', 'var(--color-accent-700)'];
const HEADS = ['일', '월', '화', '수', '목', '금', '토'];

type Summary = { planned: number; actual: number; plan_unlinked: number; goals: { goal_id: string; planned: number; actual: number }[] };
type Total = { goal_id: string; actual_slots: number; done_tasks: number; first_day: string | null };
type Progress = { goal_id: string; percent: number; created_at: string };
type DayScore = { date: string; score: number | null; reason: string };

// 트래킹 (SPEC 4.7): 주간/월간. 숫자 → 목표별 계획 대비 실제 → 진척도 → 하루 점수 → 누적 시간
export default function TrackingPage() {
  const { goals, goalCategories, profile, toast } = useAccount();
  const today = useToday();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const range: Range = params.get('r') === 'month' ? 'month' : 'week';
  const key = params.get('k');
  const period = key ? periodFromKey(range, key) : periodOf(range, today);
  const isCurrent = period.key === periodOf(range, today).key;
  const go = (p: Period) => setParams({ r: p.range, k: p.key }, { replace: true });

  const [sum, setSum] = useState<Summary | null>(null);
  const [scores, setScores] = useState<DayScore[]>([]);
  const [totals, setTotals] = useState<Total[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [hasAny, setHasAny] = useState<boolean | null>(null);

  // 기간마다
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

  // 한 번만: 누적, 진척도, 기록이 하나라도 있는지
  useEffect(() => {
    Promise.all([
      supabase.rpc('goal_totals'),
      supabase.from('goal_progress').select('goal_id, percent, created_at').order('created_at', { ascending: false }),
      supabase.from('time_blocks').select('id', { count: 'exact', head: true }),
      supabase.from('day_journals').select('id', { count: 'exact', head: true }),
    ]).then(([t, p, b, j]) => {
      const err = t.error ?? p.error ?? b.error ?? j.error;
      if (err) return toast(errorText(err));
      setTotals(t.data as Total[]);
      setProgress(p.data as Progress[]);
      setHasAny((b.count ?? 0) + (j.count ?? 0) > 0);
    });
  }, [toast]);

  // 카테고리 순서 → 카테고리 안 순서
  const ordered = useMemo(() => goalCategories.flatMap(c => sortGoals(goals.filter(g => g.category_id === c.id))), [goals, goalCategories]);
  const toneOf = (g: Goal) => PALETTE[goalCategories.find(c => c.id === g.category_id)?.color ?? 'red'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="tag tag-accent-2" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>트래킹 · {periodLabel(period)}</span>
          <h1 style={{ margin: 0, fontSize: 42 }}>{periodTitle(period, today)}</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>모바일 하루 플래너에서 칠한 10분 칸을 목표별로 모았어요.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-icon" aria-label={range === 'week' ? '지난주' : '지난달'} title={range === 'week' ? '지난주' : '지난달'} onClick={() => go(shiftPeriod(period, -1))} style={{ color: 'var(--color-neutral-700)' }}><Svg d={ICONS.left} size={18} /></button>
          <button className="btn btn-icon" aria-label={range === 'week' ? '다음 주' : '다음 달'} title={range === 'week' ? '다음 주' : '다음 달'} disabled={isCurrent} onClick={() => go(shiftPeriod(period, 1))} style={{ color: 'var(--color-neutral-700)', opacity: isCurrent ? 0.3 : 1 }}><Svg d={ICONS.right} size={18} /></button>
          {!isCurrent && <button className="btn btn-secondary" onClick={() => go(periodOf(range, today))} style={{ ...PILL, fontSize: 12.5, height: 32, padding: '0 12px' }}>{range === 'week' ? '이번 주' : '이번 달'}</button>}
          <span style={{ width: 8 }} />
          {(['week', 'month'] as const).map(r => (
            <button key={r} className={pill(range === r)} aria-pressed={range === r} onClick={() => go(periodOf(r, period.from <= today && today <= period.to ? today : period.from))} style={PILL}>{r === 'week' ? '주간' : '월간'}</button>
          ))}
        </div>
      </div>

      {hasAny === false ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', borderRadius: 28, padding: '20px 24px' }}>
          <span style={{ fontSize: 15, fontWeight: 600, textWrap: 'pretty' }}>모바일에서 시간을 칠하면 여기에 쌓여요</span>
          <button className="btn btn-primary" onClick={() => navigate('/plan/week')}>주간 실천 적기</button>
        </div>
      ) : (
        <>
          <Stats sum={sum} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, alignItems: 'start' }}>
            <VsCard sum={sum} goals={ordered.filter(g => g.status === 'in_progress' || sum?.goals.some(x => x.goal_id === g.id))} toneOf={toneOf} />
            <ProgressCard goals={ordered.filter(g => !isClosed(g))} toneOf={toneOf} progress={progress} onSaved={p => setProgress(ps => [p, ...ps].sort((a, b) => b.created_at.localeCompare(a.created_at)))} tz={profile?.timezone} dayStart={profile?.day_start_hour} />
          </div>
          <ScoreCard period={period} today={today} scores={scores} isCurrent={isCurrent} />
          <CumulativeCard goals={ordered} totals={totals} toneOf={toneOf} />
        </>
      )}
    </div>
  );
}

type Tone = (typeof PALETTE)['red'];

function Stats({ sum }: { sum: Summary | null }) {
  const r = sum ? rate(sum.planned, sum.actual) : null;
  const tile = { flex: '1 1 200px', background: 'var(--color-surface)', borderRadius: 28, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 } as const;
  const big = { fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 40, lineHeight: 1.1 } as const;
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} data-testid="track-stats">
      <div style={tile}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>계획한 시간</span>
        <span style={big}>{sum ? hours(sum.planned) : '–'}h</span>
      </div>
      <div style={tile}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>실제로 쓴 시간</span>
        <span style={big}>{sum ? hours(sum.actual) : '–'}h</span>
      </div>
      <div style={{ ...tile, background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>계획 대비 실행</span>
        <span style={big}>{r === null ? '–' : r + '%'}</span>
      </div>
    </div>
  );
}

function GoalName({ g, tone }: { g: Goal; tone: Tone }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>
      <span style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: tone.dot }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
    </span>
  );
}

// 4.7-2: 목표별 계획은 할 일과 연결된 계획 블록만. 키워드만 적은 계획은 전체 계획에만
function VsCard({ sum, goals, toneOf }: { sum: Summary | null; goals: Goal[]; toneOf: (g: Goal) => Tone }) {
  const rows = goals.map(g => {
    const x = sum?.goals.find(s => s.goal_id === g.id);
    return { g, planned: x?.planned ?? 0, actual: x?.actual ?? 0 };
  });
  const max = Math.max(1, ...rows.map(r => Math.max(r.planned, r.actual)));
  return (
    <div style={CARD} data-testid="track-vs">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 22 }}>목표별 계획 대비 실제</h3>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--color-neutral-700)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 8, borderRadius: 99, border: '2px solid var(--color-neutral-500)' }} />계획</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 8, borderRadius: 99, background: 'var(--color-neutral-700)' }} />실제</span>
        </div>
      </div>
      {rows.length === 0 && <span style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>진행 중인 목표가 없어요.</span>}
      {rows.map(({ g, planned, actual }) => {
        const d = (actual - planned) / 6;
        const tone = toneOf(g);
        return (
          <div key={g.id} data-testid="vs-row" style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 104px', alignItems: 'center', gap: 14 }}>
            <GoalName g={g} tone={tone} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 10, width: (planned / max) * 100 + '%', borderRadius: 99, border: planned ? '2px solid var(--color-neutral-500)' : 0, boxSizing: 'border-box' }} />
              <div style={{ height: 10, width: (actual / max) * 100 + '%', borderRadius: 99, background: tone.dot }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }} data-testid="vs-hours">{hours(actual)}/{hours(planned)}h</span>
              <span className={d >= 0 ? 'tag tag-accent-2' : 'tag tag-accent'} style={{ fontWeight: 700, padding: '2px 7px', whiteSpace: 'nowrap' }}>{(d >= 0 ? '+' : '−') + hours(Math.abs(actual - planned))}h</span>
            </div>
          </div>
        );
      })}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-700)', textWrap: 'pretty' }} data-testid="vs-note">
        계획 시간은 모바일 계획 블록 중 할 일과 연결된 것만 셌어요. 키워드만 적은 계획과 예약 할 일 {sum ? hours(sum.plan_unlinked) : '–'}시간은 전체 계획에만 포함돼요.
      </p>
    </div>
  );
}

function ProgressCard({ goals, toneOf, progress, onSaved, tz, dayStart }: { goals: Goal[]; toneOf: (g: Goal) => Tone; progress: Progress[]; onSaved: (p: Progress) => void; tz?: string; dayStart?: number }) {
  return (
    <div style={CARD} data-testid="track-progress">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 style={{ margin: 0, fontSize: 22 }}>목표별 진척도</h3>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>시간과 따로, 스스로 느끼는 진척을 직접 조절해요.</span>
      </div>
      {goals.length === 0 && <span style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>아직 마무리하지 않은 목표가 없어요.</span>}
      {goals.map(g => {
        const last = progress.find(p => p.goal_id === g.id);
        return <ProgressRow key={g.id} g={g} tone={toneOf(g)} last={last} onSaved={onSaved} tz={tz} dayStart={dayStart} />;
      })}
    </div>
  );
}

function ProgressRow({ g, tone, last, onSaved, tz, dayStart }: { g: Goal; tone: Tone; last?: Progress; onSaved: (p: Progress) => void; tz?: string; dayStart?: number }) {
  const { toast } = useAccount();
  const [v, setV] = useState(last?.percent ?? 0);
  const sent = useRef(last?.percent ?? 0);
  const timer = useRef<number | undefined>(undefined);
  // 손을 떼면 한 번 저장 (바뀐 기록을 남긴다). 키보드는 잠깐 멈췄을 때
  const commit = async () => {
    window.clearTimeout(timer.current);
    if (v === sent.current) return;
    const before = sent.current;
    sent.current = v;
    const { data, error } = await supabase.from('goal_progress').insert({ goal_id: g.id, percent: v }).select('goal_id, percent, created_at').single();
    if (error) {
      toast(errorText(error));
      sent.current = before;
      setV(before);
      return;
    }
    onSaved(data as Progress);
  };
  const edited = last ? dayLabel(userDayKey(new Date(last.created_at), tz, dayStart)).md + ' 수정' : '아직 조절하지 않았어요';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 52px', alignItems: 'center', columnGap: 14 }}>
      <GoalName g={g} tone={tone} />
      <input
        type="range"
        className="progress-range"
        min={0}
        max={100}
        step={5}
        value={v}
        onChange={e => setV(+e.target.value)}
        onPointerUp={commit}
        onKeyUp={() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(commit, 600); }}
        onBlur={commit}
        aria-label={g.name + ' 진척도'}
        style={{ width: '100%', '--fill': tone.dot, '--pct': v + '%' } as CSSProperties}
      />
      <span style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>{v}%</span>
      <span style={{ gridColumn: '2 / span 2', fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{edited}</span>
    </div>
  );
}

function ScoreCard({ period, today, scores, isCurrent }: { period: Period; today: DayKey; scores: DayScore[]; isCurrent: boolean }) {
  const days: DayKey[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) days.push(d);
  const lead = new Date(period.from + 'T00:00:00Z').getUTCDay();
  const scoreOf = (d: DayKey) => scores.find(s => s.date === d && s.score != null);
  const withScore = scores.filter(s => s.score != null);
  const avg = withScore.length ? (withScore.reduce((a, s) => a + s.score!, 0) / withScore.length).toFixed(1) : null;
  const scope = period.range === 'week' ? (isCurrent ? '이번 주' : '이 주') : isCurrent ? '이번 달' : '이 달';
  const fallback = today >= period.from && today <= period.to ? today : period.to < today ? period.to : period.from;
  const [sel, setSel] = useState<DayKey | null>(null);
  const picked = sel && sel >= period.from && sel <= period.to ? sel : fallback;
  const ps = scoreOf(picked);
  const pl = dayLabel(picked);
  return (
    <div style={CARD} data-testid="track-score">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 22 }}>하루 점수</h3>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent-700)' }}>{avg ? `${scope} 평균 ${avg}점` : `${scope}는 아직 점수가 없어요`}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--color-neutral-700)' }}>
          1{SCORE_BG.map(bg => <span key={bg} style={{ width: 16, height: 16, borderRadius: 5, background: bg }} />)}5점
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 360px', maxWidth: 480, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6 }}>
          {HEADS.map(h => <span key={h} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{h}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
          {days.map(d => {
            const s = scoreOf(d)?.score ?? null;
            const future = d > today;
            const on = d === picked;
            const l = dayLabel(d);
            return (
              <button
                key={d}
                disabled={future}
                aria-pressed={on}
                aria-label={`${l.md} ${s ? s + '점' : '점수 없음'}`}
                data-testid="score-day"
                onClick={() => setSel(d)}
                style={{ minHeight: 44, border: 0, borderRadius: 14, cursor: future ? 'default' : 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700, background: s ? SCORE_BG[s - 1] : future ? 'transparent' : 'var(--color-neutral-100)', color: s ? (s >= 4 ? 'var(--color-neutral-100)' : 'var(--color-accent-900)') : 'var(--color-neutral-500)', boxShadow: on ? '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text)' : 'none' }}
              >
                {period.range === 'week' ? l.md : Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <div style={{ flex: '1 1 220px', background: 'var(--color-neutral-100)', borderRadius: 24, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="score-detail">
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{Number(picked.slice(5, 7))}월 {Number(picked.slice(8))}일 ({pl.dow})</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 36, lineHeight: 1.1 }}>{ps ? ps.score + '점' : '–'}</span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, textWrap: 'pretty', color: ps?.reason ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>{ps ? ps.reason || '이유를 적지 않았어요' : '이날은 하루 기록이 없어요'}</p>
        </div>
      </div>
    </div>
  );
}

function CumulativeCard({ goals, totals, toneOf }: { goals: Goal[]; totals: Total[]; toneOf: (g: Goal) => Tone }) {
  const rows = goals
    .map(g => ({ g, t: totals.find(t => t.goal_id === g.id) }))
    .filter(({ g, t }) => (t?.actual_slots ?? 0) > 0 || g.status === 'in_progress')
    .sort((a, b) => (b.t?.actual_slots ?? 0) - (a.t?.actual_slots ?? 0));
  const max = Math.max(1, ...rows.map(r => r.t?.actual_slots ?? 0));
  const first = totals.map(t => t.first_day).filter(Boolean).sort()[0];
  return (
    <div style={CARD} data-testid="track-cum">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 style={{ margin: 0, fontSize: 22 }}>목표별 누적 시간</h3>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{first ? `${first.slice(0, 4)}년 ${Number(first.slice(5, 7))}월 시작부터 지금까지` : '아직 목표에 칠한 시간이 없어요'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px 32px' }}>
        {rows.map(({ g, t }) => {
          const tone = toneOf(g);
          const n = t?.actual_slots ?? 0;
          return (
            <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <GoalName g={g} tone={tone} />
                  {isClosed(g) && <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{STATUS_LABEL[g.status]}</span>}
                </span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>{hours(n)}h</span>
              </div>
              <div style={{ height: 14, borderRadius: 99, background: 'var(--color-neutral-100)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (n / max) * 100 + '%', borderRadius: 99, background: tone.dot }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
