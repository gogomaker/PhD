import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount } from '../account/AccountProvider';
import { tutorialDone } from '../lib/tutorial';

// 시작 체크리스트 (SPEC 5장): 사이드바 위. 모두 마치면 사라진다
// 휴대폰과 같은 6단계 — PC에도 '오늘'이 생겨 첫 기록도 PC에서 할 수 있다 (2026-10-03 UT)
export function StartChecklist() {
  const { session, profile, goals, subgoals, practices } = useAccount();
  const navigate = useNavigate();
  const loc = useLocation(); // 체험을 마치고 돌아오면 다시 그린다 (체험 여부는 이 기기에 기억)
  const [recorded, setRecorded] = useState<boolean | null>(null);
  // 첫 기록 = 할 일 체크 또는 실제 시간 칠하기 (휴대폰과 같음). 화면을 옮기거나 창으로 돌아오면 다시 본다
  useEffect(() => {
    if (!session || recorded) return;
    let live = true;
    const check = async () => {
      const [t, b] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).not('done_at', 'is', null),
        supabase.from('time_blocks').select('id', { count: 'exact', head: true }).eq('layer', 'actual'),
      ]);
      if (live && !t.error && !b.error) setRecorded((t.count ?? 0) + (b.count ?? 0) > 0);
    };
    check();
    window.addEventListener('focus', check);
    return () => { live = false; window.removeEventListener('focus', check); };
  }, [session, recorded, loc.pathname]);

  const steps: [string, boolean, string][] = [
    ['체험해 보기 (3분, 저장 안 됨)', tutorialDone(), '/tutorial'],
    ['꿈 한 문장 적기', !!profile?.dream?.trim(), '/dream'],
    ['첫 목표 적기', goals.length > 0, '/goals'],
    ['세부목표로 나누기', subgoals.length > 0, '/board'],
    ['이번 주 실천 적기', practices.length > 0, '/plan/week'],
    ['오늘 첫 기록 남기기', !!recorded, '/today'],
  ];
  const next = steps.findIndex(x => !x[1]);
  // 앞 단계를 다 했는데 기록 여부를 아직 모르면 잠깐 숨긴다 (다 마친 사람에게 깜빡이지 않게)
  if (next < 0 || (next === steps.length - 1 && recorded === null)) return null;
  const done = steps.filter(x => x[1]).length;

  return (
    <div data-testid="start-checklist" style={{ background: 'var(--color-neutral-100)', borderRadius: 22, padding: '12px 10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 6px 4px' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>시작하기</span>
        <span data-testid="checklist-count" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent-700)' }}>{done} / {steps.length}</span>
      </div>
      {steps.map(([label, ok, to], i) => {
        const isNext = i === next;
        return (
          <button
            key={label}
            className="checklist-step"
            data-done={ok}
            onClick={() => navigate(to)}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 6px', borderRadius: 10, textAlign: 'left', fontSize: 12.5, fontWeight: isNext ? 700 : 600, opacity: ok || isNext ? 1 : 0.6 }}
          >
            <span style={{ flex: 'none', marginTop: 2, width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid ' + (ok ? 'var(--color-accent-2)' : isNext ? 'var(--color-accent)' : 'var(--color-neutral-400)'), background: ok ? 'var(--color-accent-2)' : 'transparent', display: 'grid', placeItems: 'center', color: 'var(--color-neutral-100)' }}>
              {ok && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ textDecoration: ok ? 'line-through' : 'none' }}>{label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
