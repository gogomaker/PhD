# 진행 기록

새 세션은 이 파일부터 읽고 이어서 작업한다.

## 단계 현황
| 단계 | 상태 | 비고 |
|---|---|---|
| M0 기반 | **승인 완료 (2026-10-01)** | main에 합침 |
| M1 계정과 설정 | **승인 (2026-10-01, 수정 2건 반영 후 M2로)** | 브랜치 `claude/zealous-noether-nnc20w` |
| M2 목표 | **승인 완료 (2026-10-01)** | 같은 브랜치 |
| M3 계획 표 | **승인 완료 (2026-10-01)** | 같은 브랜치 |
| M4 모바일 하루 플래너 | **승인 완료 (2026-10-01, 수정 2건 반영)** | 같은 브랜치 |
| M5 기록과 회고 | **승인 (2026-10-01, 다크 모드 추가 요청과 함께)** | 같은 브랜치 |
| (추가) 다크 모드 | **완료, M6과 함께 검수** | 같은 브랜치 |

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
- (M1 수정) 목표 카테고리 색은 순서대로 자동(일상 색 건너뜀). 일상 색만 직접 고름. 순서 바꾸기 = 색 바꾸기
- (M1 수정) 휴대폰도 로그인 화면. "로그인 상태 유지" 체크(기본 켬, 끄면 창 닫을 때 로그아웃, 기기 브라우저마다 기억)
- 휴대폰 검수: Vercel 미리보기 보호(Vercel Authentication)를 기획자가 끄기로 함
- (M2) 목표가 든 카테고리는 삭제 불가 (R-C4, DB 외래 키로도 막음)
- (M2) 목표를 적을 때 기한(연·월)도 바로 받는다
- (M3) 연간 표는 1~12월 달력 연도 + 앞뒤 해 이동
- (M3) 실천을 모두 지우면 목표는 다시 시작 전 (M4부터는 할 일 기록이 있으면 되돌리지 않음)
- 글꼴은 전부 Pretendard (npm `pretendard` 가변 글꼴을 앱에 포함, 제목 800). 목업의 Caprasimo·Figtree·Jua는 쓰지 않음
- (M4) 못 한 할 일은 끝낼 때까지 넘어감 (R-T5), 오늘·내일 직접 추가한 할 일은 길게 눌러 삭제 (R-T6)
- (M4 수정) 실천의 '속성(단발/반복)' 고르기 없앰: 요일 1개 = 단발(못 하면 넘어감), 2개 이상 = 고른 요일마다 반복 (DB 트리거로 강제). 모바일 '이번 주에서 담기' 없앰
- (M4 수정) 로고 = 펼친 노트 그림 + PhD (`src/ui/Logo.tsx`), 앱 아이콘도 같은 그림
- (M5) 마무리한 목표의 실천은 마무리한 다음 날부터 모바일 할 일로 안 나옴(넘어오던 일 포함)
- (M5) 회고 알림을 실제로 보냄 (그날 하루 기록을 안 썼을 때만, SPEC 4.9)
- (추가) 화면 테마 시스템 설정/라이트/다크, 기기마다 따로(localStorage `phd-theme`). 데스크톱 = 계정 관리, 휴대폰 = 앱바 톱니 → 설정 시트(테마 + 로그아웃). `index.html`이 첫 그림 전에 `<html data-theme>`을 정함, 카테고리 색은 CSS 변수(`--cat-<색>-bg/ink/dot`)
- (M3 수정) 지난 기간 계획은 무조건 잠금 (R-P12, DB 정책 + 화면). 한 주 시작은 일요일 고정 (R-P13, 계정 설정에서 뺌)

## 접속 정보
- 공개 값(URL, anon key)은 `.env.production`, `.env.development`에 있음 — 공개되어도 되는 값
- 비밀 값은 저장소에 두지 않는다. 세션 환경 변수로 받는다:
  - `SUPABASE_ACCESS_TOKEN` — Supabase 관리 API (마이그레이션 적용, DB 테스트)
  - `SUPABASE_DB_PASSWORD` — DB 비밀번호
- 세션 네트워크 허용 필요: `api.supabase.com`, `vvhpabbqiguuobpivdbf.supabase.co`, `*.vercel.app`

