// 가입 2단계 "지금 어떤 시기인가요?" — 고른 시기에 맞춰 카테고리를 추천한다 (목업 TYPES)
export const LIFE_STAGES = [
  { key: 'student', label: '대학생', desc: '학업과 진로를 함께 준비해요', cats: ['전공', '커리어', '어학', '대외활동'] },
  { key: 'examinee', label: '수험생', desc: '시험 하나에 집중하는 시기', cats: ['시험 과목', '컨디션', '생활 루틴'] },
  { key: 'worker', label: '직장인', desc: '일과 성장을 함께 챙겨요', cats: ['업무', '자기계발', '재정', '관계'] },
  { key: 'military', label: '군 복무 중', desc: '복무 기간을 성장의 시간으로', cats: ['군생활', '자기계발', '신앙', '전역 후'] },
  { key: 'other', label: '그 외', desc: '카테고리를 직접 정할게요', cats: ['가족', '재정', '관계'] },
] as const;

export type LifeStage = (typeof LIFE_STAGES)[number]['key'];

export const CATEGORY_POOL = ['건강', '커리어', '어학', '전공', '취미', '대외활동', '재정', '관계', '가족', '신앙', '자기계발', '업무', '군생활', '전역 후', '시험 과목', '컨디션', '생활 루틴'];

export function lifeStageOf(key: string | null | undefined) {
  return LIFE_STAGES.find(s => s.key === key) ?? LIFE_STAGES[LIFE_STAGES.length - 1];
}
