import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount, type Goal, type Subgoal } from '../account/AccountProvider';
import { PALETTE } from '../lib/palette';
import { IMPORTANCE, MAX_GOAL_NAME, MAX_SUBGOAL_NAME, STATUS_LABEL, dueShort, dueValue, isClosed, sortGoals } from '../lib/goals';
import { BlurInput } from '../ui/BlurInput';
import { MonthPicker, isMonth } from '../ui/MonthPicker';
import { useDeleteGoal } from './goalActions';
import { WrapDialog } from './WrapDialog';

const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');

// 꿈 보드: 카테고리별 목표 포스트잇 → 오른쪽 편집 패널 (일상 카테고리는 나오지 않음, R-C2)
export default function BoardPage() {
  const { profile, goalCategories, goals, subgoals } = useAccount();
  const navigate = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  const editing = goals.find(g => g.id === editId) ?? null;
  const dream = profile?.dream?.trim();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: editing ? 'minmax(0,1fr) 400px' : 'minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
          <span className="tag tag-accent" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>궁극적 꿈</span>
          <h1 style={{ fontSize: 54, margin: 0, textWrap: 'balance' }}>{dream || '궁극적 꿈을 한 문장으로 적어보세요'}</h1>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>카테고리마다 목표를 붙이고, 목표마다 세부목표를 적어요. 카드를 누르면 오른쪽에서 편집할 수 있어요.</p>
        </div>
        {goals.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', borderRadius: 28, padding: '20px 24px' }}>
            <span style={{ fontSize: 15, fontWeight: 600, textWrap: 'pretty' }}>먼저 목표를 적어 주세요</span>
            <button className="btn btn-primary" onClick={() => navigate('/goals')}>목표 설정</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(214px, 1fr))', gap: 20, alignItems: 'start' }}>
            {goalCategories.map((c, i) => {
              const p = PALETTE[c.color];
              return (
                <div key={c.id} data-testid="board-column" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: p.dot, color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>{i + 1}</span>
                      <h3 style={{ margin: 0, fontSize: 24 }}>{c.name}</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>{c.aspiration || '되고 싶은 모습을 적어보세요'}</p>
                  </div>
                  {sortGoals(goals.filter(g => g.category_id === c.id)).map(g => {
                    const subs = subgoals.filter(s => s.goal_id === g.id);
                    const closed = isClosed(g);
                    const going = g.status === 'in_progress';
                    return (
                      <div
                        key={g.id}
                        role="button"
                        tabIndex={0}
                        data-testid="goal-card"
                        aria-pressed={editId === g.id}
                        onClick={() => setEditId(editId === g.id ? null : g.id)}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setEditId(editId === g.id ? null : g.id))}
                        className="goal-card"
                        style={{ background: p.bg, borderRadius: 26, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', outline: editId === g.id ? '3px solid ' + p.ink : '0 solid transparent', outlineOffset: 3, opacity: closed ? 0.5 : 1 }}
                      >
                        <h4 style={{ margin: 0, fontSize: 19 }}>{g.name}</h4>
                        {subs.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {subs.map(s => (
                              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'var(--color-neutral-100)', color: p.ink, fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{s.name}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: p.ink, opacity: 0.55 }}>세부목표를 추가해 주세요</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: p.ink }}>기한 {dueShort(g.due_month)}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: closed ? 'var(--color-text)' : going ? p.ink : 'var(--color-neutral-100)', color: closed || going ? 'var(--color-neutral-100)' : 'var(--color-neutral-700)' }}>{STATUS_LABEL[g.status]}</span>
                        </div>
                      </div>
                    );
                  })}
                  <button className="btn add-dashed" onClick={() => navigate('/goals')} style={{ border: '2px dashed var(--color-neutral-400)', color: 'var(--color-neutral-700)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, padding: 12, borderRadius: 26 }}>+ 목표 추가</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {editing && <EditPanel key={editing.id} goal={editing} subs={subgoals.filter(s => s.goal_id === editing.id)} onClose={() => setEditId(null)} />}
    </div>
  );
}

function EditPanel({ goal: g, subs, onClose }: { goal: Goal; subs: Subgoal[]; onClose: () => void }) {
  const { goalCategories, goals, yearCells, monthCells, practices, run } = useAccount();
  const [wrapOpen, setWrapOpen] = useState(false);
  // R-G9: 계획 표에 배치된 세부목표는 삭제 불가
  const placed = new Set([...yearCells, ...monthCells, ...practices].map(c => c.subgoal_id));
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [due, setDue] = useState(dueValue(g.due_month));
  const { ask, dialog } = useDeleteGoal(onClose);
  const cat = goalCategories.find(c => c.id === g.category_id);
  const p = PALETTE[cat?.color ?? 'red'];
  const closed = isClosed(g);
  const save = (patch: Partial<Goal>) => run(() => supabase.from('goals').update(patch).eq('id', g.id));
  const imp = IMPORTANCE.find(([k]) => k === g.importance)?.[1];
  const summary = [g.reason && '이유 있음', imp && '중요도 ' + imp, g.fallback && '대안 있음'].filter(Boolean).join(' · ') || '이유 · 중요도 · 대안 (선택)';

  const moveTo = (categoryId: string) => {
    const inTarget = goals.filter(x => x.category_id === categoryId);
    const position = inTarget.length ? Math.max(...inTarget.map(x => x.position)) + 1 : 0;
    save({ category_id: categoryId, position });
  };
  const dropAt = (to: number) => {
    if (drag === null || drag === to) return setDrag(null);
    const ids = subs.map(s => s.id);
    const [m] = ids.splice(drag, 1);
    ids.splice(to, 0, m);
    setDrag(null);
    run(() => supabase.rpc('reorder_subgoals', { p_ids: ids }));
  };

  return (
    <aside data-testid="edit-panel" aria-label="목표 편집" style={{ position: 'sticky', top: 14, maxHeight: 'calc(100vh - 28px)', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--color-surface)', borderRadius: 32, padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: p.ink }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.dot }} />목표 편집 · {STATUS_LABEL[g.status]}
        </span>
        <button title="닫기" aria-label="닫기" onClick={onClose} className="btn" style={{ width: 34, height: 34, padding: 0, color: 'var(--color-neutral-700)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <fieldset disabled={closed} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BlurInput label="목표명" placeholder="목표명" maxLength={MAX_GOAL_NAME} value={g.name} onSave={name => save({ name })} style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, lineHeight: 1.2, background: 'transparent', border: 0, borderBottom: '2px dashed var(--color-neutral-300)', outline: 'none', padding: '0 0 8px', color: 'var(--color-text)', width: '100%', boxSizing: 'border-box' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)', gap: 10, alignItems: 'start' }}>
            <div className="field">
              <label htmlFor="ed-cat">카테고리</label>
              <select id="ed-cat" className="input" value={g.category_id} onChange={e => moveTo(e.target.value)} style={{ height: 40, cursor: 'pointer' }}>
                {goalCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>기한 <span style={{ color: 'var(--color-accent-700)' }}>· 필수</span></label>
              <MonthPicker value={due} onChange={v => { setDue(v); if (isMonth(v)) save({ due_month: v + '-01' }); }} />
            </div>
          </div>
        </div>

        <div style={{ background: p.bg, borderRadius: 26, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 4px 4px' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>세부목표 {subs.length}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: p.ink }}>계획 표 칸에 들어가는 단위</span>
          </div>
          {subs.map((s, i) => (
            <div key={s.id} data-testid="subgoal" onDragOver={e => drag !== null && e.preventDefault()} onDrop={e => { e.preventDefault(); dropAt(i); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-neutral-100)', borderRadius: 16, padding: '6px 6px 6px 2px', opacity: drag === i ? 0.4 : 1 }}>
              <span title="끌어서 순서 변경" draggable={!closed} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); setDrag(i); }} onDragEnd={() => setDrag(null)} style={{ flex: 'none', width: 24, height: 30, display: 'grid', placeItems: 'center', cursor: closed ? 'default' : 'grab', color: 'var(--color-neutral-500)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <BlurInput label="세부목표 이름" maxLength={MAX_SUBGOAL_NAME} value={s.name} onSave={name => run(() => supabase.from('subgoals').update({ name }).eq('id', s.id))} style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', padding: '2px 0' }} />
                {placed.has(s.id) && <span style={{ fontSize: 11, fontWeight: 700, color: p.ink }}>계획 표에 배치됨</span>}
              </div>
              <button title={placed.has(s.id) ? '계획 표에 배치된 세부목표는 삭제할 수 없어요' : '삭제'} aria-label={s.name + ' 삭제'} disabled={placed.has(s.id)} onClick={() => run(() => supabase.from('subgoals').delete().eq('id', s.id))} className="btn" style={{ flex: 'none', width: 30, height: 30, padding: 0, color: 'var(--color-accent-700)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
          {subs.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, padding: 4, color: p.ink, opacity: 0.6 }}>세부목표를 추가해 주세요. 세부목표가 있어야 계획 표에 열로 넣을 수 있어요.</span>}
          <input
            aria-label="세부목표 추가"
            placeholder="+ 세부목표 추가 (Enter)"
            maxLength={MAX_SUBGOAL_NAME}
            onKeyDown={e => {
              const input = e.currentTarget;
              const v = input.value.trim();
              if (e.key !== 'Enter' || !v || e.nativeEvent.isComposing) return;
              input.value = '';
              const position = subs.length ? Math.max(...subs.map(s => s.position)) + 1 : 0;
              run(() => supabase.from('subgoals').insert({ goal_id: g.id, name: v, position }));
            }}
            style={{ height: 42, borderRadius: 16, border: '2px dashed ' + p.dot, background: 'transparent', padding: '0 12px', font: 'inherit', fontSize: 13.5, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--color-neutral-100)', borderRadius: 24, padding: 6 }}>
          <button type="button" onClick={() => setTraitsOpen(!traitsOpen)} aria-expanded={traitsOpen} className="traits-toggle" style={{ border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 18, textAlign: 'left' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{traitsOpen ? '목표의 특성 접기' : '목표의 특성 더 보기'}</span>
              {!traitsOpen && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', color: 'var(--color-neutral-700)', transform: traitsOpen ? 'rotate(180deg)' : 'none' }}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {traitsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 10px 12px' }}>
              <div className="field">
                <label>이유 · 선택</label>
                <BlurInput multiline rows={2} required={false} maxLength={500} label="이유" placeholder="이 목표를 왜 이루고 싶나요?" value={g.reason ?? ''} onSave={v => save({ reason: v || null })} className="input" style={{ resize: 'none', height: 'auto', minHeight: 0, paddingTop: 10, paddingBottom: 10, lineHeight: 1.5, borderRadius: 20 }} />
              </div>
              <div className="field">
                <label>중요도 · 선택</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {IMPORTANCE.map(([k, label]) => (
                    <button key={k} type="button" className={pill(g.importance === k)} aria-pressed={g.importance === k} onClick={() => save({ importance: g.importance === k ? null : k })} style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 }}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>대안 · 선택</label>
                <BlurInput required={false} maxLength={200} label="대안" placeholder="잘 안 될 때의 플랜 B" value={g.fallback ?? ''} onSave={v => save({ fallback: v || null })} className="input" />
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {g.status === 'not_started' && (
        <button onClick={() => ask(g)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--color-accent-700)', padding: '4px 2px', textDecoration: 'underline', textUnderlineOffset: 3 }}>목표 삭제</button>
      )}
      {g.status === 'in_progress' && (
        <button onClick={() => setWrapOpen(true)} className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontFamily: 'var(--font-body)', fontWeight: 700 }}>목표 마무리하기</button>
      )}
      {closed && (
        <div style={{ padding: '12px 14px', borderRadius: 20, background: 'var(--color-neutral-200)', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-800)', textWrap: 'pretty' }}>
          {g.status === 'completed' ? '완성으로' : '중도 마무리로'} 마무리한 목표예요. 회고는 회고 모음에서 볼 수 있어요.
        </div>
      )}
      {dialog}
      {wrapOpen && g.status === 'in_progress' && <WrapDialog goal={g} onClose={() => setWrapOpen(false)} />}
    </aside>
  );
}