## DB 작업 방법
- 마이그레이션: `supabase/migrations/*.sql` 에 파일을 추가하고 `scripts/db.sh <파일>` 로 적용 (관리 API 사용, CLI 없음)
  - 적용 완료: `20261001000001_m1_accounts.sql`, `20261001000002_m1_color_by_order.sql`, `20261001000003_m2_goals.sql`, `20261001000004_m3_plans.sql`, `20261001000005_m3_lock_past.sql`, `20261001000006_m4_day.sql`, `20261001000007_m4_alarms.sql`, `20261001000008_practice_kind_auto.sql`, `20261001000009_m5_records.sql`
- DB 테스트: `supabase/tests/m1_accounts.sql`, `m2_goals.sql`, `m3_plans.sql`, `m4_day.sql`, `m5_records.sql`
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

## M2에서 만든 것
- 테이블: `goals`(기한 필수, 상태는 서버만 바꿈), `subgoals` + 행 단위 권한
- DB 규칙: 목표는 본인 목표 카테고리에만(R-C2, R-C3), 시작 전 목표만 삭제(R-G4, R-G5), 마무리한 목표·그 세부목표는 수정·삭제 불가(R-G7), 목표가 든 카테고리 삭제 불가(R-C4)
- 화면: 꿈 작성, 목표 설정(되고 싶은 모습, 목표 빠르게 적기 = 이름+기한), 꿈 보드(카드), 편집 패널(목표명·카테고리·기한·세부목표 끌어서 순서·접힌 특성·삭제/마무리)
- 함수: `reorder_subgoals`, `reorder_goals`(아직 화면에서 안 씀)
- "목표 마무리하기" 버튼은 자리만 있고, 눌러도 안내만 뜸 (마무리 팝업은 M5)
- 진행 중 상태는 M3에서 주간 표에 실천을 처음 놓을 때 바뀐다(R-G3). 그 전엔 테스트에서 DB로 바꿔 확인

## M3에서 만든 것
- 테이블: `year_cells`(월 범위), `month_cells`(그 달의 주 번호 범위), `notes`(월간·주간 참고사항), `practices`(주 첫날 + ISO 요일 1=월…7=일), goals에 `table_position`·`table_hidden`(기본 숨김 → "+ 목표 열"로 올림)
- DB 규칙: 한 열 안 칸 겹침 금지(배제 제약, R-P1), 칸의 세부목표는 그 목표 것만, 배치된 세부목표 삭제 불가(외래 키, R-G9), 실천 추가/전부 삭제 시 상태 자동 변경(R-G3), 마무리한 목표엔 계획 쓰기 불가
- 주 계산(`src/lib/plan.ts`, DB `month_week_start`): 일요일 시작, 두 달에 걸친 주는 그 주 수요일이 있는 달의 주. 월간 표 행 = 그 달의 주
- 잠금(`plan_locked`, `user_today`): 연간=지난달, 월간·월 참고사항=지난주, 주 참고사항·실천=지난 날. 화면은 빗금 칸 + "지난 기간은 수정할 수 없어요" 안내
- DB 테스트(m3_plans.sql)는 "오늘" 기준 상대 날짜로 계산해서 날짜가 지나도 돌아감
- 화면: `/plan/year?y=`, `/plan/month?m=YYYY-MM`, `/plan/week?w=YYYY-MM-DD` (주소에 기간이 남아 새로고침해도 그대로)
- 실천 화면 위치: 요일 1개 → 그 요일 칸, 2개 이상 → 이번 주 줄 (R-P8). 칸에 실천이 있으면 마우스를 올렸을 때 "+ 실천" 버튼
- 꿈 보드 패널: 배치된 세부목표에 "계획 표에 배치됨", 삭제 버튼 꺼짐 (R-G9)

