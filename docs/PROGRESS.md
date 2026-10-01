# 진행 기록

새 세션은 이 파일부터 읽고 이어서 작업한다.

## 단계 현황
| 단계 | 상태 | 비고 |
|---|---|---|
| M0 기반 | **승인 완료 (2026-10-01)** | main에 합침 |
| M1 계정과 설정 | **검수 대기** | 브랜치 `claude/zealous-noether-nnc20w` |
| M2 목표 | 다음 차례 | |

## 결정된 것 (기획자 승인)
- 프레임워크: Vite + React + TypeScript (react-router-dom)
- BaaS: Supabase — 프로젝트 ref `vvhpabbqiguuobpivdbf`
- 배포: Vercel (`gogomaker/PhD` 연결). 정식 주소 https://phd-ashy.vercel.app, 브랜치마다 미리보기 링크 생성
  - 브랜치 고정 미리보기: `https://phd-git-<브랜치이름의 /를 ->-gogomaker.vercel.app`
- 도메인: `phd.yong-yong.com` 연결 예정 (Vercel Domains). Supabase Auth Redirect URLs에는 이미 넣어 둠
- 모바일/데스크톱 경계: 768px
- (M1) 로그인은 이메일+비밀번호만. Google은 나중에
- (M1) 가입 시 이메일 인증 없음 (Supabase `mailer_autoconfirm = true`)
- (M1) 가입 3단계 목표 카테고리 최소 1개

## 접속 정보
- 공개 값(URL, anon key)은 `.env.production`, `.env.development`에 있음 — 공개되어도 되는 값
- 비밀 값은 저장소에 두지 않는다. 세션 환경 변수로 받는다:
  - `SUPABASE_ACCESS_TOKEN` — Supabase 관리 API (마이그레이션 적용, DB 테스트)
  - `SUPABASE_DB_PASSWORD` — DB 비밀번호
- 세션 네트워크 허용 필요: `api.supabase.com`, `vvhpabbqiguuobpivdbf.supabase.co`, `*.vercel.app`

## DB 작업 방법
- 마이그레이션: `supabase/migrations/*.sql` 에 파일을 추가하고 `scripts/db.sh <파일>` 로 적용 (관리 API 사용, CLI 없음)
  - 적용 완료: `20261001000001_m1_accounts.sql`
- DB 규칙 테스트: `scripts/db.sh supabase/tests/m1_accounts.sql` → `M1 DB 테스트 통과`. 한 트랜잭션 안에서 가짜 사용자 2명으로 돌리고 되돌림(흔적 없음)
- Auth 설정(관리 API `config/auth`로 바꿈): site_url = https://phd-ashy.vercel.app, 비밀번호 8자 이상, 이메일 인증 끔,
  Redirect URLs = phd-ashy / `phd-*-gogomaker.vercel.app` / phd.yong-yong.com / localhost:5173

## E2E 확인 방법 (이 환경에서)
- `npx vite --port 5173` 띄운 뒤 playwright-core로 `/opt/pw-browsers/chromium` 실행
- 프록시 인증서: `--ignore-certificate-errors-spki-list=<agent-proxy-ca의 SPKI sha256>` 를 크롬 인자로 줘야 supabase.co에 붙는다
- 테스트로 만든 계정은 끝에 앱의 "계정 삭제"로 지운다

## M1에서 만든 것
- 테이블: `profiles`, `categories`, `daily_keywords` + 행 단위 권한(본인만), 열 단위 수정 권한
- 가입 시 자동 생성(트리거): 프로필, 일상 카테고리(보라), 키워드 4개(업무·생활·이동·휴식)
- 함수: `complete_onboarding`(가입 2~4단계 한 번에 저장), `reorder_categories`, `delete_my_account`
- 규칙을 DB에서도 막음: 목표 카테고리 ≤6, 색 중복 금지, 일상 카테고리 1개·삭제 불가, 종류(kind) 변경 불가 (R-C1)
- 화면: 로그인, 가입 4단계, 비밀번호 찾기/재설정, 인생 카테고리, 계정 관리, 사이드바 꿈·이름 카드
- 모바일 하루 플래너가 계정의 하루 시작 시각·시간대를 씀 (R-D1)

## 남은 일 / 알려진 제약
- 이메일 변경: Supabase 기본 메일은 기획자 계정 이메일에만 보내져서 지금은 이메일을 읽기 전용으로 둠. 메일 서비스(SMTP) 붙일 때 같이 연다
- 비밀번호 찾기 메일도 같은 제약(기획자 본인 이메일로는 옴)
- 데이터 내보내기 버튼은 M6에서 (지금은 꺼져 있음)
- 회고 알림 켜기/시각은 저장만 됨. 실제 알림은 PWA 작업(M4) 이후
- 목표가 들어 있는 카테고리 삭제 규칙은 M2에서 정한다 (지금은 목표가 없음)
- 키워드 삭제 시 지난 기록에 쓰인 키워드 처리(R-D2와 충돌 여부)는 M4에서 정한다
- 계정 삭제는 모든 행을 지운다. M4에서 지난 날 잠금(R-D2)을 DB에 넣을 때 계정 삭제는 예외가 되게 해야 함
