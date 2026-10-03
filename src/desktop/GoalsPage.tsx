import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount, type Category, type Goal } from '../account/AccountProvider';
import { PALETTE } from '../lib/palette';
import { MAX_GOAL_NAME, isClosed, sortGoals } from '../lib/goals';
import { BlurInput } from '../ui/BlurInput';
import { MonthPicker, isMonth } from '../ui/MonthPicker';
import { useDeleteGoal } from './goalActions';
import { DdayRow } from './Dday';

const cross = 'M18 6 6 18M6 6l12 12';

// 목표 설정: 카테고리별 되고 싶은 모습 + 목표 빠르게 적기 (일상 카테고리는 나오지 않음, R-C2)
export default function GoalsPage() {
  const { profile, goalCategories, goals } = useAccount();
  const { ask, dialog } = useDeleteGoal();
  const dream = profile?.dream?.trim();
  const loc = useLocation();
  const navigate = useNavigate();
  // 체험을 마치고 오면 첫 목표 입력 칸에 바로 (모바일은 새 목표 시트)
  useEffect(() => {
    if (!(loc.state as { newGoal?: boolean } | null)?.newGoal) return;
    navigate(loc.pathname, { replace: true, state: null });
    document.querySelector<HTMLInputElement>('[data-goal-input]')?.focus();
  }, [loc.state, loc.pathname, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30, maxWidth: 1000 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tag tag-accent-2" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>설정 · 목표</span>
        <h1 style={{ margin: 0, fontSize: 42 }}>꿈을 목표로 옮겨 적어요</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>꿈을 기준으로, 카테고리마다 어떤 사람이 되고 싶은지와 구체적인 목표를 적어요. 목표 하나가 계획 표의 열 하나가 돼요.</p>
      </div>
      {goals.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', borderRadius: 28, padding: '20px 24px' }}>
          <span style={{ fontSize: 15, fontWeight: 600, textWrap: 'pretty' }}>카테고리마다 이루고 싶은 목표를 적어 보세요</span>
          <button className="btn btn-primary" onClick={() => document.querySelector<HTMLInputElement>('[data-goal-input]')?.focus()}>첫 목표 적기</button>
        </div>
      )}
      {dream && (
        <div style={{ background: 'var(--color-accent-200)', borderRadius: 32, padding: '20px 20px 20px 26px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: 'var(--color-accent-800)' }}>나의 꿈</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, lineHeight: 1.2 }}>{dream}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: dream ? -14 : 0 }}>
        <DdayRow />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', columnGap: 24 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)', paddingLeft: 4 }}>카테고리</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)' }}>되고 싶은 모습 · 목표</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: -18 }}>
        {goalCategories.map((c, i) => (
          <CategoryRow key={c.id} category={c} num={i + 1} goals={sortGoals(goals.filter(g => g.category_id === c.id))} onDelete={ask} first={i === 0} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)' }}>
        목표별 세부 내용은 <Link to="/board" style={{ fontWeight: 700 }}>꿈 보드</Link>에서 적어요. 카테고리 이름과 순서는 <Link to="/categories" style={{ fontWeight: 700 }}>인생 카테고리</Link>에서 바꿀 수 있어요.
      </p>
      {dialog}
    </div>
  );
}

function CategoryRow({ category: c, num, goals, onDelete, first }: { category: Category; num: number; goals: Goal[]; onDelete: (g: Goal) => void; first: boolean }) {
  const { run } = useAccount();
  const p = PALETTE[c.color];
  return (
    <div data-testid="goal-row" style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: p.bg, borderRadius: 999, padding: '0 18px 0 8px', height: 48, transform: 'rotate(-0.6deg)' }}>
        <span style={{ flex: 'none', width: 32, height: 32, borderRadius: '50%', background: p.dot, color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15 }}>{num}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-600)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          <BlurInput
            className="input"
            required={false}
            maxLength={200}
            label={c.name + ' 되고 싶은 모습'}
            placeholder="이 영역에서 되고 싶은 모습"
            value={c.aspiration ?? ''}
            onSave={v => run(() => supabase.from('categories').update({ aspiration: v || null }).eq('id', c.id))}
            style={{ height: 48, fontSize: 16, fontWeight: 600 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingLeft: 32 }}>
          {goals.map(g => (
            <span key={g.id} data-testid="goal-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: g.status === 'not_started' ? '0 6px 0 14px' : '0 14px', borderRadius: 999, background: p.bg, color: p.ink, fontSize: 13.5, fontWeight: 700, opacity: isClosed(g) ? 0.5 : 1 }}>
              {g.name}
              {g.status === 'not_started' && (
                <button title="목표 삭제" aria-label={g.name + ' 삭제'} onClick={() => onDelete(g)} style={{ width: 24, height: 24, borderRadius: '50%', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true"><path d={cross} /></svg>
                </button>
              )}
            </span>
          ))}
          <GoalComposer category={c} goals={goals} focusTarget={first} />
        </div>
      </div>
    </div>
  );
}

// 목표 빠르게 적기: 이름 + 기한(필수, 기획 결정 2026-10-01)
function GoalComposer({ category, goals, focusTarget }: { category: Category; goals: Goal[]; focusTarget: boolean }) {
  const { run } = useAccount();
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = name.trim() && isMonth(due);

  async function add() {
    if (!name.trim()) return;
    if (!isMonth(due)) return setHint(true);
    setBusy(true);
    const position = goals.length ? Math.max(...goals.map(g => g.position)) + 1 : 0;
    const ok = await run(() => supabase.from('goals').insert({ category_id: category.id, name: name.trim(), due_month: due + '-01', position }));
    setBusy(false);
    if (ok) {
      setName('');
      setDue('');
      setHint(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input
        data-goal-input={focusTarget ? '1' : undefined}
        aria-label={category.name + ' 목표 이름'}
        placeholder="+ 목표 입력"
        maxLength={MAX_GOAL_NAME}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && add()}
        style={{ height: 36, width: 180, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', padding: '0 14px', font: 'inherit', fontSize: 13, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
      />
      {name.trim() && (
        <>
          <MonthPicker label={category.name + ' 목표 기한'} value={due} onChange={v => { setDue(v); setHint(false); }} style={{ width: 200 }} />
          <button className="btn btn-primary" disabled={!ready || busy} onClick={add} style={{ height: 36, fontSize: 13 }}>추가</button>
          {hint && <span role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent-700)' }}>기한을 골라 주세요</span>}
          {!hint && !isMonth(due) && <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>기한(연·월)을 골라 주세요</span>}
        </>
      )}
    </div>
  );
}
