// D-day 하나 (2026-10-03 기획 결정): 목표 설정에서 이름 + 날짜를 정하고, 사이드바 꿈 카드 위에 보인다 (모바일은 계획 › 목표 / 기록 › 오늘)
import { useState } from 'react';
import { Count } from '../ui/Count';
import { isDayKey } from '../lib/day';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount, useToday } from '../account/AccountProvider';
import { PALETTE } from '../lib/palette';
import { isClosed, sortGoals } from '../lib/goals';
import { md } from '../lib/plan';
import { ddayText, monthEnd } from '../lib/dday';
import { Dialog, PILL_STYLE } from '../ui/Dialog';

/** 목표 설정 화면의 D-day 줄 */
export function DdayRow() {
  const { profile } = useAccount();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const name = profile?.dday_name;
  const date = profile?.dday_date;
  return (
    <>
      {name && date ? (
        <button data-testid="dday-row" onClick={() => setOpen(true)} className="side-card" style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--color-surface)', borderRadius: 28, padding: '16px 24px' }}>
          <span style={{ flex: 'none', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: 'var(--color-accent-700)' }}>{ddayText(date, today)}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{date.slice(0, 4)}.{md(date)}</span>
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-700)', textDecoration: 'underline', textUnderlineOffset: 3 }}>바꾸기</span>
        </button>
      ) : (
        <button data-testid="dday-row" onClick={() => setOpen(true)} className="btn add-dashed" style={{ alignSelf: 'flex-start', border: '2px dashed var(--color-neutral-400)', color: 'var(--color-neutral-700)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13.5, padding: '0 20px', height: 44, borderRadius: 999 }}>
          + D-day 정하기
        </button>
      )}
      {open && <DdayDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function DdayDialog({ onClose }: { onClose: () => void }) {
  const { profile, goals, goalCategories, run } = useAccount();
  const [name, setName] = useState(profile?.dday_name ?? '');
  const [date, setDate] = useState(profile?.dday_date ?? '');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const list = sortGoals(goals.filter(g => !isClosed(g)));
  const dot = (categoryId: string) => PALETTE[goalCategories.find(c => c.id === categoryId)?.color ?? 'red'].dot;
  const save = async (patch: { dday_name: string | null; dday_date: string | null }) => {
    setBusy(true);
    const ok = await run(() => supabase.from('profiles').update(patch).eq('id', profile.id));
    setBusy(false);
    if (ok) onClose();
  };
  const ok = name.trim() && isDayKey(date);
  return (
    <Dialog title="D-day" onClose={onClose}>
      <p className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>하나만 정해요. 사이드바와 휴대폰의 오늘 화면에 보여요.</p>
      {list.length > 0 && (
        <div className="field">
          <label>목표 기한에서 고르기</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {list.map(g => (
              <button key={g.id} type="button" onClick={() => { setName(g.name); setDate(monthEnd(g.due_month)); }} className="btn btn-secondary" style={{ ...PILL_STYLE, height: 34, padding: '0 12px', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot(g.category_id) }} />{g.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 180px', gap: 10 }}>
        <div className="field">
          <label htmlFor="dday-name">이름</label>
          <input id="dday-name" className="input" aria-label="D-day 이름" maxLength={30} value={name} onChange={e => setName(e.target.value)} placeholder="예: 토익 시험" />
          <Count value={name} max={30} />
        </div>
        <div className="field">
          <label htmlFor="dday-date">날짜</label>
          <input id="dday-date" className="input" type="date" aria-label="D-day 날짜" min="2000-01-01" max="2100-12-31" value={date} onChange={e => setDate(e.target.value)} style={{ fontWeight: 700 }} />
        </div>
      </div>
      <div className="dialog-actions">
        {profile.dday_name && <button className="btn btn-ghost" disabled={busy} onClick={() => save({ dday_name: null, dday_date: null })} style={{ ...PILL_STYLE, color: 'var(--color-accent-700)', marginRight: 'auto' }}>지우기</button>}
        <button className="btn btn-secondary" onClick={onClose} style={PILL_STYLE}>취소</button>
        <button className="btn btn-primary" disabled={!ok || busy} onClick={() => save({ dday_name: name.trim(), dday_date: date })}>저장</button>
      </div>
    </Dialog>
  );
}

/** 사이드바: 꿈 카드 위 작은 D-day (정했을 때만) */
export function SideDday() {
  const { profile } = useAccount();
  const today = useToday();
  if (!profile?.dday_name || !profile.dday_date) return null;
  return (
    <NavLink to="/goals" data-testid="side-dday" title="목표 설정에서 바꾸기" className="side-card" style={{ borderRadius: 24, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-text)', color: 'var(--color-bg)' }}>
      <span style={{ flex: 'none', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>{ddayText(profile.dday_date, today)}</span>
      <span style={{ minWidth: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.dday_name}</span>
    </NavLink>
  );
}
