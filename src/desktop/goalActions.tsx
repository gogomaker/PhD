import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAccount, type Goal } from '../account/AccountProvider';
import { ConfirmDialog } from '../ui/Dialog';

// R-G4: 시작 전 목표만 삭제. 계획 표 칸도 함께 지워진다는 확인을 받는다
export function useDeleteGoal(onDeleted?: (g: Goal) => void) {
  const { run } = useAccount();
  const [target, setTarget] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);

  const dialog = target && (
    <ConfirmDialog
      title={`‘${target.name}’ 목표를 지울까요?`}
      body="세부목표와, 연간·월간 계획 표에 배치한 칸도 함께 지워지고 되돌릴 수 없어요."
      confirmLabel="삭제하기"
      busy={busy}
      onClose={() => setTarget(null)}
      onConfirm={async () => {
        setBusy(true);
        const g = target;
        const ok = await run(() => supabase.from('goals').delete().eq('id', g.id));
        setBusy(false);
        setTarget(null);
        if (ok) onDeleted?.(g);
      }}
    />
  );
  return { ask: (g: Goal) => setTarget(g), dialog };
}
