// 손을 뗄 때 바로 시트·메뉴를 띄우면, 휴대폰이 그 뒤에 보내는 클릭 한 번이 새로 뜬 시트의 배경에 닿아 시트가 바로 닫힌다.
// 그 클릭 한 번만 먹는다. 클릭이 오지 않으면(끌기 등) 잠시 뒤 스스로 풀린다 (2026-10-03 UT 4차, 2026-10-06 시간표 톡)

/** 길게 누르기: 아직 손을 떼기 전 — 다음 손 뗌 뒤 오는 클릭을 먹는다 */
export function swallowNextClick() {
  const eat = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', eat, { capture: true, once: true });
  window.addEventListener('pointerup', () => window.setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 400), { once: true });
}

/** 이미 손을 뗀 뒤(pointerup 처리 중) — 곧 올 클릭 하나를 먹는다 */
export function swallowClickSoon(ms = 400) {
  const eat = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', eat, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', eat, { capture: true }), ms);
}
