import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAccount } from '../account/AccountProvider';
import { PALETTE } from '../lib/palette';
import { userDayKey } from '../lib/day';
import { hours, shortDate } from '../lib/tracking';
import { photoUrls } from '../lib/photos';
import { RETRO_QS } from './WrapDialog';

const pill = (on: boolean) => (on ? 'btn btn-primary' : 'btn btn-secondary');
type Filter = 'all' | 'completed' | 'dropped';
const FILTERS: [Filter, string][] = [['all', '전체'], ['completed', '완성'], ['dropped', '중도 마무리']];

// 회고 모음 (SPEC 4.8): 마무리한 목표 카드, 최신순, 필터
export default function ReviewsPage() {
  const { goals, goalCategories, profile } = useAccount();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [totals, setTotals] = useState<Record<string, { actual_slots: number; done_tasks: number }>>({});
  const closed = goals.filter(g => g.finished_at).sort((a, b) => b.finished_at!.localeCompare(a.finished_at!));
  const photoKey = closed.map(g => g.finish_photo_path).filter(Boolean).join('|');

  useEffect(() => {
    photoUrls(photoKey ? photoKey.split('|') : []).then(setUrls);
  }, [photoKey]);
  useEffect(() => {
    supabase.rpc('goal_totals').then(({ data }) => setTotals(Object.fromEntries(((data ?? []) as { goal_id: string; actual_slots: number; done_tasks: number }[]).map(t => [t.goal_id, t]))));
  }, [goals]);

  const dayOf = (ts: string) => userDayKey(new Date(ts), profile?.timezone, profile?.day_start_hour);
  const shown = closed.filter(g => filter === 'all' || g.status === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="tag tag-accent-2" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>기록 · 회고 모음</span>
          <h1 style={{ margin: 0, fontSize: 42 }}>마무리한 목표들</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>목표를 마무리할 때 남긴 회고를 최신순으로 모았어요.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={pill(filter === k)} aria-pressed={filter === k} onClick={() => setFilter(k)} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 }}>{label}</button>
          ))}
        </div>
      </div>
      {closed.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', borderRadius: 28, padding: '20px 24px' }}>
          <span style={{ fontSize: 15, fontWeight: 600, textWrap: 'pretty' }}>마무리한 목표의 회고가 여기에 모여요</span>
          <button className="btn btn-primary" onClick={() => navigate('/board')}>꿈 보드</button>
        </div>
      ) : shown.length === 0 ? (
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{filter === 'completed' ? '완성' : '중도 마무리'}한 목표가 아직 없어요.</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
          {shown.map(g => {
            const cat = goalCategories.find(c => c.id === g.category_id);
            const p = PALETTE[cat?.color ?? 'red'];
            const done = g.status === 'completed';
            const url = g.finish_photo_path ? urls[g.finish_photo_path] : undefined;
            const t = totals[g.id];
            const qa = RETRO_QS.map(([k, q]) => [q, g[k]] as const).filter(([, a]) => a);
            return (
              <article key={g.id} data-testid="review-card" style={{ background: 'var(--color-surface)', borderRadius: 32, padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {g.finish_photo_path && (
                  <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '4 / 3', background: 'var(--color-neutral-200)' }}>
                    {url && <img src={url} alt={g.name + ' 인증사진'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </div>
                )}
                <div style={{ padding: '6px 8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: p.ink }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.dot }} />{cat?.name}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: done ? p.ink : 'var(--color-neutral-300)', color: done ? 'var(--color-neutral-100)' : 'var(--color-neutral-800)' }}>{done ? '완성' : '중도 마무리'}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 24 }}>{g.name}</h3>
                  <div style={{ display: 'flex', gap: '6px 14px', fontSize: 12.5, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
                    <span>{shortDate(dayOf(g.started_at ?? g.created_at))} – {shortDate(dayOf(g.finished_at!))}</span>
                    <span>누적 {t ? hours(t.actual_slots) : '–'}시간</span>
                    <span>실천 {t ? t.done_tasks : '–'}개 완료</span>
                  </div>
                </div>
                {qa.length > 0 && (
                  <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {qa.map(([q, a]) => (
                      <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{q}</span>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, textWrap: 'pretty', whiteSpace: 'pre-wrap' }}>{a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
