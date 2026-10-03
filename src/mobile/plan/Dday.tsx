// D-day 하나 (2026-10-03 기획 결정): 계획 › 목표에서 이름 + 날짜를 정하고, 기록 › 오늘 탭 줄 오른쪽에 보인다
import { useState } from 'react';
import { Count } from '../../ui/Count';
import { isDayKey } from '../../lib/day';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../account/AccountProvider';
import { type DayKey } from '../../lib/day';
import { ddayText, monthEnd } from '../../lib/dday';
import { md } from '../../lib/plan';
import { BODY, Dot, Field, ICON, Sheet, SheetHead, Svg } from '../ui';
import { useOpenGoals } from './planSheets';

/** 계획 › 목표의 D-day 줄 */
export function DdayRow({ today }: { today: DayKey }) {
  const { profile } = useAccount();
  const [open, setOpen] = useState(false);
  const set = profile?.dday_name && profile.dday_date;
  return (
    <>
      <button data-testid="dday-row" onClick={() => setOpen(true)} className={set ? 'm-card' : 'btn m-hover'} style={set
        ? { flex: 'none', border: 0, cursor: 'pointer', textAlign: 'left', ...BODY, color: 'var(--color-text)', background: 'var(--color-surface)', borderRadius: 22, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginTop: -8 }
        : { flex: 'none', height: 44, border: '2px dashed var(--color-neutral-400)', borderRadius: 22, color: 'var(--color-neutral-800)', ...BODY, fontSize: 13.5, marginTop: -8 }}>
        {set ? (
          <>
            <span style={{ flex: 'none', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, color: 'var(--color-accent-700)' }}>{ddayText(profile!.dday_date!, today)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile!.dday_name}</span>
            <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{profile!.dday_date!.slice(0, 4)}.{md(profile!.dday_date!)}</span>
            <Svg d={ICON.right} size={14} style={{ color: 'var(--color-neutral-500)' }} />
          </>
        ) : '+ D-day 정하기'}
      </button>
      {open && <DdaySheet onClose={() => setOpen(false)} />}
    </>
  );
}

function DdaySheet({ onClose }: { onClose: () => void }) {
  const { profile, run } = useAccount();
  const { list, toneOf } = useOpenGoals();
  const [name, setName] = useState(profile?.dday_name ?? '');
  const [date, setDate] = useState(profile?.dday_date ?? '');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const save = async (patch: { dday_name: string | null; dday_date: string | null }) => {
    setBusy(true);
    const ok = await run(() => supabase.from('profiles').update(patch).eq('id', profile.id));
    setBusy(false);
    if (ok) onClose();
  };
  const ok = name.trim() && isDayKey(date);
  return (
    <Sheet onClose={onClose} label="D-day">
      <SheetHead title="D-day" sub="하나만 정해요. 기록 › 오늘 화면 위에 보여요." />
      {list.length > 0 && (
        <Field label="목표 기한에서 고르기">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {list.map(g => {
              const t = toneOf(g);
              return (
                <button key={g.id} onClick={() => { setName(g.name); setDate(monthEnd(g.due_month)); }} className="btn btn-secondary" style={{ height: 34, padding: '0 12px', gap: 6, ...BODY, fontSize: 12.5 }}>
                  <Dot color={t.dot} />{g.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}
      <Field label="이름">
        <input className="input" aria-label="D-day 이름" maxLength={30} value={name} onChange={e => setName(e.target.value)} placeholder="예: 토익 시험" />
          <Count value={name} max={30} />
      </Field>
      <Field label="날짜">
        <input className="input" type="date" aria-label="D-day 날짜" min="2000-01-01" max="2100-12-31" value={date} onChange={e => setDate(e.target.value)} style={{ height: 44, fontWeight: 700 }} />
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        {profile.dday_name && <button className="btn btn-ghost" disabled={busy} onClick={() => save({ dday_name: null, dday_date: null })} style={{ flex: 'none', height: 46, padding: '0 20px', ...BODY, color: 'var(--color-accent-700)' }}>지우기</button>}
        <button className="btn btn-primary" disabled={!ok || busy} onClick={() => save({ dday_name: name.trim(), dday_date: date })} style={{ flex: 1, height: 46 }}>저장</button>
      </div>
    </Sheet>
  );
}
