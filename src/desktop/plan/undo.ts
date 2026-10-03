// PC 계획 표: 방금 지운 것 되돌리기 (2026-10-03 UT 11). 안내의 '되돌리기' 버튼 또는 Ctrl+Z(⌘Z)
import type { ToastAction } from '../../account/AccountProvider';

let last: (() => unknown) | null = null;

/** 지운 뒤 부른다: 안내를 띄우고, restore를 되돌리기로 기억 */
export function offerUndo(toast: (m: string, a?: ToastAction) => void, text: string, restore: () => unknown) {
  last = restore;
  toast(text, { label: '되돌리기', run: runUndo });
}

export function runUndo() {
  const r = last;
  last = null;
  if (r) r();
  return !!r;
}

/** 입력 중이 아닐 때만 단축키 */
export const typing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};
