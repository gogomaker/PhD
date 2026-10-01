import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount } from '../account/AccountProvider';

// 시작 체크리스트 (SPEC 5장): 사이드바 위. 모두 마치면 사라진다
// 모바일 첫 기록 = 할 일 체크 또는 실제 시간 칠하기 (2026-10-01 기획 결정)
export function StartChecklist() {
  const { session, goals, subgoals, yearCells, monthCells, practices } = useAccount();
  const navigate = useNavigate();
  const [recorded, setRecorded] = useState<boolean | null>(null);
  const planned = practices.length > 0;

  useEffect(() => {
    if (!session) return;
    let live = true;
    const check = async () => {
      const [t, b] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).not('done_at', 'is', null),
        supabase.from('time_blocks').select('id', { count: 'exact', head: true }).eq('layer', 'actual'),
      ]);
      if (live && !t.error && !b.error) setRecorded((t.count ?? 0) + (b.count ?? 0) > 0);
    };
    check();
    // 휴대폰에서 기록하고 돌아오면 다시 확인
    window.addEventListener('focus', check);
    return () => { live = false; window.removeEventListener('focus', check); };
  }, [session, planned]);

  const steps: [string, boolean, string | null][] = [
    ['목표 적기', goals.length > 0, '/goals'],
    ['세부목표 만들기', subgoals.length > 0, '/board'],
    ['연간 표에 배치', yearCells.length > 0, '/plan/year'],
    ['월간 조정', monthCells.length > 0, '/plan/month'],
    ['주간 실천 적기', planned, '/plan/week'],
    ['모바일에서 첫 기록', !!recorded, null],
  ];
  const next = steps.findIndex(x => !x[1]);
  // 앞 단계를 다 했는데 기록 여부를 아직 모르면 잠깐 숨긴다 (다 마친 사람에게 깜빡이지 않게)
  if (next < 0 || (next === 5 && recorded === null)) return null;
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
            disabled={!to}
            onClick={() => to && navigate(to)}
            style={{ border: 0, background: 'transparent', cursor: to ? 'pointer' : 'default', font: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 6px', borderRadius: 10, textAlign: 'left', fontSize: 12.5, fontWeight: isNext ? 700 : 600, opacity: ok || isNext ? 1 : 0.6 }}
          >
            <span style={{ flex: 'none', marginTop: 2, width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid ' + (ok ? 'var(--color-accent-2)' : isNext ? 'var(--color-accent)' : 'var(--color-neutral-400)'), background: ok ? 'var(--color-accent-2)' : 'transparent', display: 'grid', placeItems: 'center', color: 'var(--color-neutral-100)' }}>
              {ok && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ textDecoration: ok ? 'line-through' : 'none' }}>{label}</span>
              {isNext && !to && <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-neutral-700)' }}>휴대폰으로 이 주소를 열고 할 일을 체크하거나 시간을 칠해요</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
