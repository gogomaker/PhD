// 꿈 (오른쪽에서 밀려 들어오는 화면): 나의 꿈 · 왜 이 꿈인가요 · 꿈을 이룬 나의 하루. 칸을 벗어나면 저장
import type { CSSProperties } from 'react';
import { supabase } from '../../lib/supabase';
import { useAccount, type Profile } from '../../account/AccountProvider';
import { BlurInput } from '../../ui/BlurInput';
import { ScrollArea } from '../../ui/ScrollArea';
import { H } from '../ui';

const AREA = { width: '100%', fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, background: 'transparent', border: 0, outline: 'none', resize: 'none', color: 'var(--color-text)', padding: 0 } as const;

export default function DreamPage() {
  const { profile, run } = useAccount();
  if (!profile) return null;
  const save = (patch: Partial<Profile>) => run(() => supabase.from('profiles').update(patch).eq('id', profile.id));
  return (
    <ScrollArea data-testid="dream-page" fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 16px 44px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flex: 'none', background: 'var(--color-accent-200)', borderRadius: 32, padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-800)' }}>나의 꿈</span>
        <BlurInput multiline rows={3} required={false} maxLength={200} label="나의 꿈" placeholder="한 문장으로 적어보세요" value={profile.dream ?? ''} onSave={v => save({ dream: v || null })} style={{ ...AREA, ...H, fontSize: 28, lineHeight: 1.2, wordBreak: 'keep-all' } as CSSProperties} />
      </div>
      <div style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 28, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>왜 이 꿈인가요?</span>
        <BlurInput multiline rows={4} required={false} maxLength={2000} label="왜 이 꿈인가요?" placeholder="이 꿈을 품게 된 이유" value={profile.dream_why ?? ''} onSave={v => save({ dream_why: v || null })} style={AREA} />
      </div>
      <div style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 28, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>꿈을 이룬 나의 하루</span>
        <BlurInput multiline rows={4} required={false} maxLength={2000} label="꿈을 이룬 나의 하루" placeholder="그날 아침부터 밤까지를 떠올려 적어보세요" value={profile.dream_day ?? ''} onSave={v => save({ dream_day: v || null })} style={AREA} />
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', padding: '0 6px' }}>꿈 → 카테고리 → 목표 → 계획 순서로 구체화해요.</span>
    </ScrollArea>
  );
}
