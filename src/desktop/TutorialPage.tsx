// 체험 모드 · 데스크톱 (2026-10-03 기획 결정): 예시 목표 하나로 목표 → 세부목표 → 연간 → 월간 → 주간 표 → 마무리까지.
// 진짜 계획 표와 같은 방식(빈 칸 클릭 → 세부목표 고르기, ↓로 늘리기)으로 해 보되, 화면 안에서만 움직이고 계정에는 저장하지 않는다.
// 기록은 휴대폰에서만 하므로 안내만. '한 기간에는 목표마다 칸 하나(세부목표는 여러 개 가능)'(R-P1, 2026-10-05)와 '위 계획에서 고르기'(R-P14)를 강조한다
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../account/AccountProvider';
import { dayLabel } from '../lib/day';
import { addMonths, fmtDays, md, monthOfWeek, monthWeeks, weekDays, weekStartOf } from '../lib/plan';
import { markTutorialDone } from '../lib/tutorial';
import { MergeColumn, type MBlock } from './plan/MergeColumn';
import { Chip, ColumnHeader, OutTag, PopHead, Popover, RefRow, RowLabel, SubgoalPicker, TableFrame, useSelection, type Tone } from './plan/shared';

const TONE: Tone = { bg: 'var(--cat-green-bg)', ink: 'var(--cat-green-ink)', dot: 'var(--cat-green-dot)' };
const STEPS = ['시작', '목표', '세부목표', '연간', '월간', '주간', '기록', '마무리', '끝'];
const SUGGEST = ['1권: 아주 작은 습관의 힘', '2권: 몰입'];

type Block = { id: string; sub: number; start: number; end: number; text: string };
type Act = { id: string; sub: number; name: string; days: number[] };
type Pop = { kind: 'year' | 'month'; row: number; anchor: DOMRect } | { kind: 'week'; row: number; anchor: DOMRect; sub: number | null; name: string; days: number[] };

let seq = 0;
const newId = () => 'demo-' + ++seq;

