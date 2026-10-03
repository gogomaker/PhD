// 계획 › 목표: 시작하기(5단계) · 나의 꿈 · + 목표 추가 · 카테고리별 목표(진척도 막대) · 마무리한 목표
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount, type Goal } from '../../account/AccountProvider';
import { PALETTE } from '../../lib/palette';
import { userDayKey } from '../../lib/day';
import { dueShort, isClosed, sortGoals } from '../../lib/goals';
import { shortDate } from '../../lib/tracking';
import { ScrollArea } from '../../ui/ScrollArea';
import { BODY, Dot, H, ICON, Svg } from '../ui';
import { useMobile } from '../store';
import { NewGoalSheet, ReviewSheet } from './goalSheets';
import { tutorialDone } from '../../lib/tutorial';
import { DdayRow } from './Dday';
import { useToday } from '../../account/AccountProvider';

export default function GoalsTab() {
  const { profile, goalCategories, goals, subgoals } = useAccount();
  const { progress } = useMobile();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | { k: 'new' } | { k: 'review'; goal: Goal }>(null);
  const loc = useLocation();
  const today = useToday();
  // 체험 모드 끝 → '내 목표 쓰러 가기': 새 목표 시트를 바로 연다 (기록 칸을 비워서 뒤로 가도 다시 안 열리게)
  useEffect(() => {
    if ((loc.state as { newGoal?: boolean } | null)?.newGoal) {
      navigate(loc.pathname, { replace: true, state: null });
      setSheet({ k: 'new' });
    }
  }, [loc, navigate]);
  const dream = profile?.dream?.trim();
  const closed = goals.filter(g => isClosed(g)).sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''));
  const dayOf = (ts: string) => userDayKey(new Date(ts), profile?.timezone, profile?.day_start_hour);

  return (
    <ScrollArea fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <StartSteps onNewGoal={() => setSheet({ k: 'new' })} />

      {/* 나의 꿈 */}
      <button data-testid="dream-card" onClick={() => navigate('/dream')} className="m-dream" style={{ position: 'relative', overflow: 'hidden', flex: 'none', border: 0, cursor: 'pointer', textAlign: 'left', ...BODY, fontWeight: 400, background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', borderRadius: 28, padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span aria-hidden="true" style={{ position: 'absolute', right: -34, bottom: -48, width: 130, height: 130, borderRadius: '50%', background: 'var(--color-accent-2-300)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', right: 58, top: 14, width: 26, height: 26, borderRadius: '50%', background: 'var(--color-accent-300)' }} />
        <span style={{ position: 'relative', fontSize: 12, fontWeight: 700 }}>나의 꿈</span>
        {dream ? (
          <span style={{ position: 'relative', ...H, fontSize: 23, lineHeight: 1.25, maxWidth: 250, textWrap: 'pretty', wordBreak: 'keep-all' }}>{dream}</span>
        ) : (
          <span style={{ position: 'relative', fontSize: 14.5, fontWeight: 700, lineHeight: 1.4 }}>아직 꿈을 적지 않았어요 · 쓰기</span>
        )}
      </button>

      <DdayRow today={today} />

      <button onClick={() => setSheet({ k: 'new' })} className="btn btn-primary" style={{ flex: 'none', height: 48, gap: 8, fontSize: 15, marginTop: -8 }}>
        <Svg d={ICON.plus} size={15} width={3} />목표 추가
      </button>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 4px', marginBottom: -10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>카테고리별 목표</span>
        <button onClick={() => navigate('/categories')} className="btn btn-ghost" style={{ height: 32, padding: '0 12px', ...BODY, fontSize: 12.5 }}>카테고리 편집</button>
      </div>

      {goalCategories.map(c => {
        const t = PALETTE[c.color];
        const list = sortGoals(goals.filter(g => g.category_id === c.id && !isClosed(g)));
        return (
          <section key={c.id} data-testid="goal-group" aria-label={c.name} style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px', minWidth: 0 }}>
              <Dot color={t.dot} size={10} />
              <span style={{ flex: 'none', fontWeight: 700, fontSize: 15 }}>{c.name}</span>
              <span style={{ minWidth: 0, fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.aspiration}</span>
            </div>
            {list.map(g => {
              const pct = progress[g.id] ?? 0;
              const subs = subgoals.filter(s => s.goal_id === g.id);
              return (
                <button key={g.id} data-testid="goal-card" onClick={() => navigate('/goal/' + g.id)} className="m-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer', ...BODY, fontWeight: 400, color: 'var(--color-text)', background: 'var(--color-surface)', borderRadius: 24, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15.5, textWrap: 'pretty' }}>{g.name}</span>
                    {g.status === 'not_started' && <span className="tag tag-neutral" style={{ flex: 'none', fontWeight: 700 }}>시작 전</span>}
                    <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{dueShort(g.due_month)}까지</span>
                  </div>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div role="progressbar" aria-label={g.name + ' 진척도'} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--color-bg)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', borderRadius: 99, background: t.dot }} />
                    </div>
                    <span data-testid="goal-progress" style={{ flex: 'none', width: 44, textAlign: 'right', ...H, fontSize: 15 }}>{pct}%</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', lineHeight: 1.4 }}>{subs.length ? subs.map(s => s.name).join(' · ') : '세부 목표를 아직 나누지 않았어요'}</span>
                </button>
              );
            })}
            {list.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--color-neutral-600)', padding: '2px 6px' }}>아직 목표가 없어요</span>}
          </section>
        );
      })}

      {closed.length > 0 && (
        <section aria-label="마무리한 목표" style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)', padding: '0 4px' }}>마무리한 목표</span>
          {closed.map(g => {
            const t = PALETTE[goalCategories.find(c => c.id === g.category_id)?.color ?? 'red'];
            const done = g.status === 'completed';
            return (
              <button key={g.id} data-testid="closed-goal" onClick={() => setSheet({ k: 'review', goal: g })} className="m-card" style={{ border: 0, cursor: 'pointer', textAlign: 'left', ...BODY, fontWeight: 400, color: 'var(--color-text)', background: 'transparent', boxShadow: 'inset 0 0 0 2px var(--color-surface)', borderRadius: 22, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Dot color={t.dot} />
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: done ? t.ink : 'var(--color-neutral-300)', color: done ? 'var(--color-bg)' : 'var(--color-neutral-800)' }}>{done ? '완성' : '중도 마무리'}</span>
                {g.finished_at && <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--color-neutral-700)' }}>{shortDate(dayOf(g.finished_at))}</span>}
              </button>
            );
          })}
        </section>
      )}

      {sheet?.k === 'new' && <NewGoalSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'review' && <ReviewSheet goal={sheet.goal} onClose={() => setSheet(null)} />}
    </ScrollArea>
  );
}

