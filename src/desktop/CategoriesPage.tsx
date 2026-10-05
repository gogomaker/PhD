import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAccount, type Category } from '../account/AccountProvider';
import { Swatches } from '../account/Swatches';
import { PALETTE } from '../lib/palette';
import { lifeStageOf } from '../lib/lifeStage';
import { MAX_CATEGORY_NAME, MAX_GOAL_CATEGORIES, MAX_KEYWORD_NAME, MAX_KEYWORDS } from '../lib/categories';

const chevronUp = 'm18 15-6-6-6 6';
const chevronDown = 'm6 9 6 6 6-6';
const trash = 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2';
const cross = 'M18 6 6 18M6 6l12 12';

function Svg({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// 이름 칸: 고치는 동안은 화면에만, 칸을 벗어나거나 Enter를 누르면 저장
function NameInput({ value, onSave, label, maxLength }: { value: string; onSave: (v: string) => void; label: string; maxLength: number }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (!v) setDraft(value);
    else if (v !== value) onSave(v);
  };
  return (
    <input
      value={draft}
      maxLength={maxLength}
      aria-label={label}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
      style={{ width: '100%', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 21, background: 'transparent', border: 0, color: 'var(--color-text)', outline: 'none', padding: 0 }}
    />
  );
}

export default function CategoriesPage() {
  const { profile, goalCategories: cats, dailyCategory: daily, keywords, allKeywords, goals, run, toast } = useAccount();
  const full = cats.length >= MAX_GOAL_CATEGORIES;
  const stage = lifeStageOf(profile?.life_stage);
  const suggest = stage.cats.filter(n => !cats.some(c => c.name === n));

  const update = (c: Category, patch: Partial<Pick<Category, 'name' | 'color'>>) => run(() => supabase.from('categories').update(patch).eq('id', c.id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    const ids = cats.map(c => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => supabase.rpc('reorder_categories', { p_ids: ids }));
  };
  // 색은 DB가 순서대로 다시 매긴다. 여기서 넣는 색은 임시값
  const add = (name = '새 카테고리') => {
    if (full) return;
    const position = cats.length ? Math.max(...cats.map(c => c.position)) + 1 : 0;
    run(() => supabase.from('categories').insert({ kind: 'goal', name, color: 'red', position }));
  };
  // 목표 카테고리는 1개 이상 남긴다 (가입 때와 같은 기준). 목표가 든 카테고리는 지울 수 없다 (기획 결정, DB도 막음)
  const goalCount = (c: Category) => goals.filter(g => g.category_id === c.id).length;
  const remove = (c: Category) => {
    if (goalCount(c) > 0) return toast('목표가 들어 있는 카테고리는 지울 수 없어요. 목표를 다른 카테고리로 옮기거나 지운 뒤 지워 주세요');
    run(() => supabase.from('categories').delete().eq('id', c.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 920 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tag tag-accent-2" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>설정 · 인생 카테고리</span>
        <h1 style={{ margin: 0, fontSize: 42 }}>삶을 몇 개의 영역으로 나눠 볼까요</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>목표 카테고리는 목표를 묶는 큰 영역이에요. 순서는 보드의 순서가 되고, 색은 순서대로 정해져요. 순서를 바꾸면 색도 함께 바뀌고, 계획 표와 모바일 타임 테이블에 그대로 쓰여요.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cats.map((c, i) => {
          const p = PALETTE[c.color];
          return (
            <div key={c.id} data-testid="goal-category" style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--color-surface)', borderRadius: 30, padding: '12px 16px 12px 12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button title="위로" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)} className="btn" style={{ width: 26, height: 22, padding: 0, color: 'var(--color-neutral-600)' }}><Svg d={chevronUp} size={13} /></button>
                <button title="아래로" aria-label="아래로" disabled={i === cats.length - 1} onClick={() => move(i, 1)} className="btn" style={{ width: 26, height: 22, padding: 0, color: 'var(--color-neutral-600)' }}><Svg d={chevronDown} size={13} /></button>
              </div>
              <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: p.dot, color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>{i + 1}</span>
              <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', background: p.bg, borderRadius: 999, padding: '0 20px', height: 48, transform: 'rotate(-0.6deg)' }}>
                <NameInput value={c.name} label="카테고리 이름" maxLength={MAX_CATEGORY_NAME} onSave={name => update(c, { name })} />
              </div>
              <span style={{ flex: 'none', minWidth: 58, fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>목표 {goalCount(c)}개</span>
              <button
                title={cats.length <= 1 ? '목표 카테고리는 1개 이상 있어야 해요' : goalCount(c) > 0 ? '목표가 들어 있어 지울 수 없어요' : '삭제'}
                aria-label="삭제"
                disabled={cats.length <= 1}
                onClick={() => remove(c)}
                className="btn"
                style={{ width: 34, height: 34, padding: 0, color: 'var(--color-accent-700)' }}
              >
                <Svg d={trash} size={16} />
              </button>
            </div>
          );
        })}
        {full ? (
          <div style={{ height: 56, borderRadius: 30, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: '0 16px' }}>목표 카테고리는 최대 6개예요. 새로 추가하려면 하나를 지워주세요.</div>
        ) : (
          <button className="btn add-dashed" onClick={() => add()} style={{ border: '2px dashed var(--color-neutral-400)', color: 'var(--color-neutral-700)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, height: 56, borderRadius: 30 }}>
            + 카테고리 추가 ({cats.length}/{MAX_GOAL_CATEGORIES})
          </button>
        )}
      </div>

      {suggest.length > 0 && !full && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{stage.label}에게 추천하는 카테고리</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {suggest.map(name => (
              <button key={name} className="btn btn-secondary" onClick={() => add(name)} style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13 }}>+ {name}</button>
            ))}
          </div>
        </div>
      )}

      {daily && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--color-surface)', borderRadius: 30, padding: '20px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: 'var(--color-neutral-600)' }}>일상 카테고리 · 1개 고정</span>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>목표 없이 시간 기록과 생활 할 일에 써요. 목표 설정, 꿈 보드, 계획 표에는 나오지 않고, 모바일에서 키워드로 할 일을 적고 시간을 칠해요. 일상 색은 직접 고르고, 목표 카테고리는 이 색을 건너뛰고 순서대로 색을 받아요.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', background: PALETTE[daily.color].bg, borderRadius: 999, padding: '0 20px', height: 48 }}>
              <NameInput value={daily.name} label="일상 카테고리 이름" maxLength={MAX_CATEGORY_NAME} onSave={name => update(daily, { name })} />
            </div>
            <Swatches value={daily.color} onPick={color => update(daily, { color })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>키워드 · 모바일에서 일상 할 일과 시간 칠하기에 쓰여요</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {keywords.map(k => (
                <span key={k.id} data-testid="keyword" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 6px 0 14px', borderRadius: 999, background: PALETTE[daily.color].bg, color: PALETTE[daily.color].ink, fontSize: 13.5, fontWeight: 700 }}>
                  {k.name}
                  <button title="키워드 삭제" aria-label={k.name + ' 삭제'} onClick={() => run(() => supabase.from('daily_keywords').update({ archived: true }).eq('id', k.id))} style={{ width: 24, height: 24, borderRadius: '50%', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                    <Svg d={cross} size={12} />
                  </button>
                </span>
              ))}
              {keywords.length >= MAX_KEYWORDS ? (
                <span data-testid="keyword-limit" style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>최대 {MAX_KEYWORDS}개예요. 하나를 지우면 새로 추가할 수 있어요</span>
              ) : (
              <input
                placeholder="+ 키워드 입력 후 Enter"
                aria-label="키워드 추가"
                maxLength={MAX_KEYWORD_NAME}
                onKeyDown={e => {
                  const input = e.currentTarget;
                  const v = input.value.trim();
                  if (e.key !== 'Enter' || !v || e.nativeEvent.isComposing) return;
                  input.value = '';
                  if (keywords.some(k => k.name === v)) return;
                  const position = allKeywords.length ? Math.max(...allKeywords.map(k => k.position)) + 1 : 0;
                  // 지운(보관한) 키워드를 다시 적으면 되살린다 — 지난 기록이 그 키워드를 가리키므로 실제로 지우지 않는다
                  const old = allKeywords.find(k => k.name === v);
                  if (old) run(() => supabase.from('daily_keywords').update({ archived: false, position }).eq('id', old.id));
                  else run(() => supabase.from('daily_keywords').insert({ category_id: daily.id, name: v, position }));
                }}
                style={{ height: 36, width: 180, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', padding: '0 14px', font: 'inherit', fontSize: 13, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
              />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
