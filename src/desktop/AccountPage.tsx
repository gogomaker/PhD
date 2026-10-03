import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { removeAllPhotos } from '../lib/photos';
import { ensurePush } from '../mobile/push';
import { THEME_OPTIONS, useThemePref } from '../lib/theme';
import { downloadExport } from '../lib/exportData';
import { errorText } from '../lib/errors';
import { useAccount, useToday, type Profile } from '../account/AccountProvider';
import { LIFE_STAGES } from '../lib/lifeStage';
import { initials } from '../lib/initials';

const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');
const PILL_STYLE = { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 } as const;

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 32, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {title && <h3 style={{ margin: 0, fontSize: 22 }}>{title}</h3>}
      {children}
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{sub}</span>
      </div>
      {children}
    </div>
  );
}

function timeLabel(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + '시' + (m ? ' ' + m + '분' : '');
}

export default function AccountPage() {
  const { profile, session, run } = useAccount();
  const [name, setName] = useState(profile?.name ?? '');
  const [dialog, setDialog] = useState<'password' | 'delete' | null>(null);
  useEffect(() => setName(profile?.name ?? ''), [profile?.name]);
  if (!profile) return null;

  const save = (patch: Partial<Profile>) => run(() => supabase.from('profiles').update(patch).eq('id', profile.id));
  const notifyTime = profile.review_notify_time.slice(0, 5);
  const since = new Date(profile.created_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 780 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tag tag-neutral" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>계정</span>
        <h1 style={{ margin: 0, fontSize: 42 }}>계정 관리</h1>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ flex: 'none', width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-2)', color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22 }}>{initials(profile.name)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h3 style={{ margin: 0, fontSize: 24 }}>{profile.name}</h3>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{since.getFullYear()}년 {since.getMonth() + 1}월부터 함께하는 중</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div className="field">
            <label htmlFor="acc-name">이름</label>
            <input
              id="acc-name"
              className="input"
              maxLength={40}
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => (name.trim() && name.trim() !== profile.name ? save({ name: name.trim() }) : setName(profile.name))}
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
            />
          </div>
          <div className="field">
            <label htmlFor="acc-email">이메일</label>
            <input id="acc-email" className="input" value={session?.user.email ?? ''} readOnly style={{ color: 'var(--color-neutral-700)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>지금 나는</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LIFE_STAGES.map(t => (
              <button key={t.key} className={pill(profile.life_stage === t.key)} aria-pressed={profile.life_stage === t.key} onClick={() => save({ life_stage: t.key })} style={PILL_STYLE}>{t.label}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="플래너 설정">
        <Row title="하루 시작 시간" sub="오늘 시간표의 첫 줄이에요. 이 시각 전은 아직 전날이에요. 바꿔도 칠한 기록은 실제 시각 그대로예요.">
          <div style={{ display: 'flex', gap: 6 }}>
            {[4, 5, 6].map(h => (
              <button key={h} className={pill(profile.day_start_hour === h)} aria-pressed={profile.day_start_hour === h} onClick={() => save({ day_start_hour: h })} style={PILL_STYLE}>{String(h).padStart(2, '0')}시</button>
            ))}
          </div>
        </Row>
        <ThemeRow />
        <Row title="회고 알림" sub="매일 정한 시간에 오늘 시간을 칠했는지 알려줘요.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile.review_notify_enabled && (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{timeLabel(notifyTime)}</span>
                <input className="input" type="time" step={600} value={notifyTime} onChange={e => e.target.value && save({ review_notify_time: e.target.value })} aria-label="알림 시간" style={{ width: 132, height: 40, fontWeight: 700 }} />
              </>
            )}
            <button
              role="switch"
              aria-checked={profile.review_notify_enabled}
              aria-label="회고 알림"
              onClick={() => {
                const on = !profile.review_notify_enabled;
                save({ review_notify_enabled: on });
                if (on) ensurePush(); // 이 기기를 알림 받을 곳으로 (휴대폰은 하루 기록을 저장할 때 허락을 받는다)
              }}
              style={{ width: 52, height: 30, borderRadius: 999, border: 0, padding: 3, cursor: 'pointer', background: profile.review_notify_enabled ? 'var(--color-accent-2)' : 'var(--color-neutral-400)', display: 'flex', justifyContent: profile.review_notify_enabled ? 'flex-end' : 'flex-start' }}
            >
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-neutral-100)', boxShadow: 'var(--shadow-sm)' }} />
            </button>
          </div>
        </Row>
      </Card>

      <Card title="로그인과 데이터">
        <Row title="로그인 계정" sub={'이메일 · ' + (session?.user.email ?? '')}>
          <button className="btn btn-secondary" onClick={() => setDialog('password')} style={PILL_STYLE}>비밀번호 변경</button>
        </Row>
        <ExportRow />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          <button className="btn btn-ghost" onClick={() => setDialog('delete')} style={{ color: 'var(--color-accent-700)', fontFamily: 'var(--font-body)', fontWeight: 700 }}>계정 삭제</button>
        </div>
      </Card>

      {dialog === 'password' && <PasswordDialog onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <DeleteDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ zIndex: 50 }}>
      <div className="dialog" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <h2 className="dialog-title" style={{ margin: 0, fontSize: 26 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useAccount();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('비밀번호는 8자 이상이어야 해요');
    if (pw !== pw2) return setError('두 비밀번호가 달라요');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(errorText(error));
    toast('비밀번호를 바꿨어요');
    onClose();
  }

  return (
    <Dialog title="비밀번호 변경" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field"><label htmlFor="pw-new">새 비밀번호</label><input id="pw-new" className="input" type="password" autoComplete="new-password" placeholder="8자 이상" value={pw} onChange={e => setPw(e.target.value)} /></div>
        <div className="field"><label htmlFor="pw-new2">한 번 더</label><input id="pw-new2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></div>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--color-accent-800)' }}>{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} style={PILL_STYLE}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>바꾸기</button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ onClose }: { onClose: () => void }) {
  const { toast, session } = useAccount();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    if (session) await removeAllPhotos(session.user.id); // 인증사진 먼저 (저장소는 DB 삭제로 안 지워진다)
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      setBusy(false);
      toast(errorText(error));
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <Dialog title="계정을 삭제할까요?" onClose={onClose}>
      <p className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>꿈, 카테고리, 목표, 계획 표, 하루 기록이 모두 지워지고 되돌릴 수 없어요.</p>
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose} style={PILL_STYLE}>취소</button>
        <button className="btn btn-primary" disabled={busy} onClick={confirm}>삭제하기</button>
      </div>
    </Dialog>
  );
}