## M4에서 만든 것
- 테이블: `tasks`(할 일), `time_blocks`(10분 시간표, 계획/실제 층), `day_journals`(하루 기록), `push_subscriptions`(알림 받을 기기). `daily_keywords.archived`(지우면 보관 — 지난 기록이 가리키므로)
- 할 일 계산(`src/lib/today.ts`): 반복·자동 배정은 주간 표 실천에서 계산, 행은 체크·칠하기·이름 붙이기 때 만든다(`ensureRow`). 넘어온 일은 `carried_from_date`(+ 직접 추가는 `carried_task_id`)로 그날 행을 만든다
- 날짜 권한(R-D2, 4.4)은 DB 정책: 할 일 추가·삭제 = 오늘·내일, 체크 = 오늘, 계획 블록 = 오늘·내일, 실제 칠하기·하루 기록 = 오늘. 시간표는 `save_day_blocks(날짜, 층, 블록들)`로 그날 한 층을 통째로 바꾼다
- R-D1: `user_day_at(사용자, 시각)` / `user_today()`. 새벽(하루 시작 전) 예약은 달력으로 다음 날 울린다(`task_alarm_at`)
- 알람(R-T3): 서비스 워커 `public/sw.js`, 설치 정보 `public/manifest.webmanifest`, 아이콘 192/512. 예약 할 일을 추가할 때 알림 허락을 받고 기기를 저장. pg_cron이 1분마다 Edge Function `send-alarms`를 부르고, 그 함수가 `claim_due_alarms()`로 시각이 된 것을 골라 웹 푸시로 보낸다
  - VAPID 공개 키는 `.env.*`의 `VITE_VAPID_PUBLIC_KEY`, 비밀 키는 Supabase Edge Function 비밀값(`VAPID_PRIVATE_KEY`)에만. 함수 배포: `npx supabase functions deploy send-alarms --project-ref vvhpabbqiguuobpivdbf --use-api`
- 모바일 시간표 저장은 순서대로(큐), 성공하면 다시 읽지 않는다(화면 상태가 기준)

## M5에서 만든 것
- DB: goals에 마무리 칸(`finished_at`, `finish_photo_path`, `retro_*`), `finish_goal()`(진행 중만, 사진은 완성 + 본인 폴더만, 상태는 이 함수만 바꿈), `goal_progress`(바꿀 때마다 한 줄, 열린 목표만), 저장소 버킷 `goal-photos`(비공개, 5MB, 본인 폴더만)
- 집계: `tracking_summary(시작, 끝)` → 계획·실제·목표에 안 붙은 계획·목표별(10분 칸 수), `goal_totals()` → 목표별 누적 칸·완료한 할 일 수·처음 기록한 날
- 회고 알림: `claim_due_reviews()`(정한 시각부터 15분 안, 그날 기록 없음, 하루 한 번) — 같은 Edge Function `send-alarms`가 1분마다 보냄
- 화면: `/tracking?r=week|month&k=`(숫자 3개, 목표별 계획 대비 실제, 진척도 슬라이더, 하루 점수 달력, 누적 시간), `/reviews`(카드, 필터), 꿈 보드 패널의 마무리 팝업(`WrapDialog`)
- 사진은 브라우저에서 긴 변 1600px JPEG로 줄여서 올림. 계정 삭제 때 사진 먼저 지움
- 모바일: `computeDay`에 마무리한 목표 → 마무리한 날 지도를 넘겨서 다음 날부터 뺌

## 남은 일 / 알려진 제약
- 이메일 변경: Supabase 기본 메일은 기획자 계정 이메일에만 보내져서 지금은 이메일을 읽기 전용으로 둠. 메일 서비스(SMTP) 붙일 때 같이 연다
- 비밀번호 찾기 메일도 같은 제약(기획자 본인 이메일로는 옴)
- 데이터 내보내기 버튼은 M6에서 (지금은 꺼져 있음)
- 키워드 삭제 시 지난 기록에 쓰인 키워드 처리(R-D2와 충돌 여부)는 M4에서 정한다
- 계정 삭제는 모든 행을 지운다. M4에서 지난 날 잠금(R-D2)을 DB에 넣을 때 계정 삭제는 예외가 되게 해야 함
- 알람은 이 환경에서 실제 휴대폰으로 확인할 수 없다(기획자가 Android에서 확인). 서버 쪽 고르기·한 번만 보내기는 DB 테스트로 확인
- 회고 알림도 실제 휴대폰 확인은 기획자 몫(서버 고르기는 DB 테스트로 확인)
- 마무리한 목표만 남으면 주간 표 빈 상태 문구가 "세부목표를 만든 목표만…"으로 나옴 — M6 빈 상태 손질 때 같이
