import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRemember, setRemember, supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { useAccount } from '../account/AccountProvider';
import { useIsMobile } from '../useIsMobile';
import { Logo } from '../ui/Logo';
import { Swatches } from '../account/Swatches';
import { CATEGORY_POOL, LIFE_STAGES, lifeStageOf, type LifeStage } from '../lib/lifeStage';
import { MAX_CATEGORY_NAME, MAX_GOAL_CATEGORIES, goalColor, toggleDraft } from '../lib/categories';
import { PALETTE, type CategoryColor } from '../lib/palette';

const STEPS = ['계정', '나에 대해', '카테고리', '꿈'];
const BIG = { height: 48, fontSize: 16 } as const;
const SECONDARY = { height: 48, fontFamily: 'var(--font-body)', fontWeight: 700 } as const;
const BACK = { ...SECONDARY, flex: 'none', padding: '0 22px' } as const;

// 로그인·가입 화면: 왼쪽 브랜드 판 + 오른쪽 폼 (목업 isAuth).
// 휴대폰은 'PhD only for Mobile v2' 목업: 맨 위 ‹ 뒤로 + 단계 막대, 그 아래 폼 (docs/MOBILE.md)
function AuthLayout({ step, onBack, children }: { step?: number; onBack?: () => void; children: ReactNode }) {
  const mobile = useIsMobile();
  const steps = step !== undefined && (
    <div style={{ flex: 1, display: 'flex', gap: 6 }}>
      {STEPS.map((label, i) => (
        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ height: 6, borderRadius: 99, background: i <= step ? 'var(--color-accent)' : 'var(--color-neutral-300)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: i <= step ? 'var(--color-accent-700)' : 'var(--color-neutral-600)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
  if (mobile) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 'max(14px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom))', boxSizing: 'border-box', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 40, marginLeft: -10 }}>
          {onBack ? (
            <button onClick={onBack} aria-label="뒤로" className="btn" style={{ flex: 'none', width: 40, height: 40, padding: 0, marginTop: step !== undefined ? -12 : 0, color: 'var(--color-text)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          ) : (
            <span style={{ flex: 'none', width: 10 }} />
          )}
          {steps}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexWrap: 'wrap', gap: 14, padding: 14, boxSizing: 'border-box' }}>
      <div style={{ flex: '1 1 440px', minHeight: 560, background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', borderRadius: 40, position: 'relative', overflow: 'hidden', padding: '44px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span style={{ position: 'absolute', right: -90, bottom: -110, width: 380, height: 380, borderRadius: '50%', background: 'var(--color-neutral-100)' }} />
        <span style={{ position: 'absolute', right: 190, bottom: 170, width: 120, height: 120, borderRadius: '50%', background: 'var(--color-accent-2-400)' }} />
        <span style={{ position: 'absolute', right: 70, top: 90, width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent-300)' }} />
        <span style={{ position: 'relative', alignSelf: 'flex-start' }}><Logo height={76} /></span>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}>
          <h1 style={{ margin: 0, fontSize: 60, lineHeight: 1.02 }}>Plan Higher Dream</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, textWrap: 'pretty' }}>꿈을 카테고리와 목표로 나누고, 연간·월간·주간 계획을 거쳐 오늘 할 일까지 이어요.</p>
        </div>
      </div>
      <div style={{ flex: '1 1 400px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 384, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {steps && <div style={{ display: 'flex' }}>{steps}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** 휴대폰 첫 화면 (로그인 전): 브랜드 판 + 시작하기 / 이미 계정이 있어요 (목업 landing) */
export function Landing() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 24, padding: 'max(12px, env(safe-area-inset-top)) 12px max(28px, env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, minHeight: 440, position: 'relative', overflow: 'hidden', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', borderRadius: 40, padding: '28px 18px 34px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span aria-hidden="true" style={{ position: 'absolute', right: -90, bottom: -130, width: 330, height: 330, borderRadius: '50%', background: 'var(--color-neutral-100)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: '37%', bottom: 190, width: 92, height: 92, borderRadius: '50%', background: 'var(--color-accent-2-400)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', right: 46, top: 112, width: 52, height: 52, borderRadius: '50%', background: 'var(--color-accent-300)' }} />
        <span style={{ position: 'relative', alignSelf: 'flex-start' }}><Logo height={60} /></span>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px' }}>
          <h1 style={{ margin: 0, fontSize: 46, lineHeight: 1.02 }}>Plan Higher Dream</h1>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, textWrap: 'pretty' }}>꿈을 카테고리와 목표로 나누고, 연간·월간·주간 계획을 거쳐 오늘의 10분까지 이어요.</p>
        </div>
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px' }}>
        <button className="btn btn-primary" onClick={() => navigate('/signup')} style={{ height: 52, fontSize: 16 }}>시작하기</button>
        <button className="btn btn-secondary" onClick={() => navigate('/login')} style={{ height: 52, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15 }}>이미 계정이 있어요</button>
      </div>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 style={{ margin: 0, fontSize: 34 }}>{title}</h2>
      {sub && <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>{sub}</p>}
    </div>
  );
}

