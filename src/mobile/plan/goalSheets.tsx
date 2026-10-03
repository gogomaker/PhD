// 목표 시트: 새 목표 · 마무리(R-G5~G8) · 회고 보기(4.8)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { errorText } from '../../lib/errors';
import { useAccount, useToday, type Goal } from '../../account/AccountProvider';
import { PALETTE } from '../../lib/palette';
import { userDayKey } from '../../lib/day';
import { MAX_GOAL_NAME } from '../../lib/goals';
import { hours, shortDate } from '../../lib/tracking';
import { photoUrls, removePhotos, shrinkPhoto, uploadPhoto } from '../../lib/photos';
import { MonthPicker, isMonth } from '../../ui/MonthPicker';
import { Count } from '../../ui/Count';
import { RETRO_QS } from '../../desktop/WrapDialog';
import { BODY, Dot, Field, H, Sheet, SheetHead, chip } from '../ui';

type Totals = { actual_slots: number; done_tasks: number };

/** 목표별 누적 시간·완료한 실천 (goal_totals) */
export function useGoalTotals(dep?: unknown) {
  const [totals, setTotals] = useState<Record<string, Totals> | null>(null);
  useEffect(() => {
    let live = true;
    supabase.rpc('goal_totals').then(({ data }) => {
      if (live) setTotals(Object.fromEntries(((data ?? []) as ({ goal_id: string } & Totals)[]).map(t => [t.goal_id, t])));
    });
    return () => { live = false; };
  }, [dep]);
  return totals;
}

export function useGoalTone(g: Goal | undefined | null) {
  const { goalCategories } = useAccount();
  const cat = g ? goalCategories.find(c => c.id === g.category_id) : undefined;
  return { cat, tone: PALETTE[cat?.color ?? 'red'] };
}

