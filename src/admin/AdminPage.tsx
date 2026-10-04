// 서비스 관리 페이지 (2026-10-04 기획 요청): 가입자 수, DAU, WAU — 꾸밈 없이 숫자와 표만.
// 집계는 서버(admin_stats)가 관리자에게만 준다. 테스트 계정은 빠지고, 날짜는 한국 날짜.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';

type Day = { day: string; dau: number; wau: number; joined: number; users: number };
type Stats = { today: string; users: number; joined_today: number; onboarded: number; dau: number; wau: number; mau: number; daily: Day[] };

const cell = { border: '1px solid var(--color-neutral-400)', padding: '6px 8px', textAlign: 'right' } as const;

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_stats', { p_days: 14 });
    if (error) setError(String(error.message).includes('not_admin') ? '관리자만 볼 수 있어요.' : errorText(error));
    else { setStats(data as Stats); setError(null); setAt(new Date()); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <main data-testid="admin" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px', fontFamily: 'system-ui, sans-serif', fontSize: 15, color: 'var(--color-text)', background: 'var(--color-bg)', minHeight: '100dvh', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>PhD 관리</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-neutral-700)' }}>
        <Link to="/">앱으로</Link>
        {at && <> · {at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준 · <button onClick={() => void load()} style={{ font: 'inherit', padding: '2px 8px' }}>새로고침</button></>}
      </p>
      {error && <p role="alert">{error}</p>}
      {!stats && !error && <p>불러오는 중…</p>}
      {stats && (
        <>
          <table data-testid="admin-summary" style={{ borderCollapse: 'collapse', marginBottom: 8 }}>
            <tbody>
              {([
                ['가입자 수', stats.users, '전체 (테스트 계정 제외)'],
                ['오늘 가입', stats.joined_today, ''],
                ['시작 설정 마침', stats.onboarded, '가입 4단계를 끝낸 사람'],
                ['DAU', stats.dau, `오늘(${stats.today.slice(5).replace('-', '.')}) 앱을 연 사람`],
                ['WAU', stats.wau, '최근 7일 동안 앱을 연 사람'],
                ['MAU', stats.mau, '최근 30일'],
              ] as const).map(([k, v, note]) => (
                <tr key={k}>
                  <th style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{k}</th>
                  <td data-testid={'admin-' + k} style={{ ...cell, fontWeight: 700, minWidth: 60 }}>{v}</td>
                  <td style={{ ...cell, textAlign: 'left', fontSize: 13, color: 'var(--color-neutral-700)' }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '0 0 24px', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
            '앱을 연 사람' = 그날 로그인한 채 앱을 한 번 이상 연 사람. 2026.10.4 이전은 그날 남긴 기록(할 일·시간표·하루 기록)으로 셌어요.
          </p>
          <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>최근 14일</h2>
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="admin-daily" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>{['날짜', 'DAU', 'WAU', '신규', '누적'].map(h => <th key={h} style={{ ...cell, textAlign: h === '날짜' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {stats.daily.map(d => (
                  <tr key={d.day}>
                    <td style={{ ...cell, textAlign: 'left' }}>{d.day.slice(5).replace('-', '.')} {'일월화수목금토'[new Date(d.day + 'T00:00:00').getDay()]}</td>
                    <td style={cell}>{d.dau}</td>
                    <td style={cell}>{d.wau}</td>
                    <td style={cell}>{d.joined}</td>
                    <td style={cell}>{d.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
