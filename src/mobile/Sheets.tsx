import { useState } from 'react';
import { Sheet } from './ui';
import { dayLabel, toDayKey, type DayKey } from '../lib/day';
import type { Tone } from '../desktop/plan/shared';
import type { Journal } from './useDay';

const pill = (on: boolean, tone: Tone) => ({ background: on ? tone.bg : 'var(--color-surface)', color: on ? tone.ink : 'var(--color-text)', boxShadow: on ? 'inset 0 0 0 2px ' + tone.dot : 'none' });
const H = { fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 } as const;

// 아래에서 올라오는 시트: 뒤로 가기로 닫히는 모바일 공통 시트 (./ui)
export { Sheet } from './ui';

// R-D3: 달력에서 날짜 고르기 (일요일 시작)
export function CalendarSheet({ day, today, onPick, onClose }: { day: DayKey; today: DayKey; onPick: (d: DayKey) => void; onClose: () => void }) {
  const [ym, setYm] = useState(day.slice(0, 7));
  const [y, m] = ym.split('-').map(Number);
  const first = toDayKey(y, m, 1);
  const lead = new Date(first + 'T00:00:00Z').getUTCDay();
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (k: number) => setYm(toDayKey(y, m + k, 1).slice(0, 7));
  return (
    <Sheet onClose={onClose} label="달력">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => shift(-1)} aria-label="이전 달" className="btn btn-icon">‹</button>
        <span style={H}>{y}년 {m}월</span>
        <button onClick={() => shift(1)} aria-label="다음 달" className="btn btn-icon">›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4, textAlign: 'center' }}>
        {['일', '월', '화', '수', '목', '금', '토'].map(h => <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-600)', paddingBottom: 4 }}>{h}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
        {Array.from({ length: n }, (_, i) => {
          const d = toDayKey(y, m, i + 1);
          const sel = d === day;
          const isToday = d === today;
          return (
            <button key={d} aria-label={`${m}월 ${i + 1}일`} onClick={() => onPick(d)} style={{ height: 40, border: 0, borderRadius: '50%', cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: sel || isToday ? 700 : 500, background: sel ? 'var(--color-accent)' : 'transparent', color: sel ? 'var(--color-neutral-100)' : 'var(--color-text)', boxShadow: isToday && !sel ? 'inset 0 0 0 2px var(--color-accent)' : 'none', opacity: d < today ? 0.7 : 1 }}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// 직접 추가 (+ 시간 지정 = 예약, R-T3)
export function AddSheet({ keywords, tone, onSubmit, onClose }: { keywords: { id: string; name: string }[]; tone: Tone; onSubmit: (x: { name: string; keywordId: string; timed: null | { start: string; end: string } }) => Promise<boolean>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [kw, setKw] = useState(keywords.find(k => k.name === '생활')?.id ?? keywords[0]?.id ?? '');
  const [timed, setTimed] = useState(false);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('18:30');
  const [busy, setBusy] = useState(false);
  const badTime = timed && !(start && end && end > start);
  const off = !name.trim() || !kw || badTime || busy;
  return (
    <Sheet onClose={onClose} label="직접 추가">
      <span style={H}>직접 추가</span>
      <div className="field"><label htmlFor="add-name">이름</label><input id="add-name" className="input" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="예: 장보기" /></div>
      <div className="field">
        <label>일상 키워드</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {keywords.map(k => (
            <button key={k.id} aria-pressed={kw === k.id} onClick={() => setKw(k.id)} style={{ height: 36, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, ...pill(kw === k.id, tone) }}>{k.name}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>시간 지정</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>시간표에 계획으로 놓이고 알람이 울려요</span>
        </div>
        <button role="switch" aria-checked={timed} aria-label="시간 지정" onClick={() => setTimed(!timed)} style={{ flex: 'none', width: 52, height: 30, borderRadius: 999, border: 0, padding: 3, cursor: 'pointer', background: timed ? 'var(--color-accent-2)' : 'var(--color-neutral-400)', display: 'flex', justifyContent: timed ? 'flex-end' : 'flex-start' }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-neutral-100)', boxShadow: 'var(--shadow-sm)' }} />
        </button>
      </div>
      {timed && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <div className="field"><label htmlFor="add-start">시작</label><TimeSelect id="add-start" value={start} onChange={setStart} /></div>
            <div className="field"><label htmlFor="add-end">끝</label><TimeSelect id="add-end" value={end} onChange={setEnd} /></div>
          </div>
          <span style={{ fontSize: 12, color: badTime ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', marginTop: -6 }}>{badTime ? '끝 시각이 시작보다 늦어야 해요.' : '예약 할 일은 다음 날로 넘어가지 않아요.'}</span>
        </>
      )}
      <button
        disabled={off}
        onClick={async () => {
          setBusy(true);
          const ok = await onSubmit({ name: name.trim(), keywordId: kw, timed: timed ? { start, end } : null });
          setBusy(false);
          if (ok) onClose();
        }}
        className="btn btn-primary"
        style={{ height: 46 }}
      >
        추가
      </button>
    </Sheet>
  );
}

// 10분 단위 시각 고르기 (휴대폰 기본 시각 입력은 10분 단위를 지키지 않아서 직접 만든다)
function TimeSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 10) opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return (
    <select id={id} className="input" value={value} onChange={e => onChange(e.target.value)} style={{ height: 44, fontWeight: 700, cursor: 'pointer' }}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export type PlanTodo = { key: string; tag: string; name: string; tone: Tone; on: boolean };

// 계획 블록 이름 (R-S6): 할 일 선택 / 키워드(일상 키워드 칩) / 건너뛰기 · 블록 삭제
export function PlanSheet({ isNew, range, todos, keywords, current, dailyTone, onTodo, onKeyword, onLabel, onSecondary, onClose }: {
  isNew: boolean;
  range: string;
  todos: PlanTodo[];
  keywords: { id: string; name: string; on: boolean }[];
  current: string | null;
  dailyTone: Tone;
  onTodo: (key: string) => void;
  onKeyword: (id: string) => void;
  onLabel: (text: string) => void;
  onSecondary: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(current ?? '');
  return (
    <Sheet onClose={onClose} label="계획 블록">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={H}>{isNew ? '이 계획의 이름' : '계획 블록'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{range}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>할 일에서 고르기</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {todos.map(t => (
            <button key={t.key} onClick={() => onTodo(t.key)} style={{ flex: 'none', border: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 16, ...pill(t.on, t.tone), color: 'var(--color-text)' }}>
              <span style={{ flex: 'none', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: t.tone.bg, color: t.tone.ink }}>{t.tag}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
            </button>
          ))}
          {todos.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>이 날 할 일이 없어요.</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>또는 키워드</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {keywords.map(k => (
            <button key={k.id} onClick={() => onKeyword(k.id)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, ...pill(k.on, dailyTone) }}>{k.name}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" aria-label="계획 이름 직접 입력" maxLength={20} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && text.trim() && onLabel(text.trim())} placeholder="직접 입력 (예: 장보기)" />
          <button className="btn btn-secondary" onClick={() => onLabel(text.trim())} disabled={!text.trim()} style={{ flex: 'none', fontFamily: 'var(--font-body)', fontWeight: 700 }}>적용</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onSecondary} style={{ flex: 1, height: 46, fontFamily: 'var(--font-body)', fontWeight: 700 }}>{isNew ? '건너뛰기' : '블록 삭제'}</button>
        <button className="btn btn-primary" onClick={onClose} style={{ flex: 1, height: 46 }}>완료</button>
      </div>
    </Sheet>
  );
}

// 하루 기록 (R-J1~J3): 점수 → 이유 한 줄 → 감사 세 줄 → 메모. 오늘만 쓸 수 있다
export function JournalSheet({ day, journal, readOnly, onSave, onClose }: { day: DayKey; journal: Journal | null; readOnly: boolean; onSave: (j: Journal) => Promise<boolean>; onClose: () => void }) {
  const [j, setJ] = useState<Journal>(journal ?? { date: day, score: null, reason: '', thanks: ['', '', ''], memo: '' });
  const [busy, setBusy] = useState(false);
  const { md: mdLabel, dow } = dayLabel(day);
  const close = async () => {
    if (readOnly) return onClose();
    setBusy(true);
    const ok = await onSave(j);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet onClose={readOnly ? onClose : close} label="하루 기록">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={H}>하루 기록</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{mdLabel} {dow}{readOnly ? ' · 읽기 전용' : ''}</span>
      </div>
      <div className="field">
        <label>오늘 하루 점수</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const on = j.score === n;
            return (
              <button key={n} aria-label={n + '점'} aria-pressed={on} disabled={readOnly} onClick={() => setJ({ ...j, score: on ? null : n })} style={{ width: 44, height: 44, borderRadius: '50%', border: 0, padding: 0, cursor: readOnly ? 'default' : 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, background: on ? 'var(--color-accent)' : 'var(--color-surface)', color: on ? 'var(--color-neutral-100)' : 'var(--color-text)', boxShadow: on ? 'none' : 'inset 0 0 0 2px var(--color-neutral-300)' }}>{n}</button>
            );
          })}
        </div>
      </div>
      <div className="field"><label htmlFor="j-reason">이유 한 줄</label><input id="j-reason" className="input" maxLength={100} value={j.reason} readOnly={readOnly} onChange={e => setJ({ ...j, reason: e.target.value })} placeholder="왜 이 점수인가요?" /></div>
      <div className="field">
        <label>감사</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {j.thanks.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 'none', width: 16, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, color: 'var(--color-accent-700)' }}>{i + 1}.</span>
              <input className="input" aria-label={`감사 ${i + 1}`} maxLength={100} value={v} readOnly={readOnly} onChange={e => setJ({ ...j, thanks: j.thanks.map((x, k) => (k === i ? e.target.value : x)) })} placeholder="감사한 일" />
            </div>
          ))}
        </div>
      </div>
      <div className="field"><label htmlFor="j-memo">메모</label><textarea id="j-memo" className="input" rows={3} maxLength={2000} value={j.memo} readOnly={readOnly} onChange={e => setJ({ ...j, memo: e.target.value })} placeholder="자유롭게 적어요" style={{ resize: 'none', height: 'auto', paddingTop: 10, paddingBottom: 10, lineHeight: 1.5, borderRadius: 20 }} /></div>
      <button onClick={close} disabled={busy} className="btn btn-primary" style={{ height: 46 }}>{readOnly ? '닫기' : '저장'}</button>
    </Sheet>
  );
}

export function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <span style={H}>{title}</span>
      <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{body}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, height: 46, fontFamily: 'var(--font-body)', fontWeight: 700 }}>취소</button>
        <button className="btn btn-primary" onClick={onConfirm} style={{ flex: 1, height: 46 }}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}


