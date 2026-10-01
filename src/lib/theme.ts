// 화면 테마: 시스템 설정 / 라이트 / 다크. 기기마다 따로 저장한다 (2026-10-01 기획 결정)
import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_OPTIONS: [ThemePref, string][] = [['system', '시스템 설정'], ['light', '라이트'], ['dark', '다크']];

const KEY = 'phd-theme';
const BG = { light: '#f5ead8', dark: '#1b1916' };
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* 저장소를 못 쓰는 창 */ }
  return 'system';
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (media().matches ? 'dark' : 'light') : pref;
}

/** <html data-theme> 와 주소창 색을 맞춘다 */
export function applyTheme(pref = getThemePref()) {
  const t = resolveTheme(pref);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[t]);
}

/** 앱 시작 때 한 번: 시스템 설정이 바뀌면 따라간다 */
export function watchSystemTheme() {
  applyTheme();
  media().addEventListener('change', () => applyTheme());
}

export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    try {
      if (pref === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch { /* 저장 못 해도 지금 화면엔 적용 */ }
    applyTheme(pref);
  }, [pref]);
  return [pref, setPref] as const;
}
