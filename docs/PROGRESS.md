# 진행 기록

새 세션은 이 파일부터 읽고 이어서 작업한다.

## 단계 현황
| 단계 | 상태 | 비고 |
|---|---|---|
| M0 기반 | **승인 완료 (2026-10-01)** | main에 합침 |
| M1 계정과 설정 | 다음 차례 | |

## 결정된 것 (기획자 승인)
- 프레임워크: Vite + React + TypeScript (react-router-dom)
- BaaS: Supabase — 프로젝트 ref `vvhpabbqiguuobpivdbf`
- 배포: Vercel (`gogomaker/PhD` 연결). 정식 주소 https://phd-ashy.vercel.app, 브랜치마다 미리보기 링크 생성
- 도메인: `phd.yong-yong.com` 연결 예정 (Vercel Domains). 연결 후 Supabase Auth의 Site URL / Redirect URLs에도 추가해야 함
- 모바일/데스크톱 경계: 768px

## 접속 정보
- 공개 값(URL, anon key)은 `.env.production`, `.env.development`에 있음 — 공개되어도 되는 값
- 비밀 값은 저장소에 두지 않는다. 세션 환경 변수로 받는다:
  - `SUPABASE_ACCESS_TOKEN` — Supabase CLI/관리 API (마이그레이션 적용)
  - `SUPABASE_DB_PASSWORD` — DB 비밀번호
- 세션 네트워크 허용 필요: `api.supabase.com`, `vvhpabbqiguuobpivdbf.supabase.co`, `*.vercel.app`

## 대안 (환경 설정이 안 될 때)
- DB 변경은 `supabase/migrations/*.sql`로 저장소에 올리고, 기획자가 Supabase SQL Editor에 붙여 넣어 실행
- DB 규칙(RLS, R-D2 지난 날 잠금)은 로컬 연습용 Postgres로 자동 테스트

## 다음 할 일 (M1)
- Supabase 연결, 가입 4단계·로그인·계정 관리, 카테고리(목표 ≤6 + 일상 1), 일상 키워드
- 테이블: profiles, categories, daily_keywords + 행 단위 권한(본인만)
- 체크리스트: SPEC 7장 M1
