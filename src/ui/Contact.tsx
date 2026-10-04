import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 수정사항·문의 받는 곳 (2026-10-04 기획 요청)
export const CONTACT_EMAIL = 'daseulgi100@gmail.com';
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[PhD] 문의')}`;

/** 관리 페이지를 볼 수 있는 계정인지 (서버가 판단) */
export function useIsAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.rpc('is_admin').then(({ data }) => alive && setAdmin(data === true), () => {});
    return () => { alive = false; };
  }, []);
  return admin;
}
