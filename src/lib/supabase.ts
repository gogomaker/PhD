import { createClient } from '@supabase/supabase-js';

// 공개 값(.env.production / .env.development). 비밀 키는 여기에 두지 않는다.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
