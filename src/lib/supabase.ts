import { createClient } from '@supabase/supabase-js';

// "로그인 상태 유지": 켜면 브라우저를 닫아도 로그인 유지(localStorage),
// 끄면 이 탭/창을 닫으면 로그아웃(sessionStorage). 기기마다 따로 정한다.
const REMEMBER_KEY = 'phd.remember';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getRemember() {
  return safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true);
}

export function setRemember(remember: boolean) {
  safe(() => localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'), undefined);
}

const authStorage = {
  getItem: (key: string) => safe(() => localStorage.getItem(key) ?? sessionStorage.getItem(key), null),
  setItem: (key: string, value: string) =>
    safe(() => {
      const [keep, drop] = getRemember() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(key, value);
      drop.removeItem(key);
    }, undefined),
  removeItem: (key: string) =>
    safe(() => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }, undefined),
};

// 공개 값(.env.production / .env.development). 비밀 키는 여기에 두지 않는다.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storage: authStorage },
});
