/** 프로필 동그라미에 넣는 글자: 이름 끝 두 글자 (목업 규칙) */
export function initials(name: string) {
  return name.trim().slice(-2) || '?';
}
