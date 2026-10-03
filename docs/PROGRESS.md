# 진행 기록

새 세션은 이 파일부터 읽고 이어서 작업한다.

## 단계 현황
| 단계 | 상태 | 비고 |
|---|---|---|
| M0 기반 | **승인 완료 (2026-10-01)** | main에 합침 |
| M1 계정과 설정 | **승인 (2026-10-01, 수정 2건 반영 후 M2로)** | main에 합침 |
| M2 목표 | **승인 완료 (2026-10-01)** | main에 합침 |
| M3 계획 표 | **승인 완료 (2026-10-01)** | main에 합침 |
| M4 모바일 하루 플래너 | **승인 완료 (2026-10-01, 수정 2건 반영)** | main에 합침 |
| M5 기록과 회고 | **승인 완료 (2026-10-01)** | main에 합침 |
| (추가) 다크 모드 | **승인 완료 (2026-10-01)** | main에 합침 |
| M6 빈 상태와 마무리 손질 | **승인 완료 (2026-10-01)** | main에 합침 (gogomaker/PhD#1) |
| MV 모바일 통합 | **검수 중 — 계획 탭 피드백 반영 (2026-10-03), 기록 탭 피드백 대기** | 브랜치 `claude/zealous-noether-nnc20w`. 계획·결정은 `docs/MOBILE.md` |

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
- (M6) 데이터 내보내기 = zip 하나에 CSV 7개(꿈·목표·계획표·할일·시간기록·하루기록·회고). 체크리스트 "모바일 첫 기록" = 할 일 체크 또는 실제 칠하기
- (MV) 모바일 통합: 폭 768px 미만은 새 모바일 앱(계획 + 기록), 넓은 화면은 데스크톱 그대로. 생김새는 목업 `PhD only for Mobile v2`, 기능은 기존. 시작하기는 목업의 5단계. 중간 보고 없이 끝까지 만든 뒤 한 번에 검수 (2026-10-02)
- (MV 추가) 앱 색을 차분한 뉴트럴 팔레트로: 아이보리(바탕)·차콜(글자)·어스 브라운(주 버튼, 기록)·슬레이트(보조, 계획)·포그 그레이(선). 다크도 같은 팔레트로 다시 맞춤, 로고·앱 아이콘 색도 바꿈 (2026-10-02)
- (MV 피드백 2026-10-03) 위에서 고르기 기본(R-P14), 한 칸 하나 유지 + 체험 모드에서 강조, 달·해를 넘는 계획은 자동으로 나눠 저장(R-P15), 체험 모드(저장 안 됨), 가입 템플릿(R-C5), 목표 편집 '작성 완료', 빈 칸 눌러 추가 없앰, 여러 기간 칸은 걸친 줄마다
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

## M6에서 만든 것
- 시작 체크리스트(`StartChecklist`): provider 데이터 + 체크한 할 일/실제 블록 수(창에 돌아올 때 다시 확인)
- 가장자리 그라데이션(`src/ui/ScrollArea.tsx`): `useScrollEdges` + `ScrollArea`(바깥은 안 넘치고 안쪽만 스크롤). 사이드바·꿈 보드 패널·마무리 팝업·모바일 시트에 적용. 계획 표(가로)와 모바일 할 일 목록은 원래 있던 것
- 계획 표 빈 상태(`NoColumns`): 목표 없음 / 모두 마무리 / 세부목표 없음 / 올릴 목표 있음 — 상황마다 버튼 하나 ("+ 목표 열 추가"는 메뉴를 연다)
- 내보내기(`src/lib/exportData.ts`, `src/lib/zip.ts`): 표마다 1000줄씩 나눠 읽음, 압축은 STORE(외부 라이브러리 없음), 엑셀 수식처럼 보이는 글은 앞에 작은따옴표
- E2E: 새 계정으로 가입부터 트래킹·내보내기까지 UI만으로 (scratchpad `e2e-m6.mjs`)

## MV(모바일 통합)에서 만든 것
- `src/mobile/MobileApp.tsx`: 앱바(계획/기록 전환) + 두 쪽(계획·기록, 처음 볼 때 그린다) + 오른쪽에서 밀려 들어오는 화면 층 + 시트 층(`#m-sheet-root`). 주소가 화면을 정한다(`src/mobile/routes.ts`): `/plan`, `/plan/schedule?z=&k=&f=`, `/record?d=`, `/record/review?r=&k=`, `/goal/:id`, `/categories`, `/dream`, `/settings`. 데스크톱 주소로 들어오면 맞는 모바일 주소로
- 시트(`src/mobile/ui.tsx` `Sheet`): 열 때 기록(history) 한 칸, 뒤로 가기로 닫힘. 기록 칸 번호(`history.state.idx`)로 쌓인 시트도 구분. 시트에서 다른 화면으로 갈 때는 `replace`
- 계획 › 목표(`plan/GoalsTab`), 일정(`plan/ScheduleTab`, 시트 `plan/planSheets`), 기록 › 오늘(`record/TodayTab` = 예전 `DayPlanner`), 돌아보기(`record/ReviewTab`), 화면(`pages/*`), 계정 시트(`AccountSheet`). 진척도·첫 기록 여부는 `store.tsx`
- 일정 시트는 DB 규칙 그대로: 칸은 기간·메모만 고침(목표·세부 목표 고정), 실천은 보기 + 지우기(지난 날 없을 때), 같은 목표 칸 겹침·지난 기간은 고르기에서 막음
- 로그인 전 휴대폰: 첫 화면(`Landing`) → 로그인·가입(맨 위 ‹ + 단계 막대). 데스크톱 로그인 화면은 그대로
- 휴대폰은 모바일 코드만, PC는 데스크톱 코드만 내려받는다(`lazy`)
- 밀려 들어오는 화면에 포커스가 가도 바깥이 옆으로 스크롤되지 않게 `.m-clip`(overflow: clip)
- 오늘 탭: 늦게 도착한 다시 읽기가 방금 칠한 시간표를 덮지 않게(`useDay`의 `noteEdit`) — 예전 하루 플래너에도 있던 드문 경합
- 색: `organic.css`(라이트)·`theme.css`(다크, 카테고리 색, `--score-fg-hi`), 로고(`Logo.tsx`)·아이콘(`public/icon-*.png`, scratchpad `mkicon.mjs`)·`theme-color`
- 일정 칸 계산 `src/mobile/plan/units.ts`(+ 단위 테스트): 칸 = 달/주/날, 시작·끝 → 묶음(해/달/주)마다 나누기, 같은 목표 칸 겹침. DB 구조는 그대로(나눠 저장이라)
- 체험 모드 `src/mobile/pages/TutorialPage.tsx`: 화면 안 상태만, 계정 저장 없음
- 기존 날짜 박힌 E2E(M3~M6)는 `run-reg.sh`의 시간대 바꾸기가 10.2 17시(UTC) 이후로는 '오늘=10.1'을 못 맞춰 더 못 돈다. 날짜를 상대로 바꾸기 전까지는 M1·M2·테마 + 모바일 E2E로 확인
- E2E: scratchpad `e2e-mv.mjs`(모바일 124개, 실행하는 날 기준 날짜), 기존 `e2e*.mjs`는 날짜가 박혀 있어 `run-reg.sh`가 사용자 시간대를 바꿔 '오늘'=10.1로 맞춰 돌림

## 남은 일 / 알려진 제약
- 이메일 변경: Supabase 기본 메일은 기획자 계정 이메일에만 보내져서 지금은 이메일을 읽기 전용으로 둠. 메일 서비스(SMTP) 붙일 때 같이 연다
- 비밀번호 찾기 메일도 같은 제약(기획자 본인 이메일로는 옴)
- 키워드 삭제 시 지난 기록에 쓰인 키워드 처리(R-D2와 충돌 여부)는 M4에서 정한다
- 계정 삭제는 모든 행을 지운다. M4에서 지난 날 잠금(R-D2)을 DB에 넣을 때 계정 삭제는 예외가 되게 해야 함
- 알람은 이 환경에서 실제 휴대폰으로 확인할 수 없다(기획자가 Android에서 확인). 서버 쪽 고르기·한 번만 보내기는 DB 테스트로 확인
- 회고 알림도 실제 휴대폰 확인은 기획자 몫(서버 고르기는 DB 테스트로 확인)
