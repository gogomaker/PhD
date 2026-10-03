// 체험 모드 (2026-10-03 기획 결정): 예시 목표 하나로 목표 → 세부 목표 → 연간 → 월간 → 주간 → 오늘 기록 → 마무리까지.
// 화면 안에서만 움직이고 내 계정에는 아무것도 저장하지 않는다. '한 기간에는 목표마다 세부 목표 하나'(R-P1)를 강조한다
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../../account/AccountProvider';
import { addMonths, fmtDays, monthOfWeek, monthWeeks, weekStartOf } from '../../lib/plan';
import { ScrollArea } from '../../ui/ScrollArea';
import { markTutorialDone } from '../../lib/tutorial';
import { BODY, Dot, Field, H, ICON, Svg, chip } from '../ui';

const markDone = markTutorialDone;

const TONE = { bg: 'var(--cat-green-bg)', ink: 'var(--cat-green-ink)', dot: 'var(--cat-green-dot)' };
const STEPS = ['목표', '세부 목표', '연간', '월간', '주간', '오늘', '마무리'];
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
type Range = { sub: number; s: number; e: number };

export default function TutorialPage() {
  const today = useToday();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('책 2권 읽기');
  const [subs, setSubs] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [year, setYear] = useState<Range[]>([]);
  const [month, setMonth] = useState<(Range & { text: string }) | null>(null);
  const [act, setAct] = useState<{ name: string; days: number[] } | null>(null);
  const [checked, setChecked] = useState(false);
  const [painted, setPainted] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [retro, setRetro] = useState('');

  // 예시 기간: 이번 달부터 4달, 이번 주가 든 달의 주들
  const ym0 = monthOfWeek(weekStartOf(today)).ym;
  const months = Array.from({ length: 4 }, (_, i) => addMonths(ym0, i));
  const mLabel = (ym: string) => `${Number(ym.slice(5))}월`;
  const weeks = monthWeeks(ym0).slice(0, 4);

  const steps: { title: string; body: ReactNode; ok: boolean }[] = [
    {
      title: '체험해 보기',
      ok: true,
      body: (
        <Card>
          <p style={P}>예시 목표 하나로 <b>목표 → 세부 목표 → 연간·월간·주간 계획 → 오늘 기록 → 마무리</b>까지 3분 동안 따라 해 봐요.</p>
          <p style={{ ...P, color: 'var(--color-neutral-700)' }}>여기서 한 것은 내 계정에 저장되지 않아요. 끝나면 진짜 내 목표를 써요.</p>
        </Card>
      ),
    },
    {
      title: '목표 만들기',
      ok: !!goal.trim(),
      body: (
        <Card>
          <Field label="카테고리"><span style={{ ...chipStyle(true), alignSelf: 'flex-start' }}><Dot color={TONE.dot} />성장</span></Field>
          <Field label="목표"><input className="input" aria-label="체험 목표" maxLength={40} value={goal} onChange={e => setGoal(e.target.value)} /></Field>
          <Hint>목표는 '되고 싶은 모습'을 이루기 위한 구체적인 결과예요. 기한도 함께 정해요.</Hint>
        </Card>
      ),
    },
    {
      title: '세부 목표로 나누기',
      ok: subs.length >= 2,
      body: (
        <Card>
          <Hint>세부 목표는 <b>계획에 들어가는 단위</b>예요. 두 개를 만들어 보세요.</Hint>
          {subs.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-neutral-100)', borderRadius: 16, padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>
              <span style={{ color: TONE.ink, fontWeight: 800 }}>{i + 1}</span>{s}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['1권: 아주 작은 습관의 힘', '2권: 몰입'].filter(s => !subs.includes(s)).map(s => (
              <button key={s} className="btn btn-secondary" onClick={() => setSubs([...subs, s])} style={{ height: 34, padding: '0 12px', ...BODY, fontSize: 12.5 }}>+ {s}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input aria-label="체험 세부 목표" value={draft} maxLength={40} onChange={e => setDraft(e.target.value)} placeholder="+ 직접 적기" style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 16, border: '2px dashed ' + TONE.dot, background: 'transparent', padding: '0 12px', ...BODY, fontWeight: 500, fontSize: 13.5, color: 'var(--color-text)', outline: 'none' }} />
            <button className="btn btn-primary" disabled={!draft.trim() || subs.includes(draft.trim())} onClick={() => { setSubs([...subs, draft.trim()]); setDraft(''); }} style={{ height: 40, padding: '0 14px', fontSize: 13 }}>추가</button>
          </div>
        </Card>
      ),
    },
    {
      title: '연간 계획: 크게 배치하기',
      ok: subs.slice(0, 2).every((_, i) => year.some(y => y.sub === i)),
      body: <YearStep subs={subs} months={months} mLabel={mLabel} year={year} setYear={setYear} />,
    },
    {
      title: '월간 계획: 주로 나누기',
      ok: !!month,
      body: (
        <Card>
          <Hint>연간 계획에서 {mLabel(ym0)}에 넣은 세부 목표를 <b>위에서 골라</b> 주 단위로 나눠요.</Hint>
          <Field label={`${mLabel(ym0)} 연간 계획에서 고르기`}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {year.filter(y => y.s === 0).map(y => <span key={y.sub} style={chipStyle(true)}><Dot color={TONE.dot} />{goal} · {subs[y.sub]}</span>)}
            </div>
          </Field>
          <Rows labels={weeks.map((_, i) => `${i + 1}주`)} cells={month ? [{ ...month, name: month.text || subs[month.sub] }] : []} />
          {!month ? (
            <button className="btn btn-primary" onClick={() => setMonth({ sub: year.find(y => y.s === 0)?.sub ?? 0, s: 0, e: 1, text: '1~5장' })} style={{ height: 42 }}>1~2주에 '1~5장' 넣기</button>
          ) : <Hint>여러 주에 걸친 계획은 걸친 주마다 보여요.</Hint>}
        </Card>
      ),
    },
    {
      title: '주간 계획: 실천 적기',
      ok: !!act,
      body: (
        <Card>
          <Hint>이번 주 월간 계획에서 고르고, <b>실제로 할 행동</b>을 요일과 함께 적어요. 여기 적은 실천이 매일의 할 일이 돼요.</Hint>
          <Field label="이번 주 월간 계획에서 고르기">
            <span style={{ ...chipStyle(true), alignSelf: 'flex-start' }}><Dot color={TONE.dot} />{goal} · {subs[month?.sub ?? 0]}</span>
          </Field>
          {act ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 16, background: TONE.bg }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: TONE.ink }}>{goal} · {subs[month?.sub ?? 0]}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{act.name}</span>
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: TONE.ink }}>{fmtDays(act.days, DOWS)}</span>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setAct({ name: '20쪽 읽기', days: [1, 3, 5] })} style={{ height: 42 }}>월·수·금 '20쪽 읽기' 추가</button>
          )}
          <Hint>요일을 하나 고르면 그날 한 번(못 하면 다음 날로 넘어감), 여러 개 고르면 고른 요일마다 반복해요. 같은 시기에 여러 일을 하고 싶을 땐 실천을 여러 개 적으면 돼요.</Hint>
        </Card>
      ),
    },
    {
      title: '오늘 기록하기',
      ok: checked && painted.length > 0,
      body: (
        <Card>
          <Hint>오늘 할 일을 다 하면 체크하고, 실제로 쓴 시간을 10분 칸에 칠해요.</Hint>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 16, background: 'var(--color-neutral-100)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: TONE.bg, color: TONE.ink }}>{subs[month?.sub ?? 0]}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textDecoration: checked ? 'line-through' : 'none' }}>{act?.name}</span>
            <button aria-label="체험 할 일 완료" aria-pressed={checked} onClick={() => setChecked(!checked)} style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid ' + TONE.dot, background: checked ? TONE.dot : 'transparent', color: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer' }}>
              {checked && <Svg d={ICON.check} size={12} width={3.5} />}
            </button>
          </div>
          <div role="group" aria-label="체험 시간표" style={{ display: 'grid', gridTemplateColumns: '26px repeat(6, minmax(0,1fr))', rowGap: 2, borderTop: '1px solid var(--color-neutral-400)' }}>
            {[21, 22].map((h, r) => (
              <div key={h} style={{ display: 'contents' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-600)', display: 'grid', placeItems: 'center', height: 34 }}>{h}</span>
                {Array.from({ length: 6 }, (_, c) => {
                  const i = r * 6 + c;
                  const on = painted.includes(i);
                  return <button key={c} aria-label={`${h}시 ${c * 10}분`} aria-pressed={on} onClick={() => setPainted(on ? painted.filter(x => x !== i) : [...painted, i])} style={{ height: 34, border: 0, borderRight: '1px solid var(--color-neutral-200)', borderBottom: '1px solid var(--color-neutral-400)', padding: 0, cursor: 'pointer', background: on ? `color-mix(in oklch, ${TONE.dot} 55%, transparent)` : 'transparent' }} />;
                })}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent-700)' }}>실제 {painted.length * 10}분</span>
        </Card>
      ),
    },
    {
      title: '목표 마무리하기',
      ok: progress === 100 && !!retro.trim(),
      body: (
        <Card>
          <Hint>다 이뤘다면 진척도를 채우고 짧게 회고를 남겨 마무리해요. 회고는 목표 탭 아래에 모여요.</Hint>
          <Field label={`진척도 ${progress}%`}>
            <input type="range" min={0} max={100} step={25} value={progress} aria-label="체험 진척도" className="progress-range" onChange={e => setProgress(Number(e.target.value))} style={{ ['--fill' as string]: TONE.dot, ['--pct' as string]: progress + '%' } as CSSProperties} />
          </Field>
          <Field label="무엇을 해냈나요"><input className="input" aria-label="체험 회고" maxLength={100} value={retro} onChange={e => setRetro(e.target.value)} placeholder="예: 두 권을 끝까지 읽었다" /></Field>
        </Card>
      ),
    },
    {
      title: '다 해 봤어요!',
      ok: true,
      body: (
        <Card>
          <p style={P}>꿈 → 목표 → <b>연간 → 월간 → 주간</b>으로 내려오고, 매일 기록해서 다시 목표로 올라가요.</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
            <li>한 기간에는 목표마다 <b>세부 목표 하나</b></li>
            <li>아래 계획은 <b>위 계획에서 골라</b> 세워요</li>
            <li>지난 기간은 고칠 수 없어요</li>
          </ul>
        </Card>
      ),
    },
  ];
  const cur = steps[step];
  const last = step === steps.length - 1;

  return (
    <ScrollArea data-testid="tutorial-page" fade="var(--color-bg)" style={{ flex: 1, minHeight: 0 }} innerStyle={{ padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {step > 0 && !last && (
        <div aria-label="체험 단계" style={{ flex: 'none', display: 'flex', gap: 4 }}>
          {STEPS.map((l, i) => (
            <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ height: 5, borderRadius: 99, background: i < step ? 'var(--color-accent-2)' : 'var(--color-neutral-300)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: i < step ? 'var(--color-accent-2-700)' : 'var(--color-neutral-600)', textAlign: 'center', whiteSpace: 'nowrap' }}>{l}</span>
            </div>
          ))}
        </div>
      )}
      <span data-testid="tutorial-title" style={{ flex: 'none', ...H, fontSize: 24 }}>{cur.title}</span>
      {cur.body}
      <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
        {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)} style={{ flex: 'none', height: 48, padding: '0 20px', ...BODY }}>이전</button>}
        {last ? (
          <button className="btn btn-primary" onClick={() => { markDone(); navigate('/plan', { replace: true, state: { newGoal: true } }); }} style={{ flex: 1, height: 48 }}>내 목표 쓰러 가기</button>
        ) : (
          <button className="btn btn-primary" disabled={!cur.ok} onClick={() => setStep(step + 1)} style={{ flex: 1, height: 48 }}>{step === 0 ? '시작하기' : '다음'}</button>
        )}
      </div>
      {step === 0 && <button className="btn btn-ghost" onClick={() => { markDone(); navigate(-1); }} style={{ alignSelf: 'center', height: 36, ...BODY, fontSize: 13 }}>건너뛰기</button>}
    </ScrollArea>
  );
}