// 화면 테마: 이 기기에만 저장 (2026-10-01 기획 결정)
function ThemeRow() {
  const [pref, setPref] = useThemePref();
  return (
    <Row title="화면 테마" sub="이 기기에만 적용돼요. 시스템 설정은 기기의 다크 모드를 따라가요.">
      <div style={{ display: 'flex', gap: 6 }}>
        {THEME_OPTIONS.map(([k, label]) => (
          <button key={k} className={pill(pref === k)} aria-pressed={pref === k} onClick={() => setPref(k)} style={PILL_STYLE}>{label}</button>
        ))}
      </div>
    </Row>
  );
}

// 데이터 내보내기: 압축 파일 하나에 엑셀용 CSV 여러 개 (2026-10-01 기획 결정)
function ExportRow() {
  const { toast } = useAccount();
  const today = useToday();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await downloadExport(today);
    } catch (e) {
      toast(errorText(e));
    }
    setBusy(false);
  };
  return (
    <Row title="데이터 내보내기" sub="꿈·목표, 계획 표, 할 일, 시간 기록, 하루 기록, 회고를 엑셀에서 열리는 표(CSV)로 묶어 받아요.">
      <button className="btn btn-secondary" disabled={busy} onClick={go} style={PILL_STYLE}>{busy ? '만드는 중…' : '내보내기'}</button>
    </Row>
  );
}