// ───────── 새 목표: 카테고리 · 이름 · 기한(필수) → 만들고 목표 편집으로 ─────────
export function NewGoalSheet({ onClose, categoryId }: { onClose: () => void; categoryId?: string }) {
  const { goalCategories, goals, create } = useAccount();
  const navigate = useNavigate();
  const [cat, setCat] = useState(categoryId ?? goalCategories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const off = !cat || !name.trim() || !isMonth(due) || busy;

  const submit = async () => {
    if (off) return;
    setBusy(true);
    const inCat = goals.filter(g => g.category_id === cat);
    const position = inCat.length ? Math.max(...inCat.map(g => g.position)) + 1 : 0;
    const id = await create(() => supabase.from('goals').insert({ category_id: cat, name: name.trim(), due_month: due + '-01', position }).select('id').single());
    setBusy(false);
    if (!id) return;
    onClose();
    navigate('/goal/' + id, { replace: true });
  };

  return (
    <Sheet onClose={onClose} label="새 목표">
      <span style={H}>새 목표</span>
      <Field label="카테고리">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {goalCategories.map(c => {
            const t = PALETTE[c.color];
            return (
              <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, cursor: 'pointer', ...BODY, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, ...chip(cat === c.id, t) }}>
                <Dot color={t.dot} />{c.name}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="목표">
        <input className="input" aria-label="목표 이름" maxLength={MAX_GOAL_NAME} value={name} onChange={e => setName(e.target.value)} placeholder="예: 토익 850" />
        <Count value={name} max={MAX_GOAL_NAME} />
      </Field>
      <Field label="기한" required>
        <MonthPicker label="목표 기한" value={due} onChange={setDue} />
      </Field>
      <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: -4 }}>세부 목표와 이유는 다음 화면에서 적어요.</span>
      <button className="btn btn-primary" onClick={submit} disabled={off} style={{ flex: 'none', height: 46 }}>만들고 자세히 쓰기</button>
    </Sheet>
  );
}

// ───────── 마무리: 자동 요약 → 완성/중도 → (완성만) 인증사진 → 회고 3칸 ─────────
export function WrapSheet({ goal: g, onClose }: { goal: Goal; onClose: () => void }) {
  const { profile, session, reload, toast } = useAccount();
  const today = useToday();
  const { cat, tone } = useGoalTone(g);
  const totals = useGoalTotals()?.[g.id];
  const [kind, setKind] = useState<'completed' | 'dropped'>('completed');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [retro, setRetro] = useState<Record<(typeof RETRO_QS)[number][0], string>>({ retro_achieved: '', retro_regret: '', retro_next: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const start = userDayKey(new Date(g.started_at ?? g.created_at), profile?.timezone, profile?.day_start_hour);
  const stats = [
    ['기간', `${shortDate(start)} – ${shortDate(today)}`],
    ['누적 시간', totals ? hours(totals.actual_slots) + '시간' : '…'],
    ['완료한 실천', totals ? totals.done_tasks + '개' : '…'],
  ];

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await shrinkPhoto(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast('이 사진은 열 수 없어요. JPG나 PNG로 올려 주세요');
    }
  };

  const confirm = async () => {
    if (!session) return;
    setBusy(true);
    let path: string | null = null;
    if (kind === 'completed' && photo) {
      const up = await uploadPhoto(session.user.id, g.id, photo.blob);
      if (up.error) {
        setBusy(false);
        return toast(errorText(up.error));
      }
      path = up.path;
    }
    const { error } = await supabase.rpc('finish_goal', { p_goal: g.id, p_kind: kind, p_photo: path, p_achieved: retro.retro_achieved, p_regret: retro.retro_regret, p_next: retro.retro_next });
    if (error) {
      if (path) await removePhotos([path]);
      setBusy(false);
      return toast(errorText(error));
    }
    await reload();
    toast('마무리했어요. 회고는 목표 탭 아래에 남아요');
    onClose();
  };

  return (
    <Sheet onClose={onClose} label={g.name + ' 마무리하기'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: tone.ink }}><Dot color={tone.dot} size={10} />{cat?.name}</span>
        <span style={{ ...H, fontSize: 24 }}>{g.name} 마무리하기</span>
      </div>
      <div data-testid="wrap-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
        {stats.map(([k, v]) => (
          <div key={k} style={{ background: tone.bg, borderRadius: 18, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: tone.ink }}>{k}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{v}</span>
          </div>
        ))}
      </div>
      <Field label="마무리 종류">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['completed', 'dropped'] as const).map(k => (
            <button key={k} className={kind === k ? 'btn btn-primary' : 'btn btn-secondary'} aria-pressed={kind === k} onClick={() => setKind(k)} style={{ flex: 1, height: 40, ...BODY, fontSize: 13.5 }}>{k === 'completed' ? '완성' : '중도 마무리'}</button>
          ))}
        </div>
      </Field>
      {kind === 'completed' && (
        <Field label="인증사진 · 1장 (선택)">
          <div data-testid="wrap-photo" style={{ position: 'relative', display: 'grid', placeItems: 'center', height: 150, borderRadius: 24, border: '2px dashed var(--color-neutral-400)', background: 'var(--color-surface)', overflow: 'hidden', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
            {photo ? <img src={photo.url} alt="인증사진" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>눌러서 사진을 올려 주세요</span>}
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="인증사진" onChange={e => pick(e.target.files?.[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </div>
        </Field>
      )}
      {RETRO_QS.map(([k, q]) => (
        <Field key={k} label={q}>
          <textarea className="input" aria-label={q} rows={2} maxLength={1000} value={retro[k]} onChange={e => setRetro(r => ({ ...r, [k]: e.target.value }))} style={{ resize: 'none', height: 'auto', paddingTop: 10, paddingBottom: 10, lineHeight: 1.5, borderRadius: 20 }} />
        </Field>
      ))}
      <div style={{ padding: '10px 14px', borderRadius: 16, background: 'var(--color-neutral-200)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-800)', textWrap: 'pretty' }}>마무리한 목표는 다시 열 수 없어요. 계획에서 빠지고 회고로 남아요.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, height: 46, ...BODY }}>취소</button>
        <button className="btn btn-primary" onClick={confirm} disabled={busy} style={{ flex: 1, height: 46 }}>마무리</button>
      </div>
    </Sheet>
  );
}

// ───────── 회고 보기 (마무리한 목표) ─────────
export function ReviewSheet({ goal: g, onClose }: { goal: Goal; onClose: () => void }) {
  const { profile } = useAccount();
  const { tone } = useGoalTone(g);
  const totals = useGoalTotals()?.[g.id];
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (g.finish_photo_path) photoUrls([g.finish_photo_path]).then(u => setUrl(u[g.finish_photo_path!] ?? null));
  }, [g.finish_photo_path]);
  const dayOf = (ts: string) => userDayKey(new Date(ts), profile?.timezone, profile?.day_start_hour);
  const done = g.status === 'completed';
  const qa = RETRO_QS.map(([k, q]) => [q, g[k]] as const).filter(([, a]) => a);

  return (
    <Sheet onClose={onClose} label={g.name + ' 회고'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: done ? tone.ink : 'var(--color-neutral-300)', color: done ? 'var(--color-bg)' : 'var(--color-neutral-800)' }}>{done ? '완성' : '중도 마무리'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{shortDate(dayOf(g.started_at ?? g.created_at))} – {g.finished_at ? shortDate(dayOf(g.finished_at)) : ''}</span>
      </div>
      <span style={{ ...H, fontSize: 26, lineHeight: 1.15 }}>{g.name}</span>
      {g.finish_photo_path && (
        <div style={{ position: 'relative', flex: 'none', height: 180, borderRadius: 24, overflow: 'hidden', background: 'var(--color-neutral-200)' }}>
          {url && <img src={url} alt={g.name + ' 인증사진'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
        {[
          ['누적 시간', totals ? hours(totals.actual_slots) + '시간' : '…'],
          ['완료한 실천', totals ? totals.done_tasks + '개' : '…'],
        ].map(([k, v]) => (
          <div key={k} style={{ background: tone.bg, borderRadius: 18, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{k}</span>
            <span style={{ ...H, fontSize: 20 }}>{v}</span>
          </div>
        ))}
      </div>
      {qa.map(([q, a]) => (
        <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{q}</span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, textWrap: 'pretty', whiteSpace: 'pre-wrap' }}>{a}</p>
        </div>
      ))}
      {qa.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>남긴 회고가 없어요.</span>}
      <button className="btn btn-primary" onClick={onClose} style={{ flex: 'none', height: 46 }}>닫기</button>
    </Sheet>
  );
}

/** 확인 시트: 취소 / 확인 */
export function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose, busy }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <SheetHead title={title} />
      <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-neutral-800)', textWrap: 'pretty' }}>{body}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, height: 46, ...BODY }}>취소</button>
        <button className="btn btn-primary" onClick={onConfirm} disabled={busy} style={{ flex: 1, height: 46 }}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}
