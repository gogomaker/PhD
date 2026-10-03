// 체험 모드를 마쳤는지: 데모라 계정에 남기지 않고 이 기기에 기억한다 (모바일·데스크톱 같은 표시)
const KEY = 'phd-tutorial-done';
export function tutorialDone() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function markTutorialDone() {
  try { localStorage.setItem(KEY, '1'); } catch { /* 저장 못 해도 진행 */ }
}