// 로그인 상태 유지: 끄면 이 브라우저 창을 닫을 때 로그아웃돼요
function RememberCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="remember-check" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 7, boxSizing: 'border-box', display: 'grid', placeItems: 'center', border: checked ? 0 : '2px solid var(--color-neutral-400)', background: checked ? 'var(--color-accent)' : 'transparent', color: 'var(--color-neutral-100)' }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </span>
      로그인 상태 유지
    </label>
  );
}

function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" style={{ margin: 0, padding: '10px 16px', borderRadius: 16, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontSize: 13.5, fontWeight: 600 }}>{text}</p>;
}

// ───────── 로그인 ─────────
export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRememberState] = useState(getRemember);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setRemember(remember);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(errorText(error));
  }

  return (
    <AuthLayout onBack={() => navigate('/')}>
      <Heading title="다시 만나서 반가워요" sub="로그인하고 오늘의 계획을 이어가세요." />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label htmlFor="login-email">이메일</label><input id="login-email" className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="login-password">비밀번호</label><input id="login-password" className="input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <RememberCheck checked={remember} onChange={setRememberState} />
            <Link to="/forgot-password" style={{ fontSize: 13 }}>비밀번호를 잊었어요</Link>
          </div>
        </div>
        <FormError text={error} />
        <button className="btn btn-primary" type="submit" disabled={busy} style={BIG}>{busy ? '로그인 중…' : '로그인'}</button>
      </form>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>처음이신가요? <Link to="/signup" style={{ fontWeight: 700 }}>회원가입</Link></p>
    </AuthLayout>
  );
}

// ───────── 가입 1단계: 계정 ─────────
export function SignupAccount() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('이름을 적어 주세요');
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 해요');
    setBusy(true);
    setError(null);
    setRemember(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
    setBusy(false);
    if (error) return setError(errorText(error));
    // 이미 가입된 이메일이면 세션 없이 가짜 사용자가 돌아온다
    if (!data.session) setError('이미 가입된 이메일이에요. 로그인해 주세요');
  }

  return (
    <AuthLayout step={0} onBack={() => navigate('/')}>
      <Heading title="계정 만들기" sub="계획은 계정마다 따로 저장돼요." />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label htmlFor="su-name">이름</label><input id="su-name" className="input" autoComplete="name" maxLength={40} required value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="su-email">이메일</label><input id="su-email" className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="su-password">비밀번호</label><input id="su-password" className="input" type="password" autoComplete="new-password" placeholder="8자 이상" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        </div>
        <FormError text={error} />
        <button className="btn btn-primary" type="submit" disabled={busy} style={BIG}>{busy ? '만드는 중…' : '다음'}</button>
      </form>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>이미 계정이 있나요? <Link to="/login" style={{ fontWeight: 700 }}>로그인</Link></p>
    </AuthLayout>
  );
}

