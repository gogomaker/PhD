// 데이터 내보내기 (2026-10-01 기획 결정): 압축 파일 하나에 엑셀용 CSV 여러 개
import { supabase } from './supabase';
import { addDays, userDayKey } from './day';
import { md } from './plan';
import { timeOf } from './today';
import { makeZip, toCsv, type Cell } from './zip';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const PAGE = 1000;
/** 한 번에 1000줄까지라서 나눠 읽는다 */
async function all(table: string, cols = '*'): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(cols).order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as unknown as Row[]));
    if (!data || data.length < PAGE) return out;
  }
}

const STATUS: Record<string, string> = { not_started: '시작 전', in_progress: '진행 중', completed: '완성', dropped: '중도 마무리' };
const IMPORTANCE: Record<string, string> = { high: '높음', mid: '보통', low: '낮음' };
const SOURCE: Record<string, string> = { repeat: '반복', auto: '자동 배정', picked: '담기', direct: '직접 추가' };
const DOW = ['', '월', '화', '수', '목', '금', '토', '일'];

export async function buildExport(): Promise<{ name: string; data: Uint8Array }[]> {
  const [profiles, categories, keywords, goals, subgoals, yearCells, monthCells, notes, practices, tasks, blocks, journals, progress] = await Promise.all([
    all('profiles'), all('categories'), all('daily_keywords'), all('goals'), all('subgoals'), all('year_cells'), all('month_cells'),
    all('notes'), all('practices'), all('tasks'), all('time_blocks'), all('day_journals'), all('goal_progress'),
  ]);
  const p = profiles[0] ?? {};
  const tz: string = p.timezone;
  const ds: number = p.day_start_hour;
  const day = (ts: string | null) => (ts ? userDayKey(new Date(ts), tz, ds) : '');
  const at = (ts: string | null) => {
    if (!ts) return '';
    const f = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return f.format(new Date(ts));
  };
  const byId = (rows: Row[]) => new Map(rows.map(r => [r.id, r]));
  const cat = byId(categories), goal = byId(goals), sub = byId(subgoals), prac = byId(practices), task = byId(tasks), kw = byId(keywords);
  const pos = (a: Row, b: Row) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at));
  const sortedGoals = [...goals].sort((a, b) => pos(cat.get(a.category_id) ?? {}, cat.get(b.category_id) ?? {}) || pos(a, b));
  const goalName = (id?: string | null) => (id ? goal.get(id)?.name ?? '' : '');
  const subName = (id?: string | null) => (id ? sub.get(id)?.name ?? '' : '');

  // 할 일 → 목표·세부목표·이름·키워드 (직접 추가가 넘어온 일은 처음 행의 이름·연결)
  // 직접 추가를 목표의 세부목표에 연결했으면 그 목표로 (R-T5, 2026-10-03 UT 3차)
  const taskInfo = (t: Row) => {
    const origin = t.carried_task_id ? task.get(t.carried_task_id) ?? t : t;
    const pr = t.practice_id ? prac.get(t.practice_id) : null;
    const subId: string | null = pr?.subgoal_id ?? origin.subgoal_id ?? null;
    const goalId: string | null = pr?.goal_id ?? (subId ? sub.get(subId)?.goal_id : null) ?? null;
    return { goal: goalName(goalId), sub: subName(subId), name: pr ? pr.name : origin.name ?? '', kw: origin.daily_keyword_id ? kw.get(origin.daily_keyword_id)?.name ?? '' : '' };
  };
  const hm = (t?: string | null) => (t ? t.slice(0, 5) : '');

  const files: [string, string[], Cell[][]][] = [];

  files.push(['꿈.csv', ['항목', '내용'], [['궁극적 꿈', p.dream], ['왜 이 꿈인가', p.dream_why], ['꿈을 이룬 나의 하루', p.dream_day]]]);

  const lastProgress = new Map<string, number>();
  for (const r of [...progress].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) lastProgress.set(r.goal_id, r.percent);
  const goalRows: Cell[][] = [];
  for (const c of [...categories].filter(c => c.kind === 'goal').sort(pos)) {
    const gs = sortedGoals.filter(g => g.category_id === c.id);
    if (!gs.length) goalRows.push([c.name, c.aspiration, '', '', '', '', '', '', '', '', '', '']);
    for (const g of gs) {
      goalRows.push([
        c.name, c.aspiration, g.name, subgoals.filter(s => s.goal_id === g.id).sort(pos).map(s => s.name).join(' / '),
        String(g.due_month).slice(0, 7), STATUS[g.status], day(g.started_at), day(g.finished_at), g.reason, IMPORTANCE[g.importance] ?? '', g.fallback, lastProgress.get(g.id) ?? '',
      ]);
    }
  }
  files.push(['목표.csv', ['카테고리', '되고 싶은 모습', '목표', '세부목표', '기한', '상태', '시작일', '마무리일', '이유', '중요도', '대안', '마지막 진척도(%)'], goalRows]);

  const planRows: Cell[][] = [];
  for (const c of [...yearCells].sort((a, b) => a.start_month.localeCompare(b.start_month)))
    planRows.push(['연간', `${c.start_month.slice(0, 7)} ~ ${c.end_month.slice(0, 7)}`, goalName(c.goal_id), subName(c.subgoal_id), c.memo, '', '']);
  for (const c of [...monthCells].sort((a, b) => a.year_month.localeCompare(b.year_month) || a.start_week - b.start_week))
    planRows.push(['월간', `${c.year_month.slice(0, 7)} ${c.start_week + 1}~${c.end_week + 1}주차`, goalName(c.goal_id), subName(c.subgoal_id), c.comment, '', '']);
  for (const x of [...practices].sort((a, b) => a.week_start_date.localeCompare(b.week_start_date)))
    planRows.push(['주간 실천', `${x.week_start_date} 주`, goalName(x.goal_id), subName(x.subgoal_id), x.name, (x.weekdays as number[]).map(w => DOW[w]).join('·'), x.start_time ? `${hm(x.start_time)}~${hm(x.end_time)}` : '']);
  for (const n of [...notes].sort((a, b) => a.period_key.localeCompare(b.period_key) || a.start_index - b.start_index)) {
    const when = n.scope === 'month'
      ? `${n.period_key.slice(0, 7)} ${n.start_index + 1}~${n.end_index + 1}주차`
      : `${n.period_key} 주 ${[n.start_index, n.end_index].map((i: number) => (i < 0 ? '이번 주' : md(addDays(n.period_key, i)))).join('~')}`;
    planRows.push([n.scope === 'month' ? '월간 참고사항' : '주간 참고사항', when, '', '', n.text, '', '']);
  }
  files.push(['계획표.csv', ['표', '기간', '목표', '세부목표', '내용', '요일', '시간'], planRows]);

  files.push(['할일.csv', ['날짜', '구분', '목표', '세부목표', '할 일', '키워드', '시작', '끝', '완료 시각', '처음 날짜(넘어온 일)'],
    [...tasks].sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at).localeCompare(String(b.created_at))).map(t => {
      const i = taskInfo(t);
      // 시간을 정한 실천이면 그 시각
      const pr = t.practice_id ? prac.get(t.practice_id) : null;
      return [t.date, SOURCE[t.source], i.goal, i.sub, i.name, i.kw, hm(t.start_time ?? pr?.start_time), hm(t.end_time ?? pr?.end_time), at(t.done_at), t.carried_from_date];
    })]);

  files.push(['시간기록.csv', ['날짜', '구분', '시작', '끝', '분', '목표', '할 일', '키워드', '이름'],
    [...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.layer.localeCompare(b.layer) || a.start_slot - b.start_slot).map(b => {
      const t = b.task_id ? task.get(b.task_id) : null;
      const i = t ? taskInfo(t) : null;
      return [b.date, b.layer === 'plan' ? '계획' : '실제', timeOf(b.start_slot, ds), timeOf(b.end_slot + 1, ds), (b.end_slot - b.start_slot + 1) * 10, i?.goal, i?.name, b.daily_keyword_id ? kw.get(b.daily_keyword_id)?.name : i?.kw, b.label];
    })]);

  files.push(['하루기록.csv', ['날짜', '점수', '이유', '감사 1', '감사 2', '감사 3', '메모'],
    [...journals].sort((a, b) => a.date.localeCompare(b.date)).map(j => [j.date, j.score, j.reason, ...(j.thanks as string[]), j.memo])]);

  files.push(['회고.csv', ['목표', '카테고리', '결과', '시작일', '마무리일', '무엇을 해냈나요', '아쉬웠던 점', '다음에 다르게 할 것', '인증사진'],
    goals.filter(g => g.finished_at).sort((a, b) => b.finished_at.localeCompare(a.finished_at)).map(g => [
      g.name, cat.get(g.category_id)?.name, STATUS[g.status], day(g.started_at ?? g.created_at), day(g.finished_at), g.retro_achieved, g.retro_regret, g.retro_next, g.finish_photo_path ? '있음 (앱의 회고 모음에서 보기)' : '',
    ])]);

  return files.map(([name, header, rows]) => ({ name, data: toCsv(header, rows) }));
}

/** 내려받기: phd-2026-10-01.zip */
export async function downloadExport(today: string) {
  const zip = makeZip(await buildExport());
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `phd-${today}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