export default function TutorialPage() {
  const today = useToday();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('책 2권 읽기');
  const [subs, setSubs] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [year, setYear] = useState<Block[]>([]);
  const [month, setMonth] = useState<Block[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [progress, setProgress] = useState(0);
  const [retro, setRetro] = useState('');
  const [sel, setSel] = useSelection();
  const [pop, setPop] = useState<Pop | null>(null);

  // 예시 기간: 이번 주가 든 달부터 4달, 그 달의 주들, 이번 주
  const thisWeek = weekStartOf(today);
  const { ym: ym0, index: weekIdx } = monthOfWeek(thisWeek);
  const months = Array.from({ length: 4 }, (_, i) => addMonths(ym0, i));
  const mNum = (ym: string) => Number(ym.slice(5));
  const weeks = monthWeeks(ym0);
  const days = weekDays(thisWeek);
  const labels = days.map(d => dayLabel(d).dow);
  const subList = subs.map((name, i) => ({ id: String(i), name }));

  // 위 계획 (R-P14): 월간 ← 연간의 첫 달, 주간 ← 월간의 이번 주
  const yearUp = year.find(b => b.start <= 0 && 0 <= b.end);
  const monthUp = month.find(b => b.start <= weekIdx && weekIdx <= b.end);
  const toM = (b: Block, up?: Block): MBlock => ({ id: b.id, start: b.start, end: b.end, subs: [{ id: String(b.sub), name: subs[b.sub], out: !!up && up.sub !== b.sub }], text: b.text });
  const edit = (list: Block[], set: (l: Block[]) => void) => ({
    onRange: (b: MBlock, start: number, end: number) => set(list.map(x => (x.id === b.id ? { ...x, start, end } : x))),
    onText: (b: MBlock, text: string) => set(list.map(x => (x.id === b.id ? { ...x, text } : x))),
    onDelete: (b: MBlock) => set(list.filter(x => x.id !== b.id)),
  });
  const close = () => setPop(null);
  const placed = (n: number) => year.some(b => b.sub === n);

  const steps: { title: string; ok: boolean; body: ReactNode }[] = [
    {
      title: '체험해 보기',
      ok: true,
      body: (
        <Card>
          <p style={P}>예시 목표 하나로 <b>목표 → 세부목표 → 연간·월간·주간 계획 표 → 마무리</b>까지 3분 동안 따라 해 봐요. 진짜 계획 표와 같은 방식이에요.</p>
          <p style={{ ...P, color: 'var(--color-neutral-700)' }}>여기서 한 것은 내 계정에 저장되지 않아요. 끝나면 진짜 내 목표를 적어요.</p>
        </Card>
      ),
    },
    {
      title: '목표 적기',
      ok: !!goal.trim(),
      body: (
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr)', gap: 18, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: TONE.bg, borderRadius: 999, padding: '0 16px 0 8px', height: 44 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: TONE.dot, color: 'var(--color-neutral-100)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>1</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>성장</span>
            </div>
            <input className="input" aria-label="체험 목표" maxLength={40} value={goal} onChange={e => setGoal(e.target.value)} style={{ fontSize: 16, fontWeight: 600 }} />
          </div>
          <Hint>목표는 카테고리마다 '되고 싶은 모습'을 이루기 위한 구체적인 결과예요. 실제로는 기한(연·월)도 함께 정해요.</Hint>
        </Card>
      ),
    },
    {
      title: '세부목표로 나누기',
      ok: subs.length >= 2,
      body: (
        <Card>
          <Hint>세부목표는 <b>계획 표 칸에 들어가는 단위</b>예요. 두 개를 만들어 보세요.</Hint>
          <div style={{ alignSelf: 'flex-start', minWidth: 280, background: TONE.bg, borderRadius: 26, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ margin: 0, fontSize: 19 }}>{goal}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {subs.map(s => <span key={s} data-testid="tutorial-sub" style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--color-neutral-100)', color: TONE.ink, fontSize: 12.5, fontWeight: 700 }}>{s}</span>)}
              {!subs.length && <span style={{ fontSize: 13, fontWeight: 600, color: TONE.ink, opacity: 0.6 }}>세부목표를 추가해 주세요</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUGGEST.filter(s => !subs.includes(s)).map(s => (
              <button key={s} className="btn btn-secondary" onClick={() => setSubs([...subs, s])} style={{ ...PILL, height: 34 }}>+ {s}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, maxWidth: 420 }}>
            <input aria-label="체험 세부목표" className="input" value={draft} maxLength={40} onChange={e => setDraft(e.target.value)} placeholder="+ 직접 적기" />
            <button className="btn btn-primary" disabled={!draft.trim() || subs.includes(draft.trim())} onClick={() => { setSubs([...subs, draft.trim()]); setDraft(''); }}>추가</button>
          </div>
        </Card>
      ),
    },
    {
      title: '연간 계획: 크게 배치하기',
      ok: placed(0) && placed(1),
      body: (
        <>
          <Hint>빈 칸을 눌러 세부목표를 넣어요. 칸을 누른 뒤 <b>↓</b>로 여러 달에 걸치게 늘릴 수 있어요. 두 세부목표를 모두 넣어 보세요.</Hint>
          <TableFrame columns="96px minmax(200px, 1fr)" minWidth={300} rowHeight={56}>
            <Corner>기간</Corner>
            <ColumnHeader col={2} name={goal} sub="성장" dot={TONE.dot} />
            {months.map((ym, i) => <RowLabel key={ym} row={i + 2} label={`${mNum(ym)}월`} sub={ym.slice(0, 4)} />)}
            <MergeColumn col={2} firstRow={2} rowCount={months.length} label={goal} blocks={year.map(b => toM(b))} tone={TONE} placeholder="메모" sel={sel} setSel={setSel} focusId={null} popRow={pop?.kind === 'year' ? pop.row : null} onEmpty={(row, anchor) => { setSel(null); setPop({ kind: 'year', row, anchor }); }} {...edit(year, setYear)} />
          </TableFrame>
          <Rule warn={year.length > 0 && subs.slice(0, 2).some((_, i) => !placed(i)) && months.every((_, r) => year.some(b => b.start <= r && r <= b.end))} />
        </>
      ),
    },
    {
      title: '월간 계획: 주로 나누기',
      ok: month.length > 0,
      body: (
        <>
          <Hint>맨 위 '상위 계획' 줄에 연간 계획의 {mNum(ym0)}월 칸이 내려와요. 빈 칸을 누르면 <b>그 세부목표가 먼저</b> 나와요. 다른 세부목표는 '계획 밖에서 고르기'를 한 번 더 눌러야 하고, 표에 '계획 밖'으로 표시돼요.</Hint>
          <TableFrame columns="96px minmax(200px, 1fr)" minWidth={300} rowHeight={56}>
            <Corner>기간</Corner>
            <ColumnHeader col={2} name={goal} sub="성장" dot={TONE.dot} />
            <RefRow label={`연간 · ${mNum(ym0)}월`} cells={[yearUp ? { col: 2, chips: [subs[yearUp.sub]], text: yearUp.text, tone: TONE } : { col: 2, empty: true }]} emptyText="연간 표의 이번 달 칸이 여기로 내려와요" lastCol={2} />
            {weeks.map((w, i) => <RowLabel key={w} row={i + 3} label={`${i + 1}주차`} sub={md(w)} today={i === weekIdx} />)}
            <MergeColumn col={2} firstRow={3} rowCount={weeks.length} label={goal} blocks={month.map(b => toM(b, yearUp))} tone={TONE} placeholder="코멘트" sel={sel} setSel={setSel} focusId={null} popRow={pop?.kind === 'month' ? pop.row : null} onEmpty={(row, anchor) => { setSel(null); setPop({ kind: 'month', row, anchor }); }} {...edit(month, setMonth)} />
          </TableFrame>
        </>
      ),
    },
    {
      title: '주간 계획: 실천 적기',
      ok: acts.length > 0,
      body: (
        <>
          <Hint>이번 주 칸을 눌러 <b>실제로 할 행동</b>을 적어요. 요일을 하나 고르면 그 요일 칸에, 여러 개 고르면 '이번 주' 줄에 모여요. 여기 적은 실천이 휴대폰의 매일 할 일이 돼요.</Hint>
          <TableFrame columns="96px minmax(220px, 1fr)" minWidth={320} rowHeight={52}>
            <Corner>요일</Corner>
            <ColumnHeader col={2} name={goal} sub="성장" dot={TONE.dot} />
            <RefRow label={`월간 · ${weekIdx + 1}주차`} cells={[monthUp ? { col: 2, chips: [subs[monthUp.sub]], text: monthUp.text, tone: TONE } : { col: 2, empty: true }]} emptyText="월간 표의 이번 주 칸이 여기로 내려와요" lastCol={2} />
            <RowLabel row={3} label="이번 주" sub="여러 날에 걸친 실천" tone="week" />
            {days.map((d, i) => <RowLabel key={d} row={i + 4} label={labels[i]} sub={md(d)} />)}
            {[-1, 0, 1, 2, 3, 4, 5, 6].map(row => {
              const items = acts.filter(a => (row === -1 ? a.days.length > 1 : a.days.length === 1 && a.days[0] === row));
              const label = `${goal} ${row === -1 ? '이번 주' : labels[row] + '요일'}`;
              const open = (anchor: DOMRect) => setPop({ kind: 'week', row, anchor, sub: monthUp ? monthUp.sub : null, name: '', days: row === -1 ? [] : [row] });
              return (
                <div key={row} role="button" tabIndex={0} aria-label={label + '에 실천 추가'} data-testid="week-cell" className="plan-stack" onClick={e => open(e.currentTarget.getBoundingClientRect())} onKeyDown={e => e.key === 'Enter' && open(e.currentTarget.getBoundingClientRect())} style={{ gridRow: row + 4, gridColumn: 2, minWidth: 0, background: items.length ? TONE.bg : 'var(--color-neutral-100)', border: '2px dashed ' + (pop?.kind === 'week' && pop.row === row ? 'var(--color-accent)' : 'transparent'), borderRadius: 16, padding: 5, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', boxSizing: 'border-box' }}>
                  {items.map(a => (
                    <div key={a.id} data-testid="practice" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, background: 'var(--color-neutral-100)', borderRadius: 10, padding: '4px 6px', fontSize: 12, fontWeight: 600 }}>
                      <Chip tone={TONE}>{subs[a.sub]}</Chip>
                      {monthUp && monthUp.sub !== a.sub && <OutTag />}
                      <span style={{ flex: '1 1 64px' }}>{a.name}</span>
                      {row === -1 && <span data-testid="practice-days" style={{ fontSize: 11, fontWeight: 700, color: TONE.ink }}>{fmtDays(a.days, labels)}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </TableFrame>
        </>
      ),
    },
    {
      title: '기록은 휴대폰에서',
      ok: true,
      body: (
        <Card>
          <p style={P}>주간에 적은 실천은 휴대폰 <b>기록 › 오늘</b>의 할 일이 돼요. 하면 체크하고, 실제로 쓴 시간을 10분 칸에 칠해요.</p>
          <div aria-hidden="true" style={{ alignSelf: 'flex-start', width: 260, background: 'var(--color-bg)', borderRadius: 26, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'var(--shadow-md)' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>오늘</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 14, background: 'var(--color-surface)' }}>
              <Chip tone={TONE}>{subs[acts[0]?.sub ?? 0] ?? '세부목표'}</Chip>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textDecoration: 'line-through' }}>{acts[0]?.name ?? '20쪽 읽기'}</span>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: TONE.dot }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '22px repeat(6, 1fr)', rowGap: 2 }}>
              {[21, 22].map((h, r) => (
                <div key={h} style={{ display: 'contents' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-600)', display: 'grid', placeItems: 'center', height: 24 }}>{h}</span>
                  {Array.from({ length: 6 }, (_, c) => <span key={c} style={{ height: 24, borderRight: '1px solid var(--color-neutral-200)', borderBottom: '1px solid var(--color-neutral-400)', background: r === 0 && c < 4 ? `color-mix(in oklch, ${TONE.dot} 55%, transparent)` : 'transparent' }} />)}
                </div>
              ))}
            </div>
          </div>
          <Hint>휴대폰으로 같은 주소를 열고 같은 계정으로 들어가면 돼요. 기록은 지난 날이 되면 고칠 수 없어요.</Hint>
        </Card>
      ),
    },
    {
      title: '목표 마무리하기',
      ok: progress === 100 && !!retro.trim(),
      body: (
        <Card>
          <Hint>다 이뤘다면 진척도를 채우고 짧게 회고를 남겨 마무리해요. 회고는 '회고 모음'에 모여요.</Hint>
          <div className="field" style={{ maxWidth: 420 }}>
            <label>진척도 {progress}%</label>
            <input type="range" min={0} max={100} step={25} value={progress} aria-label="체험 진척도" className="progress-range" onChange={e => setProgress(Number(e.target.value))} style={{ ['--fill' as string]: TONE.dot, ['--pct' as string]: progress + '%' } as CSSProperties} />
          </div>
          <div className="field" style={{ maxWidth: 420 }}>
            <label htmlFor="tut-retro">무엇을 해냈나요</label>
            <input id="tut-retro" className="input" aria-label="체험 회고" maxLength={100} value={retro} onChange={e => setRetro(e.target.value)} placeholder="예: 두 권을 끝까지 읽었다" />
          </div>
        </Card>
      ),
    },
    {
      title: '다 해 봤어요!',
      ok: true,
      body: (
        <Card>
          <p style={P}>꿈 → 목표 → <b>연간 → 월간 → 주간</b>으로 내려오고, 휴대폰으로 매일 기록해서 다시 목표로 올라가요.</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
            <li>한 기간에는 목표마다 <b>칸 하나</b> — 세부목표는 한 칸에 여러 개</li>
            <li>아래 계획은 <b>위 계획에서 골라</b> 세워요</li>
            <li>지난 기간은 고칠 수 없어요</li>
          </ul>
        </Card>
      ),
    },
  ];
  const cur = steps[step];
  const last = step === steps.length - 1;
  const finish = () => { markTutorialDone(); navigate('/goals', { replace: true, state: { newGoal: true } }); };
  const quit = () => { if (window.history.length > 1) navigate(-1); else navigate('/board', { replace: true }); };

  return (
    <div data-testid="tutorial-page" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="tag tag-accent-2" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>체험 · 저장 안 돼요</span>
          <h1 data-testid="tutorial-title" style={{ margin: 0, fontSize: 42 }}>{cur.title}</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => { if (step === 0) markTutorialDone(); quit(); }} style={PILL}>{step === 0 ? '건너뛰기' : '그만하기'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
        <ol aria-label="체험 단계" style={{ listStyle: 'none', margin: 0, padding: '14px 10px', background: 'var(--color-surface)', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 14 }}>
          {STEPS.map((l, i) => (
            <li key={l} aria-current={i === step ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 12, fontSize: 13, fontWeight: i === step ? 700 : 600, background: i === step ? 'var(--color-neutral-100)' : 'transparent', color: i <= step ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>
              <span style={{ flex: 'none', width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid ' + (i < step ? 'var(--color-accent-2)' : i === step ? 'var(--color-accent)' : 'var(--color-neutral-400)'), background: i < step ? 'var(--color-accent-2)' : 'transparent' }} />
              {l}
            </li>
          ))}
        </ol>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {cur.body}
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button className="btn btn-secondary" onClick={() => { setPop(null); setSel(null); setStep(step - 1); }} style={PILL}>이전</button>}
            {last ? (
              <button className="btn btn-primary" onClick={finish}>내 목표 적으러 가기</button>
            ) : (
              <button className="btn btn-primary" disabled={!cur.ok} onClick={() => { setPop(null); setSel(null); setStep(step + 1); }}>{step === 0 ? '시작하기' : '다음'}</button>
            )}
          </div>
        </div>
      </div>

      {pop && pop.kind !== 'week' && (
        <Popover anchor={pop.anchor} width={260} height={300} onClose={close}>
          <PopHead dot={TONE.dot} title={`${goal} · ${pop.kind === 'year' ? mNum(months[pop.row]) + '월' : pop.row + 1 + '주차'}`} hint={pop.kind === 'year' ? '세부목표를 골라 넣어요' : '세부목표를 골라 넣고 코멘트를 적어요'} />
          <SubgoalPicker
            subs={subList}
            highlight={pop.kind === 'month' && yearUp ? [String(yearUp.sub)] : null}
            badge="이번 달 계획"
            upperOn={pop.kind === 'month' && !!yearUp}
            upperName={`연간 계획의 ${mNum(ym0)}월`}
            tone={TONE}
            onPick={id => {
              const b = { id: newId(), sub: Number(id), start: pop.row, end: pop.row, text: '' };
              if (pop.kind === 'year') setYear([...year, b]); else setMonth([...month, b]);
              close();
              setSel(b.id);
            }}
          />
        </Popover>
      )}
      {pop && pop.kind === 'week' && (
        <Popover anchor={pop.anchor} width={300} height={520} onClose={close}>
          <PopHead dot={TONE.dot} title={`${goal} · ${pop.row === -1 ? '이번 주' : labels[pop.row] + ' ' + md(days[pop.row])}`} hint="세부목표를 고르고 실천을 적어요" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)', padding: '2px 12px 4px' }}>1. 세부목표</span>
          <SubgoalPicker subs={subList} highlight={monthUp ? [String(monthUp.sub)] : null} badge="이번 주 계획" upperOn={!!monthUp} upperName={`월간 계획의 ${weekIdx + 1}주차`} selected={pop.sub === null ? null : String(pop.sub)} tone={TONE} onPick={id => setPop({ ...pop, sub: Number(id) })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 6px 4px' }}>
            <div className="field">
              <label htmlFor="tut-act">2. 실천 이름</label>
              <input id="tut-act" className="input" aria-label="체험 실천 이름" maxLength={40} value={pop.name} onChange={e => setPop({ ...pop, name: e.target.value })} placeholder="예: 20쪽 읽기" />
            </div>
            <div className="field">
              <label>3. 요일</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {labels.map((k, i) => {
                  const on = pop.days.includes(i);
                  return <button key={i} type="button" aria-pressed={on} aria-label={k + '요일'} onClick={() => setPop({ ...pop, days: on ? pop.days.filter(x => x !== i) : [...pop.days, i].sort((a, b) => a - b) })} style={{ flex: 1, height: 34, padding: 0, borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, background: on ? TONE.ink : 'var(--color-neutral-200)', color: on ? 'var(--color-neutral-100)' : 'var(--color-text)' }}>{k}</button>;
                })}
              </div>
            </div>
            <button className="btn btn-primary" disabled={pop.sub === null || !pop.name.trim() || !pop.days.length} onClick={() => { setActs([...acts, { id: newId(), sub: pop.sub!, name: pop.name.trim(), days: pop.days }]); close(); }}>실천 추가</button>
          </div>
        </Popover>
      )}
    </div>
  );
}

// 연간 단계의 규칙 안내 (R-P1). 칸이 모두 찼는데 못 넣은 세부목표가 있으면 경고로
function Rule({ warn }: { warn: boolean }) {
  return (
    <div data-testid="tutorial-rule" style={{ padding: '14px 18px', borderRadius: 22, background: warn ? 'var(--color-accent-200)' : 'var(--color-accent-2-100)', color: warn ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)', fontSize: 14, lineHeight: 1.6, textWrap: 'pretty' }}>
      <b>한 기간에는 목표마다 칸 하나예요.</b>
      {warn
        ? ' 빈 달이 없어서 새 칸을 넣을 수 없어요. 칸을 눌러 ↑로 줄이거나 ×로 지워 자리를 만들어 보세요. 같은 시기에 함께 하려면, 실제 계획에서 칸을 고른 뒤 \'+ 세부목표\'로 더하면 돼요.'
        : ' 그래서 칸이 찬 달에는 새 칸을 넣을 수 없어요. 같은 시기에 여러 세부목표를 함께 하고 싶다면, 실제 계획 표에서 칸을 고른 뒤 \'+ 세부목표\'로 한 칸에 여러 개 넣을 수 있어요 (예: 기도 · 성경 · 묵상).'}
    </div>
  );
}

function Corner({ children }: { children: ReactNode }) {
  return <div style={{ gridRow: 1, gridColumn: 1, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{children}</div>;
}
function Card({ children }: { children: ReactNode }) {
  return <div style={{ background: 'var(--color-surface)', borderRadius: 32, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>;
}
function Hint({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 14, color: 'var(--color-neutral-800)', lineHeight: 1.6, textWrap: 'pretty' }}>{children}</span>;
}
const P = { margin: 0, fontSize: 15, lineHeight: 1.65, textWrap: 'pretty' } as const;
const PILL = { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 } as const;
