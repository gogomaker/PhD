import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { useAccount, useToday, type Goal } from '../account/AccountProvider';
import { PALETTE } from '../lib/palette';
import { userDayKey } from '../lib/day';
import { hours, shortDate } from '../lib/tracking';
import { removePhotos, shrinkPhoto, uploadPhoto } from '../lib/photos';
import { PILL_STYLE } from '../ui/Dialog';
import { ScrollArea } from '../ui/ScrollArea';

const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');
type Kind = 'completed' | 'dropped';
export const RETRO_QS = [
  ['retro_achieved', '무엇을 해냈나요'],
  ['retro_regret', '아쉬웠던 점'],
  ['retro_next', '다음에 다르게 할 것'],
] as const;
type RetroKey = (typeof RETRO_QS)[number][0];

// 목표 마무리 팝업 (R-G5~G8): 자동 요약 → 완성/중도 → (완성만) 인증사진 → 회고 3칸
export function WrapDialog({ goal: g, onClose }: { goal: Goal; onClose: () => void }) {
  const { goalCategories, profile, session, reload, toast } = useAccount();
  const today = useToday();
  const p = PALETTE[goalCategories.find(c => c.id === g.category_id)?.color ?? 'red'];
  const cat = goalCategories.find(c => c.id === g.category_id);
  const [kind, setKind] = useState<Kind>('completed');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [retro, setRetro] = useState<Record<RetroKey, string>>({ retro_achieved: '', retro_regret: '', retro_next: '' });
  const [totals, setTotals] = useState<{ actual_slots: number; done_tasks: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('goal_totals').then(({ data }) => setTotals((data as { goal_id: string; actual_slots: number; done_tasks: number }[] | null)?.find(t => t.goal_id === g.id) ?? { actual_slots: 0, done_tasks: 0 }));
  }, [g.id]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const start = userDayKey(new Date(g.started_at ?? g.created_at), profile?.timezone, profile?.day_start_hour);
  const stats = [
    ['기간', `${shortDate(start)} – ${shortDate(today)}`],
    ['누적 시간', totals ? hours(totals.actual_slots) + '시간' : '…'],
    ['완료한 실천', totals ? totals.done_tasks + '개' : '…'],
  ];

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await shrinkPhoto(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast('이 사진은 열 수 없어요. JPG나 PNG로 올려 주세요');
    }
  }

  async function confirm() {
    if (!session) return;
    setBusy(true);
    let path: string | null = null;
    if (kind === 'completed' && photo) {
      const up = await uploadPhoto(session.user.id, g.id, photo.blob);
      if (up.error) {
        setBusy(false);
        return toast(errorText(up.error));
      }
      path = up.path;
    }
    const { error } = await supabase.rpc('finish_goal', { p_goal: g.id, p_kind: kind, p_photo: path, p_achieved: retro.retro_achieved, p_regret: retro.retro_regret, p_next: retro.retro_next });
    if (error) {
      if (path) await removePhotos([path]);
      setBusy(false);
      toast(errorText(error));
      return;
    }
    await reload();
    toast('마무리했어요. 회고는 회고 모음에 남아요');
    onClose();
  }

  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ zIndex: 50, padding: 24 }}>
      <ScrollArea className="dialog" role="dialog" aria-label={g.name + ' 마무리하기'} onClick={e => e.stopPropagation()} fade="var(--color-surface)" radius={32} style={{ width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 48px)', padding: 0, display: 'flex' }} innerStyle={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: p.ink }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.dot }} />{cat?.name}
          </span>
          <h2 className="dialog-title" style={{ margin: 0, fontSize: 30 }}>{g.name} 마무리하기</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }} data-testid="wrap-stats">
          {stats.map(([k, v]) => (
            <div key={k} style={{ background: p.bg, borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: p.ink }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, lineHeight: 1.25 }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="field">
          <label>마무리 종류</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['completed', 'dropped'] as const).map(k => (
              <button key={k} className={pill(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)} style={{ ...PILL_STYLE, fontSize: 14, flex: 1 }}>{k === 'completed' ? '완성' : '중도 마무리'}</button>
            ))}
          </div>
        </div>
        {kind === 'completed' && (
          <div className="field" data-testid="wrap-photo">
            <span style={{ fontSize: 13, fontWeight: 700 }}>인증사진 · 1장 (선택)</span>
            <label style={{ position: 'relative', display: 'grid', placeItems: 'center', height: 170, borderRadius: 24, border: '2px dashed var(--color-neutral-400)', background: 'var(--color-neutral-100)', cursor: 'pointer', overflow: 'hidden', fontSize: 13.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
              {photo ? <img src={photo.url} alt="인증사진" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>눌러서 사진을 올려 주세요</span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="인증사진" onChange={e => pick(e.target.files?.[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </label>
          </div>
        )}
        {RETRO_QS.map(([k, q]) => (
          <div key={k} className="field">
            <label htmlFor={'wrap-' + k}>{q}</label>
            <textarea id={'wrap-' + k} className="input" rows={2} maxLength={1000} value={retro[k]} onChange={e => setRetro(r => ({ ...r, [k]: e.target.value }))} style={{ resize: 'none', height: 'auto', paddingTop: 10, paddingBottom: 10, lineHeight: 1.5, borderRadius: 20, font: 'inherit' }} />
          </div>
        ))}
        <div style={{ padding: '10px 14px', borderRadius: 16, background: 'var(--color-neutral-200)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-800)' }}>
          마무리한 목표는 다시 열 수 없어요. 계획 표에서 빠지고, 회고는 회고 모음에 남아요.
        </div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose} style={PILL_STYLE}>취소</button>
          <button className="btn btn-primary" disabled={busy} onClick={confirm}>마무리하기</button>
        </div>
      </ScrollArea>
    </div>
  );
}
