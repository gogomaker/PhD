// 가입 2단계 "지금 어떤 시기인가요?" — 고른 시기에 맞춰 카테고리를 추천한다 (목업 TYPES)
// template = 가입 3단계에 미리 골라 두는 카테고리 (2026-10-03 기획 결정).
// 바탕은 '삶의 수레바퀴(Wheel of Life, Paul J. Meyer)'의 삶의 영역 — 건강·일(학업)·재정·관계·성장·여가 — 을
// 시기에 맞는 이름으로 바꾸고 최대 6개(R-C1)로 줄인 것. 사용자가 빼거나 더할 수 있다
export const LIFE_STAGES = [
  { key: 'student', label: '대학생', desc: '학업과 진로를 함께 준비해요', cats: ['전공', '커리어', '어학', '대외활동'], template: ['전공', '커리어', '건강', '관계', '재정', '취미'] },
  { key: 'examinee', label: '수험생', desc: '시험 하나에 집중하는 시기', cats: ['시험 과목', '컨디션', '생활 루틴'], template: ['시험 과목', '컨디션', '생활 루틴', '관계'] },
  { key: 'worker', label: '직장인', desc: '일과 성장을 함께 챙겨요', cats: ['업무', '자기계발', '재정', '관계'], template: ['업무', '자기계발', '건강', '재정', '관계', '취미'] },
  { key: 'military', label: '군 복무 중', desc: '복무 기간을 성장의 시간으로', cats: ['군생활', '자기계발', '신앙', '전역 후'], template: ['군생활', '건강', '자기계발', '전역 후', '관계', '신앙'] },
  { key: 'other', label: '그 외', desc: '카테고리를 직접 정할게요', cats: ['가족', '재정', '관계'], template: ['건강', '일', '재정', '관계', '자기계발', '취미'] },
] as const;

export type LifeStage = (typeof LIFE_STAGES)[number]['key'];

export const CATEGORY_POOL = ['건강', '일', '커리어', '어학', '전공', '취미', '대외활동', '재정', '관계', '가족', '신앙', '자기계발', '업무', '군생활', '전역 후', '시험 과목', '컨디션', '생활 루틴'];

export function lifeStageOf(key: string | null | undefined) {
  return LIFE_STAGES.find(s => s.key === key) ?? LIFE_STAGES[LIFE_STAGES.length - 1];
}
