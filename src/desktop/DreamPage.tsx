import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount, type Profile } from '../account/AccountProvider';
import { BlurInput } from '../ui/BlurInput';

const AREA = { width: '100%', font: 'inherit', fontSize: 14.5, lineHeight: 1.6, background: 'transparent', border: 0, outline: 'none', resize: 'none', color: 'var(--color-text)', padding: 0 } as const;

// 꿈 작성: 궁극적 꿈(선택), 왜 이 꿈인가, 꿈을 이룬 나의 하루
export default function DreamPage() {
  const { profile, run } = useAccount();
  const navigate = useNavigate();
  if (!profile) return null;
  const save = (patch: Partial<Profile>) => run(() => supabase.from('profiles').update(patch).eq('id', profile.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 900 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tag tag-accent" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>꿈 · 꿈 작성</span>
        <h1 style={{ margin: 0, fontSize: 42 }}>궁극적인 꿈</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>모든 카테고리와 목표가 향하는 한 문장이에요. 여기서 쓴 꿈은 사이드바에 늘 떠 있어요.</p>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-accent-200)', borderRadius: 40, padding: '36px 40px 40px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: 'var(--color-accent-800)' }}>나의 꿈</span>
        <BlurInput
          multiline
          rows={2}
          required={false}
          maxLength={200}
          label="나의 꿈"
          placeholder="한 문장으로 적어보세요"
          value={profile.dream ?? ''}
          onSave={v => save({ dream: v || null })}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 10, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 46, lineHeight: 1.15, background: 'transparent', border: 0, outline: 'none', resize: 'none', color: 'var(--color-text)', padding: 0, fieldSizing: 'content' } as CSSProperties}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: 32, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>왜 이 꿈인가요?</span>
          <BlurInput multiline rows={4} required={false} maxLength={2000} label="왜 이 꿈인가요?" placeholder="이 꿈을 품게 된 이유" value={profile.dream_why ?? ''} onSave={v => save({ dream_why: v || null })} style={AREA} />
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: 32, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>꿈을 이룬 나의 하루</span>
          <BlurInput multiline rows={4} required={false} maxLength={2000} label="꿈을 이룬 나의 하루" placeholder="그날 아침부터 밤까지를 떠올려 적어보세요" value={profile.dream_day ?? ''} onSave={v => save({ dream_day: v || null })} style={AREA} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/categories')}>카테고리로 나누기</button>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>꿈 → 인생 카테고리 → 목표 설정 → 꿈 보드 순서로 구체화해요.</span>
      </div>
    </div>
  );
}
