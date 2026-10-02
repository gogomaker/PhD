// 카테고리 (오른쪽에서 밀려 들어오는 화면). 목표 카테고리 색은 순서대로 자동(R-C1), 일상 색만 고른다
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAccount, type Category } from '../../account/AccountProvider';
import { Swatches } from '../../account/Swatches';
import { PALETTE } from '../../lib/palette';
import { lifeStageOf } from '../../lib/lifeStage';
import { MAX_CATEGORY_NAME, MAX_GOAL_CATEGORIES, MAX_KEYWORD_NAME } from '../../lib/categories';
import { BlurInput } from '../../ui/BlurInput';
import { ScrollArea } from '../../ui/ScrollArea';
import { BODY, H, ICON, Svg } from '../ui';

const nameStyle = { width: '100%', ...H, fontSize: 18, background: 'transparent', border: 0, outline: 'none', color: 'var(--color-text)', padding: 0 } as const;

export default function CategoriesPage() {
  const { profile, goalCategories: cats, dailyCategory: daily, keywords, allKeywords, goals, run, toast } = useAccount();
  const [kw, setKw] = useState('');
  const full = cats.length >= MAX_GOAL_CATEGORIES;
  const stage = lifeStageOf(profile?.life_stage);
  const suggest = stage.cats.filter(n => !cats.some(c => c.name === n));
  const goalCount = (c: Category) => goals.filter(g => g.category_id === c.id).length;

  const update = (c: Category, patch: Partial<Pick<Category, 'name' | 'color' | 'aspiration'>>) => run(() => supabase.from('categories').update(patch).eq('id', c.id));
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
  const remove = (c: Category) => {
    if (goalCount(c) > 0) return toast('목표가 들어 있는 카테고리는 지울 수 없어요. 목표를 옮기거나 지운 뒤 지워 주세요');
    run(() => supabase.from('categories').delete().eq('id', c.id));
  };
  const addKeyword = () => {
    const v = kw.trim();
    if (!v || !daily) return;
    setKw('');
    if (keywords.some(k => k.name === v)) return;
    const position = allKeywords.length ? Math.max(...allKeywords.map(k => k.position)) + 1 : 0;
    // 지운(보관한) 키워드를 다시 적으면 되살린다 — 지난 기록이 그 키워드를 가리키므로 실제로 지우지 않는다
    const old = allKeywords.find(k => k.name === v);
    if (old) run(() => supabase.from('daily_keywords').update({ archived: false, position }).eq('id', old.id));
    else run(() => supabase.from('daily_keywords').insert({ category_id: daily.id, name: v, position }));
  };

  return (
    <ScrollArea data-testid="categories-page" fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 16px 44px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px 4px' }}>
        <span style={{ ...H, fontSize: 26 }}>카테고리</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>순서는 목표 목록의 순서가 돼요. 색은 순서대로 정해지고, 계획과 시간표에 그대로 쓰여요.</span>
      </div>

      {cats.map((c, i) => {
        const t = PALETTE[c.color];
        const n = goalCount(c);
        return (
          <div key={c.id} data-testid="goal-category" style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 26, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: t.dot, color: 'var(--color-bg)', display: 'grid', placeItems: 'center', ...H, fontSize: 14 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', background: t.bg, borderRadius: 999, padding: '0 14px', height: 40 }}>
                <BlurInput label="카테고리 이름" maxLength={MAX_CATEGORY_NAME} value={c.name} onSave={name => update(c, { name })} style={nameStyle} />
              </div>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={c.name + ' 위로'} className="btn" style={{ flex: 'none', width: 32, height: 32, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={ICON.up} size={14} /></button>
              <button onClick={() => move(i, 1)} disabled={i === cats.length - 1} aria-label={c.name + ' 아래로'} className="btn" style={{ flex: 'none', width: 32, height: 32, padding: 0, color: 'var(--color-neutral-700)' }}><Svg d={ICON.down} size={14} /></button>
              <button onClick={() => remove(c)} disabled={cats.length <= 1} aria-label={c.name + ' 삭제'} title={cats.length <= 1 ? '목표 카테고리는 1개 이상 있어야 해요' : n ? '목표가 들어 있어 지울 수 없어요' : '삭제'} className="btn" style={{ flex: 'none', width: 32, height: 32, padding: 0, color: 'var(--color-accent-700)', opacity: cats.length <= 1 || n ? 0.35 : 1 }}><Svg d={ICON.trash} size={15} /></button>
            </div>
            <BlurInput required={false} maxLength={200} label={c.name + ' 되고 싶은 모습'} placeholder="이 영역에서 되고 싶은 모습" value={c.aspiration ?? ''} onSave={v => update(c, { aspiration: v || null })} className="input" style={{ height: 40, fontSize: 13.5 }} />
            <span style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)', padding: '0 4px' }}>목표 {n}개</span>
          </div>
        );
      })}

      {full ? (
        <div style={{ flex: 'none', padding: '14px 16px', borderRadius: 22, background: 'var(--color-neutral-200)', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-800)', textWrap: 'pretty' }}>목표 카테고리는 최대 6개예요. 새로 넣으려면 하나를 지워 주세요.</div>
      ) : (
        <button onClick={() => add()} className="btn m-hover" style={{ flex: 'none', height: 48, border: '2px dashed var(--color-neutral-400)', borderRadius: 24, color: 'var(--color-neutral-800)', ...BODY, fontSize: 13.5 }}>+ 카테고리 추가 ({cats.length}/{MAX_GOAL_CATEGORIES})</button>
      )}
      {suggest.length > 0 && !full && (
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{stage.label}에게 추천해요</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggest.map(name => <button key={name} className="btn btn-secondary" onClick={() => add(name)} style={{ height: 34, padding: '0 14px', ...BODY, fontSize: 13 }}>+ {name}</button>)}
          </div>
        </div>
      )}

      {daily && (
        <div data-testid="daily-category" style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 26, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)' }}>일상 카테고리 · 1개 고정</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>목표 없이 생활 할 일과 시간 기록에 써요. 키워드는 기록 화면의 붓이 돼요. 색은 직접 골라요.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: PALETTE[daily.color].bg, borderRadius: 999, padding: '0 14px', height: 40 }}>
            <BlurInput label="일상 카테고리 이름" maxLength={MAX_CATEGORY_NAME} value={daily.name} onSave={name => update(daily, { name })} style={nameStyle} />
          </div>
          <div style={{ padding: '0 4px' }}>
            <Swatches size={24} value={daily.color} onPick={color => update(daily, { color })} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {keywords.map(k => (
              <span key={k.id} data-testid="keyword" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: 34, padding: '0 4px 0 12px', borderRadius: 999, background: PALETTE[daily.color].bg, color: PALETTE[daily.color].ink, fontSize: 13, fontWeight: 700 }}>
                {k.name}
                <button onClick={() => run(() => supabase.from('daily_keywords').update({ archived: true }).eq('id', k.id))} aria-label={k.name + ' 삭제'} style={{ width: 28, height: 28, borderRadius: '50%', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Svg d={ICON.x} size={12} /></button>
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input aria-label="키워드 추가" value={kw} maxLength={MAX_KEYWORD_NAME} onChange={e => setKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && addKeyword()} placeholder="+ 키워드" style={{ height: 34, width: 110, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', padding: '0 12px', ...BODY, fontWeight: 500, fontSize: 13, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
              {kw.trim() && <button className="btn btn-primary" onClick={addKeyword} style={{ height: 34, padding: '0 12px', fontSize: 12.5 }}>추가</button>}
            </span>
          </div>
        </div>
      )}
    </ScrollArea>
  );
}
