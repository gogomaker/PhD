import type { ReactNode } from 'react';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ zIndex: 50 }}>
      <div className="dialog" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <h2 className="dialog-title" style={{ margin: 0, fontSize: 26 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const PILL_STYLE = { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 } as const;

/** 확인 상자: 취소 / (위험한) 확인 */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, busy }: { title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>{body}</p>
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose} style={PILL_STYLE}>취소</button>
        <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
