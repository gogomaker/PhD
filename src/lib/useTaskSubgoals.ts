import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** 직접 추가 할 일에 연결된 세부목표들 (지울 수 없어서 미리 알려 준다, 2026-10-03 UT 2차) */
export function useTaskSubgoals(subIds: string[]) {
  const [used, setUsed] = useState<Set<string>>(new Set());
  const key = subIds.join(',');
  useEffect(() => {
    if (!key) return setUsed(new Set());
    let live = true;
    supabase.from('tasks').select('subgoal_id').in('subgoal_id', key.split(',')).then(({ data }) => {
      if (live && data) setUsed(new Set(data.map(r => r.subgoal_id as string)));
    });
    return () => { live = false; };
  }, [key]);
  return used;
}
