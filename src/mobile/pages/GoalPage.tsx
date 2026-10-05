// 목표 편집 (오른쪽에서 밀려 들어오는 화면): 이름 · 카테고리 · 기한 · 진척도 · 세부 목표 · 특성 · 일정에서 보기 · 마무리/삭제
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '../../lib/supabase';
import { useAccount, type Goal } from '../../account/AccountProvider';
import { IMPORTANCE, MAX_GOAL_NAME, MAX_SUBGOAL_NAME, dueValue, isClosed } from '../../lib/goals';
import { hours } from '../../lib/tracking';
import { BlurInput } from '../../ui/BlurInput';
import { MonthPicker, isMonth } from '../../ui/MonthPicker';
import { useTaskSubgoals } from '../../lib/useTaskSubgoals';
import { ScrollArea } from '../../ui/ScrollArea';
import { BODY, Field, H, ICON, Svg } from '../ui';
import { useMobile } from '../store';
import { ConfirmSheet, ReviewSheet, WrapSheet, useGoalTone, useGoalTotals } from '../plan/goalSheets';
import { cellSubs } from '../../lib/plan';

export default function GoalPage({ id, active, onGone }: { id: string; active: boolean; onGone: () => void }) {
  const { goals, status } = useAccount();
  const g = goals.find(x => x.id === id);
  // 지웠거나 없는 목표면 한 번만 돌아간다 (닫히며 미끄러져 나가는 중에는 그대로 둔다)
  const fired = useRef(false);
  useEffect(() => {
    if (!g && active && status === 'ready' && !fired.current) {
      fired.current = true;
      onGone();
    }
  });
  if (!g) return null;
  return <GoalEditor g={g} onDone={onGone} />;
}

