// 계정 시트 (앱바의 내 이니셜): 이름·이메일, 지금 시기, 카테고리 관리, 꿈 다듬기, 설정, 로그아웃
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount } from '../account/AccountProvider';
import { initials } from '../lib/initials';
import { lifeStageOf } from '../lib/lifeStage';
import { BODY, H, ICON, Sheet, Svg } from './ui';

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { profile, session } = useAccount();
  const navigate = useNavigate();
  // 시트 안에서 다른 화면으로 갈 때는 시트 기록 칸을 바꿔 끼운다 (뒤로 가기 한 번에 돌아오도록)
  const open = (to: string) => {
    onClose();
    navigate(to, { replace: true });
  };
  const row = { border: 0, background: 'transparent', cursor: 'pointer', ...BODY, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 12px', borderRadius: 16, fontSize: 14, textAlign: 'left' } as const;
  return (
    <Sheet onClose={onClose} label="계정">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ flex: 'none', width: 56, height: 56, borderRadius: '50%', background: 'var(--color-accent-2)', color: 'var(--color-bg)', display: 'grid', placeItems: 'center', ...BODY, fontSize: 17 }}>{initials(profile?.name ?? '')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ ...H }}>{profile?.name}</span>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user.email}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--color-surface)', borderRadius: 22, padding: 6 }}>
        <button className="m-hover" onClick={() => open('/settings')} style={row}>
          지금 시기<span style={{ marginLeft: 'auto', fontWeight: 500, color: 'var(--color-neutral-700)' }}>{lifeStageOf(profile?.life_stage).label}</span>
        </button>
        <button className="m-hover" onClick={() => open('/categories')} style={row}>카테고리 관리<Svg d={ICON.right} size={14} /></button>
        <button className="m-hover" onClick={() => open('/dream')} style={row}>꿈 다듬기<Svg d={ICON.right} size={14} /></button>
        <button className="m-hover" onClick={() => open('/settings')} style={row}>설정<Svg d={ICON.right} size={14} /></button>
      </div>
      <button className="btn btn-secondary" onClick={() => supabase.auth.signOut({ scope: 'local' })} style={{ flex: 'none', height: 46, ...BODY }}>로그아웃</button>
    </Sheet>
  );
}