// ───────── 가입 2~4단계: 시기 → 카테고리 → 꿈 ─────────
export function Onboarding() {
  const { profile, dailyCategory, run } = useAccount();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stage, setStage] = useState<LifeStage | null>((profile?.life_stage as LifeStage) ?? null);
  const [cats, setCats] = useState<string[]>([]);
  const [dailyColor, setDailyColor] = useState<CategoryColor>(dailyCategory?.color ?? 'purple');
  const [dream, setDream] = useState('');
  const [busy, setBusy] = useState(false);

  async function finish(withDream: boolean) {
    setBusy(true);
    await run(() => supabase.rpc('complete_onboarding', { p_life_stage: stage, p_categories: cats, p_daily_color: dailyColor, p_dream: withDream ? dream : null }));
    setBusy(false);
  }

  if (step === 1) {
    return (
      <AuthLayout step={1}>
        <Heading title="지금 어떤 시기인가요?" sub="고른 시기에 맞춰 카테고리를 추천해 드려요. 나중에 계정 설정에서 바꿀 수 있어요." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LIFE_STAGES.map(t => {
            const on = stage === t.key;
            return (
              <button key={t.key} type="button" aria-pressed={on} onClick={() => setStage(t.key)} style={{ textAlign: 'left', border: 0, cursor: 'pointer', font: 'inherit', color: 'var(--color-text)', padding: '14px 16px', borderRadius: 24, background: on ? 'var(--color-accent-100)' : 'var(--color-surface)', boxShadow: on ? 'inset 0 0 0 2px var(--color-accent)' : 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{t.label}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{t.desc}</span>
              </button>
            );
          })}
        </div>
        <button className="btn btn-primary" disabled={!stage} onClick={() => setStep(2)} style={BIG}>카테고리 정하기</button>
      </AuthLayout>
    );
  }

  if (step === 2) {
    const rec: readonly string[] = lifeStageOf(stage).cats;
    const pool = [...CATEGORY_POOL, ...cats.filter(n => !CATEGORY_POOL.includes(n))];
    const full = cats.length >= MAX_GOAL_CATEGORIES;
    const chip = (name: string) => {
      // 색은 고른 순서대로 (빨강부터, 일상 색은 건너뜀)
      const i = cats.indexOf(name);
      const c = i >= 0;
      const p = c ? PALETTE[goalColor(i, dailyColor)] : null;
      return (
        <button key={name} type="button" aria-pressed={!!c} onClick={() => setCats(d => toggleDraft(d, name))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 999, border: 0, cursor: !c && full ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, background: p ? p.bg : 'var(--color-surface)', color: p ? p.ink : 'var(--color-neutral-800)', boxShadow: p ? 'inset 0 0 0 2px ' + p.dot : 'none', opacity: !c && full ? 0.45 : 1 }}>
          {c ? '✓ ' : '+ '}{name}
        </button>
      );
    };
    return (
      <AuthLayout step={2} onBack={() => setStep(1)}>
        <Heading title="삶을 어떤 영역으로 나눌까요?" sub="목표 카테고리는 최대 6개까지 고를 수 있어요. 고른 카테고리마다 목표를 세우게 돼요." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-700)' }}>{lifeStageOf(stage).label}에게 추천</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{rec.map(chip)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>다른 카테고리</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pool.filter(n => !rec.includes(n)).map(chip)}
            <input
              placeholder="+ 직접 입력 후 Enter"
              maxLength={MAX_CATEGORY_NAME}
              disabled={full}
              onKeyDown={e => {
                const v = e.currentTarget.value.trim();
                if (e.key === 'Enter' && v && !e.nativeEvent.isComposing) {
                  if (!cats.includes(v)) setCats(d => toggleDraft(d, v));
                  e.currentTarget.value = '';
                }
              }}
              style={{ height: 40, width: 170, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', padding: '0 14px', font: 'inherit', fontSize: 13.5, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>목표 카테고리 {cats.length} / {MAX_GOAL_CATEGORIES}개 선택</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-surface)', borderRadius: 24, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: PALETTE[dailyColor].dot }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{dailyCategory?.name ?? '일상'}</span>
            <span className="tag tag-neutral" style={{ fontWeight: 700, fontSize: 11 }}>기본 포함</span>
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>목표 없이 시간 기록과 생활 할 일에 쓰는 카테고리예요. 색만 골라 주세요. 목표 카테고리는 고른 순서대로 남은 색을 받아요.</span>
          <Swatches value={dailyColor} onPick={setDailyColor} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setStep(1)} style={BACK}>이전</button>
          <button className="btn btn-primary" disabled={cats.length === 0} onClick={() => setStep(3)} style={{ ...BIG, flex: 1 }}>다음</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout step={3} onBack={() => setStep(2)}>
      <Heading title="궁극적인 꿈은 무엇인가요?" sub="모든 목표와 계획이 이 한 문장을 향해요. 언제든 꿈 작성에서 다듬을 수 있어요." />
      <div style={{ background: 'var(--color-accent-200)', borderRadius: 28, padding: '18px 22px' }}>
        <textarea value={dream} onChange={e => setDream(e.target.value)} maxLength={200} rows={2} placeholder="한 문장으로 적어보세요" aria-label="나의 꿈" style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, lineHeight: 1.25, background: 'transparent', border: 0, outline: 'none', resize: 'none', color: 'var(--color-text)', padding: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" disabled={busy} onClick={() => setStep(2)} style={BACK}>이전</button>
        <button className="btn btn-primary" disabled={busy || !dream.trim()} onClick={() => finish(true)} style={{ ...BIG, flex: 1 }}>PhD 시작하기</button>
      </div>
      <button className="btn btn-ghost" disabled={busy} onClick={() => finish(false)} style={{ alignSelf: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14 }}>나중에 쓸게요</button>
    </AuthLayout>
  );
}

