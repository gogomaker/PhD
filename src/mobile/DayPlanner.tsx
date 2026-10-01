import { useState } from 'react';
import { Icon } from '../Icon';
import { useAccount } from '../account/AccountProvider';
import { DEFAULT_DAY_START_HOUR, DEFAULT_TIMEZONE, addDays, dayLabel, dayRelation, userDayKey, type DayRelation } from '../lib/day';

const BADGE: Record<DayRelation, [string, string]> = {
  today: ['오늘', 'tag tag-accent'],
  tomorrow: ['내일', 'tag tag-accent-2'],
  later: ['보기 전용', 'tag tag-neutral'],
  past: ['지난 기록', 'tag tag-neutral'],
};

const BANNER: Partial<Record<DayRelation, string>> = {
  past: '지난 기록은 수정할 수 없어요',
  later: '보기 전용 · 주간 표에서 배정된 실천만 보여요',
};

export default function DayPlanner() {
  // R-D1: 계정 설정의 시간대·하루 시작 시각 기준
  const { profile } = useAccount();
  const dayStartHour = profile?.day_start_hour ?? DEFAULT_DAY_START_HOUR;
  const today = userDayKey(new Date(), profile?.timezone ?? DEFAULT_TIMEZONE, dayStartHour);
  const [day, setDay] = useState(today);
  const rel = dayRelation(day, today);
  const { md, dow } = dayLabel(day);
  const [badge, badgeCls] = BADGE[rel];
  const banner = BANNER[rel];

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', padding: 'max(12px, env(safe-area-inset-top)) 12px max(16px, env(safe-area-inset-bottom))', boxSizing: 'border-box', gap: 8 }}>
      <div style={{ flex: 'none', height: 46, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 4, touchAction: 'pan-y', userSelect: 'none' }}>
        <span className={badgeCls} style={{ justifySelf: 'start', fontWeight: 700, fontSize: 11.5 }}>{badge}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => setDay(addDays(day, -1))} aria-label="전날" className="btn" style={{ width: 36, height: 36, padding: 0, color: 'var(--color-neutral-700)' }}>
            <Icon name="chevronLeft" />
          </button>
          <span style={{ padding: '4px 10px', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1 }}>{md}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17, color: 'var(--color-accent-700)' }}>{dow}</span>
          </span>
          <button onClick={() => setDay(addDays(day, 1))} aria-label="다음 날" className="btn" style={{ width: 36, height: 36, padding: 0, color: 'var(--color-neutral-700)' }}>
            <Icon name="chevronRight" />
          </button>
        </div>
        {rel !== 'today' && (
          <button onClick={() => setDay(today)} className="btn btn-secondary" style={{ justifySelf: 'end', height: 30, padding: '0 12px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12 }}>오늘</button>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 4px' }}>
        <div style={{ flex: 'none', display: 'flex', gap: 10, fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-neutral-400)' }} />계획 <b style={{ color: 'var(--color-text)' }}>0분</b></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-accent)' }} />실제 <b style={{ color: 'var(--color-accent-700)' }}>0분</b></span>
        </div>
      </div>

      {banner && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)', fontSize: 12.5, fontWeight: 600 }}>{banner}</div>
      )}

      {/* 할 일 | 시간표 — 폭 비율 고정 (SPEC 5장 모바일 알려진 문제) */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 166px', gap: 8 }}>
        <div style={{ minWidth: 0, minHeight: 0, background: 'var(--color-surface)', borderRadius: 24, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>오늘 할 일</span>
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', lineHeight: 1.45 }}>데스크톱 주간 표에서 실천을 적으면 여기에 나타나요</span>
        </div>
        <TimeGrid dayStartHour={dayStartHour} />
      </div>

      <button disabled={rel !== 'today'} style={{ flex: 'none', height: 46, border: 0, borderRadius: 999, background: 'var(--color-surface)', font: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 18px' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>하루 기록</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>아직 적지 않았어요</span>
        <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center' }}>
          <Icon name="chevronUp" size={14} />
        </span>
      </button>
    </div>
  );
}

// R-S1, R-S2: 하루 시작 시각부터 24줄 × 10분 6칸, 얇은 선 격자, 30분 위치 점선
function TimeGrid({ dayStartHour }: { dayStartHour: number }) {
  const cols = '20px repeat(6, minmax(0,1fr))';
  return (
    <div style={{ minHeight: 0, background: 'var(--color-surface)', borderRadius: 24, padding: '6px 6px 6px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, fontSize: 9, fontWeight: 700, color: 'var(--color-neutral-600)', textAlign: 'center', height: 12, alignItems: 'center' }}>
        <span />
        {[10, 20, 30, 40, 50, 60].map(m => <span key={m}>{m}</span>)}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols, gridTemplateRows: 'repeat(24, minmax(0,1fr))', borderTop: '1px solid var(--color-neutral-400)', touchAction: 'none', userSelect: 'none' }}>
        {Array.from({ length: 24 }, (_, r) => {
          const h = (r + dayStartHour) % 24;
          return (
            <span key={'h' + r} style={{ gridColumn: 1, gridRow: r + 1, fontSize: 9.5, fontWeight: 700, color: h === 12 || h === 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {String(h).padStart(2, '0')}
            </span>
          );
        })}
        {Array.from({ length: 144 }, (_, i) => {
          const c = i % 6;
          return (
            <div key={i} style={{ gridColumn: c + 2, gridRow: Math.floor(i / 6) + 1, borderRight: c === 5 ? 'none' : c === 2 ? '1px dashed var(--color-neutral-400)' : '1px solid var(--color-neutral-200)', borderBottom: '1px solid var(--color-neutral-400)' }} />
          );
        })}
      </div>
    </div>
  );
}