// 연간: 세부 목표 두 개를 배치. 같은 달에 겹치게 넣으려 하면 왜 안 되는지 크게 보여 준다 (R-P1)
function YearStep({ subs, months, mLabel, year, setYear }: { subs: string[]; months: string[]; mLabel: (ym: string) => string; year: Range[]; setYear: (y: Range[]) => void }) {
  const [sub, setSub] = useState(0);
  const [s, setS] = useState(0);
  const [e, setE] = useState(1);
  const [warn, setWarn] = useState(false);
  const place = () => {
    const clash = year.some(y => y.sub !== sub && !(e < y.s || s > y.e));
    if (clash) return setWarn(true);
    setWarn(false);
    setYear([...year.filter(y => y.sub !== sub), { sub, s, e }]);
    if (sub === 0) setSub(1);
  };
  return (
    <Card>
      <Hint>목표마다 어느 달에 어떤 세부 목표를 할지 크게 정해요. 연간은 건너뛰어도 되지만, 세워 두면 월간에서 골라 쓰기 쉬워요.</Hint>
      <Rows labels={months.map(mLabel)} cells={year.map(y => ({ ...y, name: subs[y.sub] }))} />
      <Field label="세부 목표">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {subs.slice(0, 2).map((n, i) => <button key={n} aria-pressed={sub === i} onClick={() => setSub(i)} style={{ ...chipStyle(sub === i), border: 0, cursor: 'pointer' }}>{n}</button>)}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="시작 달"><select className="input" aria-label="체험 시작 달" value={s} onChange={ev => { const v = Number(ev.target.value); setS(v); if (e < v) setE(v); }} style={{ height: 42 }}>{months.map((m, i) => <option key={m} value={i}>{mLabel(m)}</option>)}</select></Field>
        <Field label="끝 달"><select className="input" aria-label="체험 끝 달" value={e} onChange={ev => setE(Number(ev.target.value))} style={{ height: 42 }}>{months.map((m, i) => i >= s && <option key={m} value={i}>{mLabel(m)}</option>)}</select></Field>
      </div>
      <button className="btn btn-primary" onClick={place} style={{ height: 42 }}>연간에 넣기</button>
      {(warn || year.length > 0) && (
        <div data-testid="tutorial-rule" style={{ padding: '14px 16px', borderRadius: 20, background: warn ? 'var(--color-accent-200)' : 'var(--color-accent-2-100)', color: warn ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)', fontSize: 13.5, lineHeight: 1.55, textWrap: 'pretty' }}>
          <b>한 기간에는 목표마다 세부 목표 하나만 넣어요.</b>
          {warn ? ' 그 달에는 이미 다른 세부 목표가 있어요. 시작 달을 뒤로 옮겨 보세요.' : ' 한 번에 하나에 집중하게 하려는 규칙이에요. 같은 시기에 둘 다 하고 싶다면, 주간 계획에서 실천을 여러 개 적으면 돼요.'}
        </div>
      )}
    </Card>
  );
}

function Rows({ labels, cells }: { labels: string[]; cells: (Range & { name: string })[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {labels.map((l, i) => {
        const here = cells.filter(c => c.s <= i && i <= c.e);
        return (
          <div key={l} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr)', gap: 8, alignItems: 'center', minHeight: 34 }}>
            <span style={{ ...H, fontSize: 15 }}>{l}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {here.map(c => (
                <span key={c.sub} style={{ padding: '6px 10px', borderRadius: 12, background: TONE.bg, color: 'var(--color-text)', fontSize: 13, fontWeight: 700, opacity: c.s === i ? 1 : 0.6 }}>
                  {c.name}{c.s !== i ? ' · 이어짐' : c.e > c.s ? ` (${labels[c.s]}–${labels[c.e]})` : ''}
                </span>
              ))}
              {!here.length && <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const P = { margin: 0, fontSize: 14.5, lineHeight: 1.6, textWrap: 'pretty' } as const;
const chipStyle = (on: boolean) => ({ height: 34, padding: '0 12px', borderRadius: 999, ...BODY, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, ...chip(on, TONE) });
function Card({ children }: { children: ReactNode }) {
  return <div style={{ flex: 'none', background: 'var(--color-surface)', borderRadius: 26, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>;
}
function Hint({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 13, color: 'var(--color-neutral-800)', lineHeight: 1.55, textWrap: 'pretty' }}>{children}</span>;
}