// ───────── 비밀번호 찾기 ─────────
export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset-password' });
    setBusy(false);
    if (error) setError(errorText(error));
    else setSent(true);
  }

  return (
    <AuthLayout onBack={() => navigate('/login')}>
      <Heading title="비밀번호 다시 만들기" sub={sent ? '메일함을 확인해 주세요. 메일의 링크를 누르면 새 비밀번호를 정할 수 있어요.' : '가입한 이메일로 비밀번호를 다시 만드는 링크를 보내 드려요.'} />
      {!sent && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="field"><label htmlFor="fp-email">이메일</label><input id="fp-email" className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <FormError text={error} />
          <button className="btn btn-primary" type="submit" disabled={busy} style={BIG}>{busy ? '보내는 중…' : '링크 보내기'}</button>
        </form>
      )}
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}><Link to="/login" style={{ fontWeight: 700 }}>로그인으로 돌아가기</Link></p>
    </AuthLayout>
  );
}

// ───────── 메일 링크로 들어와 새 비밀번호 정하기 ─────────
export function ResetPassword() {
  const { session } = useAccount();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 해요');
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(errorText(error));
    else navigate('/', { replace: true });
  }

  if (!session) {
    return (
      <AuthLayout>
        <Heading title="링크가 만료됐어요" sub="비밀번호 찾기를 다시 해 주세요." />
        <Link to="/forgot-password" className="btn btn-primary" style={BIG}>비밀번호 찾기</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout>
      <Heading title="새 비밀번호" sub="앞으로 로그인할 때 쓸 비밀번호를 정해 주세요." />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="field"><label htmlFor="rp-password">새 비밀번호</label><input id="rp-password" className="input" type="password" autoComplete="new-password" placeholder="8자 이상" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <FormError text={error} />
        <button className="btn btn-primary" type="submit" disabled={busy} style={BIG}>{busy ? '저장 중…' : '저장하고 시작하기'}</button>
      </form>
    </AuthLayout>
  );
}