// 시작하기 (2026-10-02 기획 결정: 목업의 5단계). 모두 마치면 사라진다
function StartSteps({ onNewGoal }: { onNewGoal: () => void }) {
  const { profile, goals, subgoals, practices } = useAccount();
  const { recorded } = useMobile();
  const navigate = useNavigate();
  const open = goals.filter(g => !isClosed(g));
  const target = open.find(g => !subgoals.some(s => s.goal_id === g.id)) ?? open[0];
  // 체험해 보기는 이 기기에 기억한다 (데모라 계정에 남기지 않음)
  const tried = tutorialDone();
  const steps: [string, boolean, () => void][] = [
    ['체험해 보기 (3분, 저장 안 됨)', tried, () => navigate('/tutorial')],
    ['꿈 한 문장 적기', !!profile?.dream?.trim(), () => navigate('/dream')],
    ['첫 목표 만들기', goals.length > 0, onNewGoal],
    ['세부 목표로 나누기', subgoals.length > 0, () => (target ? navigate('/goal/' + target.id) : onNewGoal())],
    ['이번 주 실천 적기', practices.length > 0, () => navigate('/plan/schedule?z=week')],
    ['오늘 첫 기록 남기기', !!recorded, () => navigate('/record')],
  ];
  const next = steps.findIndex(s => !s[1]);
  // 앞 단계를 다 했는데 기록 여부를 아직 모르면 잠깐 숨긴다 (다 마친 사람에게 깜빡이지 않게)
  if (next < 0 || (next === steps.length - 1 && recorded === null)) return null;
  const done = steps.filter(s => s[1]).length;
  return (
    <div data-testid="start-checklist" style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 26, padding: '14px 12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>시작하기</span>
        <span data-testid="checklist-count" style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-700)' }}>{done} / {steps.length}</span>
      </div>
      {steps.map(([label, ok, go], i) => (
        <button key={label} data-done={ok} onClick={go} className="m-hover" style={{ border: 0, background: 'transparent', cursor: 'pointer', ...BODY, fontWeight: ok ? 500 : i === next ? 700 : 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 14, textAlign: 'left', fontSize: 13.5, opacity: ok ? 0.6 : 1 }}>
          <span style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid ' + (ok ? 'var(--color-accent-2)' : i === next ? 'var(--color-accent)' : 'var(--color-neutral-400)'), background: ok ? 'var(--color-accent-2)' : 'transparent', display: 'grid', placeItems: 'center', color: 'var(--color-bg)' }}>
            {ok && <Svg d={ICON.check} size={10} width={4} />}
          </span>
          <span style={{ flex: 1, textDecoration: ok ? 'line-through' : 'none' }}>{label}</span>
          <Svg d={ICON.right} size={14} style={{ color: 'var(--color-neutral-500)' }} />
        </button>
      ))}
    </div>
  );
}
