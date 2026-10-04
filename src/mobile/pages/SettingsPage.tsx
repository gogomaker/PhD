// 설정 (오른쪽에서 밀려 들어오는 화면): 프로필 · 하루 시작 시간 · 테마 · 회고 알림 · 비밀번호 · 내보내기 · 로그아웃 · 계정 삭제
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { errorText } from '../../lib/errors';
import { useAccount, useToday, type Profile } from '../../account/AccountProvider';
import { LIFE_STAGES } from '../../lib/lifeStage';
import { THEME_OPTIONS, useThemePref } from '../../lib/theme';
import { downloadExport } from '../../lib/exportData';
import { removeAllPhotos } from '../../lib/photos';
import { ScrollArea } from '../../ui/ScrollArea';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, CONTACT_MAILTO, useIsAdmin } from '../../ui/Contact';
import { ensurePush } from '../push';
import { BODY, Field, H, Sheet, SheetHead, Switch } from '../ui';

const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');
const PILL = { ...BODY, fontSize: 13, height: 38, padding: '0 14px' } as const;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 26, padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{title}</span>
      {children}
    </section>
  );
}

function Line({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
          {sub && <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>{sub}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

const TIMES = Array.from({ length: 144 }, (_, i) => `${String(Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}`);

export default function SettingsPage() {
  const { profile, session, run, toast } = useAccount();
  const admin = useIsAdmin();
  const today = useToday();
  const [pref, setPref] = useThemePref();
  const [name, setName] = useState(profile?.name ?? '');
  const [sheet, setSheet] = useState<null | 'password' | 'delete'>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => setName(profile?.name ?? ''), [profile?.name]);
  if (!profile) return null;
  const save = (patch: Partial<Profile>) => run(() => supabase.from('profiles').update(patch).eq('id', profile.id));
  const notifyTime = profile.review_notify_time.slice(0, 5);

  const doExport = async () => {
    setExporting(true);
    try {
      await downloadExport(today);
    } catch (e) {
      toast(errorText(e));
    }
    setExporting(false);
  };

  return (
    <ScrollArea data-testid="settings-page" fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 16px 44px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ flex: 'none', ...H, fontSize: 26, padding: '0 4px 4px' }}>설정</span>

      <Card title="나">
        <Field label="이름">
          <input
            className="input"
            aria-label="이름"
            maxLength={40}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => (name.trim() && name.trim() !== profile.name ? save({ name: name.trim() }) : setName(profile.name))}
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
          />
        </Field>
        <Field label="이메일">
          <input className="input" aria-label="이메일" value={session?.user.email ?? ''} readOnly style={{ color: 'var(--color-neutral-700)' }} />
        </Field>
        <Field label="지금 시기">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LIFE_STAGES.map(t => (
              <button key={t.key} className={pill(profile.life_stage === t.key)} aria-pressed={profile.life_stage === t.key} onClick={() => save({ life_stage: t.key })} style={PILL}>{t.label}</button>
            ))}
          </div>
        </Field>
      </Card>

      <Card title="플래너">
        <Line title="하루 시작 시간" sub="시간표의 첫 줄이에요. 이 시각 전은 아직 전날이에요. 바꿔도 칠한 기록은 실제 시각 그대로예요.">
          <div style={{ display: 'flex', gap: 6 }}>
            {[4, 5, 6].map(h => (
              <button key={h} className={pill(profile.day_start_hour === h)} aria-pressed={profile.day_start_hour === h} onClick={() => save({ day_start_hour: h })} style={{ ...PILL, flex: 1 }}>{String(h).padStart(2, '0')}시</button>
            ))}
          </div>
        </Line>
        <Line title="화면 테마" sub="이 기기에만 적용돼요.">
          <div style={{ display: 'flex', gap: 6 }}>
            {THEME_OPTIONS.map(([k, label]) => (
              <button key={k} className={pill(pref === k)} aria-pressed={pref === k} onClick={() => setPref(k)} style={{ ...PILL, flex: 1, padding: 0 }}>{label}</button>
            ))}
          </div>
        </Line>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>회고 알림</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>정한 시간까지 하루 기록을 안 썼으면 알려줘요.</span>
          </div>
          <Switch
            on={profile.review_notify_enabled}
            label="회고 알림"
            onChange={on => {
              save({ review_notify_enabled: on });
              if (on) ensurePush(); // 이 휴대폰을 알림 받을 곳으로 (처음 한 번 허락을 받는다)
            }}
          />
        </div>
        {profile.review_notify_enabled && (
          <Field label="알림 시간">
            <select className="input" aria-label="알림 시간" value={notifyTime} onChange={e => save({ review_notify_time: e.target.value })} style={{ height: 44, fontWeight: 700, cursor: 'pointer' }}>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}
      </Card>

      {/* 수정사항·문의 받는 곳 (2026-10-04 기획 요청) */}
      <Card title="문의">
        <Line title="수정사항·문의사항" sub={`${CONTACT_EMAIL} 으로 보내 주세요.`}>
          <a className="btn btn-secondary" href={CONTACT_MAILTO} style={{ ...PILL, alignSelf: 'flex-start', textDecoration: 'none' }}>메일 보내기</a>
        </Line>
        {admin && (
          <Line title="관리 페이지" sub="가입자 수, DAU·WAU (관리자만 보여요)">
            <Link className="btn btn-secondary" to="/admin" style={{ ...PILL, alignSelf: 'flex-start', textDecoration: 'none' }}>열기</Link>
          </Line>
        )}
      </Card>

      <Card title="로그인과 데이터">
        <Line title="비밀번호" sub={'이메일 로그인 · ' + (session?.user.email ?? '')}>
          <button className="btn btn-secondary" onClick={() => setSheet('password')} style={{ ...PILL, alignSelf: 'flex-start' }}>비밀번호 변경</button>
        </Line>
        <Line title="데이터 내보내기" sub="꿈·목표, 계획, 할 일, 시간 기록, 하루 기록, 회고를 엑셀에서 열리는 표로 묶어 받아요.">
          <button className="btn btn-secondary" disabled={exporting} onClick={doExport} style={{ ...PILL, alignSelf: 'flex-start' }}>{exporting ? '만드는 중…' : '내보내기'}</button>
        </Line>
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={() => supabase.auth.signOut({ scope: 'local' })} style={{ flex: 1, height: 46 }}>로그아웃</button>
          <button className="btn btn-ghost" onClick={() => setSheet('delete')} style={{ flex: 'none', height: 46, ...BODY, color: 'var(--color-accent-700)' }}>계정 삭제</button>
        </div>
      </Card>

      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteSheet onClose={() => setSheet(null)} />}
    </ScrollArea>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
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
    <Sheet onClose={onClose} label="비밀번호 변경">
      <SheetHead title="비밀번호 변경" />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="새 비밀번호"><input className="input" aria-label="새 비밀번호" type="password" autoComplete="new-password" placeholder="8자 이상" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <Field label="한 번 더"><input className="input" aria-label="새 비밀번호 확인" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--color-accent-800)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, height: 46, ...BODY }}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ flex: 1, height: 46 }}>바꾸기</button>
        </div>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
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
    <Sheet onClose={onClose} label="계정 삭제">
      <SheetHead title="계정을 삭제할까요?" />
      <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-neutral-800)', textWrap: 'pretty' }}>꿈, 카테고리, 목표, 계획, 하루 기록이 모두 지워지고 되돌릴 수 없어요.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, height: 46, ...BODY }}>취소</button>
        <button className="btn btn-primary" disabled={busy} onClick={confirm} style={{ flex: 1, height: 46 }}>삭제하기</button>
      </div>
    </Sheet>
  );
}