function GoalEditor({ g, onDone }: { g: Goal; onDone: () => void }) {
  const { goalCategories, goals, subgoals, yearCells, monthCells, practices, run } = useAccount();
  const { progress, saveProgress } = useMobile();
  const { tone } = useGoalTone(g);
  const totals = useGoalTotals(g.status)?.[g.id];
  const subs = subgoals.filter(s => s.goal_id === g.id);
  // R-G9: 계획에 배치된 세부 목표는 지울 수 없다
  const placed = new Set([...[...yearCells, ...monthCells].flatMap(cellSubs), ...practices.map(c => c.subgoal_id)]);
  // 직접 추가 할 일에 연결된 세부 목표도 지울 수 없다 (R-T5)
  const usedByTasks = useTaskSubgoals(subs.map(s => s.id));
  const closed = isClosed(g);
  const [due, setDue] = useState(dueValue(g.due_month));
  const [traits, setTraits] = useState(false);
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<null | 'wrap' | 'delete' | 'review'>(null);
  const save = (patch: Partial<Goal>) => run(() => supabase.from('goals').update(patch).eq('id', g.id));

  const imp = IMPORTANCE.find(([k]) => k === g.importance)?.[1];
  const summary = [g.reason && '이유 있음', imp && '중요도 ' + imp, g.fallback && '대안 있음'].filter(Boolean).join(' · ') || '이유 · 중요도 · 대안 (선택)';

  const moveTo = (categoryId: string) => {
    const inTarget = goals.filter(x => x.category_id === categoryId);
    const position = inTarget.length ? Math.max(...inTarget.map(x => x.position)) + 1 : 0;
    save({ category_id: categoryId, position });
  };
  const moveSub = (i: number, dir: -1 | 1) => {
    const ids = subs.map(s => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => supabase.rpc('reorder_subgoals', { p_ids: ids }));
  };
  const addSub = () => {
    const v = draft.trim();
    if (!v) return;
    setDraft('');
    const position = subs.length ? Math.max(...subs.map(s => s.position)) + 1 : 0;
    run(() => supabase.from('subgoals').insert({ goal_id: g.id, name: v, position }));
  };

  return (
    <ScrollArea data-testid="goal-page" fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 18px 44px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <fieldset disabled={closed} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <BlurInput label="목표명" placeholder="목표명" maxLength={MAX_GOAL_NAME} value={g.name} onSave={name => save({ name })} style={{ flex: 'none', ...H, fontSize: 28, background: 'transparent', border: 0, borderBottom: '2px dashed var(--color-neutral-300)', outline: 'none', padding: '0 0 8px', color: 'var(--color-text)', width: '100%', boxSizing: 'border-box', borderRadius: 0 }} />

        <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1.2fr)', gap: 10, alignItems: 'start' }}>
          <Field label="카테고리">
            <select className="input" aria-label="카테고리" value={g.category_id} onChange={e => moveTo(e.target.value)} style={{ height: 40, cursor: 'pointer', paddingInline: 12 }}>
              {goalCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="기한" required hint={!isMonth(due) ? '기한을 정해 주세요.' : undefined}>
            <MonthPicker label="목표 기한" value={due} onChange={v => { setDue(v); if (isMonth(v)) save({ due_month: v + '-01' }); }} />
          </Field>
        </div>

        <Field label="진척도" hint="시간과 따로, 스스로 느끼는 진척이에요.">
          <ProgressSlider key={progress[g.id] ?? 0} value={progress[g.id] ?? 0} dot={tone.dot} label={g.name + ' 진척도'} onSave={v => saveProgress(g.id, v)} />
        </Field>
        {totals && (totals.actual_slots > 0 || totals.done_tasks > 0) && (
          <span data-testid="goal-totals" style={{ marginTop: -8, fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
            지금까지 {hours(totals.actual_slots)}시간 · 실천 {totals.done_tasks}개 완료
          </span>
        )}

        {/* 세부 목표 */}
        <div style={{ flex: 'none', background: tone.bg, borderRadius: 26, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 4px 4px' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>세부 목표 {subs.length}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: tone.ink }}>계획에 들어가는 단위</span>
          </div>
          {subs.map((s, i) => {
            const isPlaced = placed.has(s.id) || usedByTasks.has(s.id);
            return (
              <div key={s.id} data-testid="subgoal" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-neutral-100)', borderRadius: 16, padding: '4px 4px 4px 2px' }}>
                <div style={{ flex: 'none', display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => moveSub(i, -1)} disabled={i === 0} aria-label={s.name + ' 위로'} className="btn" style={{ width: 28, height: 20, padding: 0, color: 'var(--color-neutral-600)' }}><Svg d={ICON.up} size={12} width={3} /></button>
                  <button onClick={() => moveSub(i, 1)} disabled={i === subs.length - 1} aria-label={s.name + ' 아래로'} className="btn" style={{ width: 28, height: 20, padding: 0, color: 'var(--color-neutral-600)' }}><Svg d={ICON.down} size={12} width={3} /></button>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <BlurInput label="세부 목표 이름" maxLength={MAX_SUBGOAL_NAME} value={s.name} onSave={name => run(() => supabase.from('subgoals').update({ name }).eq('id', s.id))} style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', ...BODY, fontWeight: 600, fontSize: 14, color: 'var(--color-text)', padding: '2px 0' }} />
                  {isPlaced && <span style={{ fontSize: 11, fontWeight: 700, color: tone.ink }}>{placed.has(s.id) ? '계획에 배치됨' : '할 일 기록에 쓰임'}</span>}
                </div>
                <button onClick={() => run(() => supabase.from('subgoals').delete().eq('id', s.id))} disabled={isPlaced} aria-label={s.name + ' 삭제'} title={isPlaced ? (placed.has(s.id) ? '계획에 배치된 세부 목표는 지울 수 없어요' : '할 일 기록에 쓰인 세부 목표는 지울 수 없어요') : '삭제'} className="btn" style={{ flex: 'none', width: 36, height: 36, padding: 0, color: 'var(--color-accent-700)', opacity: isPlaced ? 0.35 : 1 }}>
                  <Svg d={ICON.trash} size={15} />
                </button>
              </div>
            );
          })}
          {subs.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, padding: '2px 4px', color: tone.ink }}>세부 목표가 있어야 계획에 넣을 수 있어요.</span>}
          {!closed && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input aria-label="세부 목표 추가" value={draft} maxLength={MAX_SUBGOAL_NAME} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && addSub()} placeholder="+ 세부 목표 (예: LC)" style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 16, border: '2px dashed ' + tone.dot, background: 'transparent', padding: '0 12px', ...BODY, fontWeight: 500, fontSize: 13.5, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
              <button className="btn btn-primary" onClick={addSub} disabled={!draft.trim()} style={{ flex: 'none', height: 42, padding: '0 16px', fontSize: 13 }}>추가</button>
            </div>
          )}
        </div>

        {/* 목표의 특성 */}
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--color-surface)', borderRadius: 24, padding: 6 }}>
          <button type="button" onClick={() => setTraits(!traits)} aria-expanded={traits} className="m-hover" style={{ border: 0, background: 'transparent', cursor: 'pointer', ...BODY, fontWeight: 400, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 18, textAlign: 'left' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>목표의 특성</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
            </span>
            <Svg d={ICON.down} size={16} style={{ color: 'var(--color-neutral-700)', transform: traits ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {traits && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 10px 12px' }}>
              <Field label="이유">
                <BlurInput multiline rows={2} required={false} maxLength={500} label="이유" placeholder="이 목표를 왜 이루고 싶나요?" value={g.reason ?? ''} onSave={v => save({ reason: v || null })} className="input" style={{ resize: 'none', height: 'auto', paddingTop: 10, paddingBottom: 10, lineHeight: 1.5, borderRadius: 20 } as CSSProperties} />
              </Field>
              <Field label="중요도">
                <div style={{ display: 'flex', gap: 6 }}>
                  {IMPORTANCE.map(([k, label]) => (
                    <button key={k} type="button" className={g.importance === k ? 'btn btn-primary' : 'btn btn-secondary'} aria-pressed={g.importance === k} onClick={() => save({ importance: g.importance === k ? null : k })} style={{ flex: 1, height: 38, ...BODY, fontSize: 13 }}>{label}</button>
                  ))}
                </div>
              </Field>
              <Field label="대안">
                <BlurInput required={false} maxLength={200} label="대안" placeholder="잘 안 될 때의 플랜 B" value={g.fallback ?? ''} onSave={v => save({ fallback: v || null })} className="input" />
              </Field>
            </div>
          )}
        </div>
      </fieldset>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 2026-10-03 기획 결정: '일정에서 보기' 대신 '작성 완료' — 고친 내용은 칸을 벗어나면 저장돼 있다 */}
        {!closed && <button className="btn btn-primary" onClick={onDone} style={{ height: 46 }}>작성 완료</button>}
        {g.status === 'in_progress' && <button className="btn btn-secondary" onClick={() => setSheet('wrap')} style={{ height: 46, ...BODY }}>목표 마무리하기</button>}
        {g.status === 'not_started' && (
          <button onClick={() => setSheet('delete')} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', cursor: 'pointer', ...BODY, fontSize: 13, color: 'var(--color-accent-700)', padding: '6px 4px', textDecoration: 'underline', textUnderlineOffset: 3 }}>목표 삭제</button>
        )}
        {g.status === 'in_progress' && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', padding: '0 4px', textWrap: 'pretty' }}>계획에 들어간 목표는 지울 수 없어요. 끝났다면 마무리해 주세요.</span>}
        {closed && (
          <div style={{ padding: '14px 16px', borderRadius: 20, background: 'var(--color-surface)', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-800)', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            {g.status === 'completed' ? '완성으로' : '중도 마무리로'} 마무리한 목표예요.
            <button className="btn btn-secondary" onClick={() => setSheet('review')} style={{ height: 36, ...BODY, fontSize: 13 }}>회고 보기</button>
          </div>
        )}
      </div>

      {sheet === 'wrap' && g.status === 'in_progress' && <WrapSheet goal={g} onClose={() => setSheet(null)} />}
      {sheet === 'review' && <ReviewSheet goal={g} onClose={() => setSheet(null)} />}
      {sheet === 'delete' && (
        <ConfirmSheet
          title={`‘${g.name}’ 목표를 지울까요?`}
          body="세부 목표와, 연간·월간 계획에 넣은 칸도 함께 지워지고 되돌릴 수 없어요."
          confirmLabel="지우기"
          onClose={() => setSheet(null)}
          onConfirm={() => { setSheet(null); run(() => supabase.from('goals').delete().eq('id', g.id)); }}
        />
      )}
    </ScrollArea>
  );
}

/** 진척도: 놓을 때 저장 (기록으로 쌓인다, 4.7-3) */
function ProgressSlider({ value, dot, label, onSave }: { value: number; dot: string; label: string; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  const sent = useRef(value);
  const timer = useRef<number | undefined>(undefined);
  const commit = () => {
    window.clearTimeout(timer.current);
    if (v === sent.current) return;
    sent.current = v;
    onSave(v);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        aria-label={label}
        className="progress-range"
        onChange={e => setV(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(commit, 600); }}
        onBlur={commit}
        style={{ flex: 1, minWidth: 0, ['--fill' as string]: dot, ['--pct' as string]: v + '%' } as CSSProperties}
      />
      <span data-testid="progress-label" style={{ flex: 'none', width: 56, textAlign: 'right', ...H, fontSize: 20 }}>{v}%</span>
    </div>
  );
}
