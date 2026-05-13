shared-docs — 프로젝트 지침서
> Claude Code와 함께 이어가기 위한 컨텍스트 및 작업 가이드
> 최근 업데이트: 2026-05-13 (디자인 시스템 + 정산/반복/차트 + 캘린더 통합 + 코드 분할 작업 후)

***프로젝트 개요
진과 채연 두 사람을 위한 비공개 웹앱. 가이드 문서 + 데이터 트래킹(구매 내역, 공동 할 일, 기념일) + 캘린더가 한곳에 모인다.
배포: Vercel(프론트엔드) + Cloudflare Tunnel → 맥미니 Docker(백엔드 + MariaDB)
스택: Vite + React 19 + TypeScript (프론트), Spring Boot + Kotlin (백엔드, 별도 레포 `shared-docs-backend`)
접근 제어: Google OAuth2 + 이메일 화이트리스트(현재 2명) + JWT
중요: 모든 UI 텍스트는 한국어.

***상위 폴더 구조
```
shared-docs-root/
├── shared-docs/           ← 이 레포 (프론트엔드)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
└── shared-docs-backend/   ← 별도 레포 (Spring Boot, 자체 GitHub Actions 배포)
    └── docs/
        ├── AUTH_BLUEPRINT.md      ← Google OAuth + JWT 설계
        └── SCALING_BLUEPRINT.md   ← MDX, 모바일, 데이터 피처 로드맵 + 구현 로그
```

***src/ 폴더 구조 (현재)
```
src/
├── api/                            ← axios 클라이언트 + 공유 QueryClient
│   ├── client.ts                   ← Bearer 토큰 인터셉터, 401→/login 리다이렉트
│   ├── queryClient.ts
│   ├── comments.ts                 ← 댓글 API + TanStack 훅
│   └── admin.ts                    ← 관리자 API
├── auth/                           ← 인증: 3개 파일로 분리됨 (Fast Refresh 호환)
│   ├── authContext.ts              ← AuthContext + Role/AuthUser/AuthContextValue 타입
│   ├── AuthProvider.tsx            ← Provider 컴포넌트만 (jwt-decode, localStorage 동기화)
│   ├── useAuth.ts                  ← useAuth 훅
│   ├── RequireAuth.tsx             ← 미로그인 → /login
│   ├── RequireRole.tsx             ← role 불일치 → <Forbidden />
│   └── tokenStorage.ts
├── components/
│   ├── ui/                         ← ★ 공유 디자인 시스템 (CSS Modules + tokens.css)
│   │   ├── tokens.css              ← 색상/간격/반경/그림자/모션 CSS 변수
│   │   ├── Page.tsx                ← Page / PageHeader / PageTitle
│   │   ├── BackLink.tsx
│   │   ├── Card.tsx                ← padding="sm|md|lg|none"
│   │   ├── Stack.tsx               ← Stack(세로) / Row(가로) — gap/align/justify/wrap
│   │   ├── Field.tsx               ← Field / Label / Hint / ErrorText
│   │   ├── Input.tsx               ← align="right" / size="sm" / invalid
│   │   ├── Select.tsx              ← 커스텀 chevron 아이콘
│   │   ├── Textarea.tsx
│   │   ├── Button.tsx              ← variant: primary | ghost | outline | soft | danger
│   │   ├── IconButton.tsx          ← variant: ghost | outline | danger (label 필수)
│   │   ├── Badge.tsx               ← 카테고리 pill (hexWithAlpha로 색 틴트)
│   │   ├── Kbd.tsx                 ← 키보드 힌트 칩
│   │   ├── Modal.tsx               ← 백드롭+Esc+스크롤 락+반응형 (모바일 sheet / 데스크톱 카드)
│   │   ├── Tabs.tsx                ← TabItem<K> 제네릭 세그먼티드
│   │   ├── Checkbox.tsx            ← SVG 체크, 포커스 링
│   │   ├── Fab.tsx                 ← 고정 + 버튼 (3개 리스트 페이지 공통)
│   │   ├── Section.tsx             ← h2 라벨 + 슬롯
│   │   └── index.ts                ← barrel
│   ├── common/                     ← 반응형 레이아웃 프리미티브
│   │   ├── MobileTable.tsx         ← 모바일=카드, 데스크톱=테이블
│   │   ├── MobileShell.tsx         ← 바텀 네비를 위한 레이아웃 래퍼
│   │   └── BottomNav.tsx           ← 모바일 전용 고정 바텀 네비
│   ├── Comments.tsx                ← 댓글 리스트 + 폼 (Google 프로필)
│   ├── CommentsFab.tsx             ← 우하단 💬 → 슬라이드인 드로어
│   ├── DocLayout.tsx               ← MDX 문서용 공통 래퍼
│   └── FloatingToc.tsx             ← 우측 고정 TOC
├── content/                        ← MDX 콘텐츠 레지스트리 (스캐폴드만; 실내용은 레거시 .tsx)
├── features/                       ← 데이터 피처별 1폴더 = 1피처
│   ├── purchases/                  ← 💰 구매 내역 (지금 가장 두꺼움)
│   │   ├── api.ts                  ← Purchase 타입 + SplitMode 상수 + lib/format 재수출
│   │   ├── PurchaseList.tsx        ← 페이지 (월/카테고리 필터, ?date ?month ?edit ?row URL 파라미터)
│   │   ├── PurchaseGrid.tsx        ← 데스크톱 인라인 편집 그리드 (react-data-grid v7)
│   │   ├── PurchaseForm.tsx        ← 모바일/추가 모달 (wrapper + keyed inner 패턴)
│   │   ├── settlement.ts           ← 순수 정산 계산기 (purchases + settlement records)
│   │   ├── SettlementCard.tsx      ← "정산 완료" 버튼 + 이 달 기록 + 취소
│   │   ├── settlementApi.ts        ← /api/settlements 훅
│   │   ├── CategoryChart.tsx       ← 수제 SVG 도넛 + 슬라이스 클릭 → 필터링
│   │   ├── RecurringPurchasesModal.tsx ← 반복 항목 관리 (Modal)
│   │   ├── recurringApi.ts         ← /api/recurring-purchases 훅
│   │   └── purchases.css           ← 그리드/도넛/정산/반복 등 잔여 CSS
│   ├── todos/                      ← ✅ 공동 할 일
│   ├── anniversaries/              ← 🎉 기념일
│   └── calendar/                   ← 📅 캘린더 (집계 전용, 자체 엔티티 없음)
├── lib/                            ← 공유 유틸
│   ├── format.ts                   ← formatMoney / todayString / currentMonthString / monthBounds / formatShortDate / formatMonthLabel
│   ├── color.ts                    ← hexWithAlpha
│   └── useMediaQuery.ts            ← useSyncExternalStore 기반, useIsDesktop / useIsMobile
├── pages/
│   ├── Hub.tsx                     ← 메인 가이드북 카드 허브 (+ 관리자용 "관리" 칩)
│   ├── DataHub.tsx                 ← /data 인덱스
│   ├── CalendarPage.tsx            ← /calendar (커스텀 DayButton + 4가지 이벤트 타입 점)
│   ├── Admin.tsx                   ← /admin (lazy)
│   ├── Doc.tsx                     ← /doc/:id MDX 렌더러 (lazy)
│   ├── Login.tsx                   ← Google 로그인 버튼
│   ├── AuthCallback.tsx
│   ├── Forbidden.tsx               ← 403
│   ├── NotFound.tsx                ← 404
│   ├── Honeymoon.tsx / Cleaning.tsx / Stock.tsx ← 레거시 가이드 (lazy)
└── App.tsx                         ← 라우팅 + React.lazy + Suspense 폴백
```

***라우트 매핑
| 경로 | 페이지 | 보호 | 코드 분할 |
|---|---|---|---|
| `/login`, `/auth/callback` | Login / AuthCallback | public | eager |
| `/` | Hub | authed | eager |
| `/data` | DataHub | authed | eager |
| `/data/purchases` | PurchaseList | authed | **lazy** |
| `/data/todos` | TodoList | authed | **lazy** |
| `/data/anniversaries` | AnniversaryList | authed | **lazy** |
| `/calendar` | CalendarPage | authed | **lazy** |
| `/admin` | Admin | ADMIN only | **lazy** |
| `/honeymoon`, `/cleaning`, `/stock` | 레거시 가이드 | authed | **lazy** |
| `/doc/*` | Doc (MDX) | authed | **lazy** |
| `*` | NotFound | — | eager |

PurchaseList는 다음 URL 쿼리 파라미터를 인식한다:
- `?month=YYYY-MM` — 월 필터를 설정 (소스 오브 트루스가 URL이라 캘린더에서 진입 시 자연스러움)
- `?date=YYYY-MM-DD` — 추가 모달을 그 날짜로 미리 채워 자동 오픈
- `?edit=N` — 해당 id의 행을 편집 모달로 자동 오픈
- `?row=N` — 그리드의 해당 행으로 스크롤 + 1.8초 펄스 강조

TodoList / AnniversaryList도 `?date=YYYY-MM-DD`를 받아 폼을 미리 채운다.

***공유 디자인 시스템 (`src/components/ui/`)
- 모든 새 코드는 **`src/components/ui`**에서 import하여 사용한다. 인라인 CSS 클래스를 더 만들지 말 것.
- 스타일링: **CSS Modules** (`*.module.css`) — 각 컴포넌트 옆에 위치. 글로벌 `tokens.css`에 정의된 변수 사용.
- 토큰은 `tokens.css`에 정의: `--c-primary`, `--c-text`, `--sp-1..9`, `--r-sm/md/lg/pill`, `--shadow-*`, `--t-fast` 등.
- 폼 빌딩 블록 표준 패턴:
  ```tsx
  <Field>
    <Label htmlFor="x">제목</Label>
    <Input id="x" ... />
  </Field>
  ```
- 모달은 `<Modal open onClose title footer>`로 감싸고, body 안에 `<form id="..." onSubmit=...>`을 두며, footer의 submit 버튼은 `type="submit" form="..."`으로 연결한다.
- "wrapper + keyed inner" 패턴(폼): 외부에서 `<Form initial={...}>`을 받으면 wrapper가 `key={initial?.id ?? 'new'}`로 inner를 리마운트해 lazy `useState`로 초기값을 잡는다. set-state-in-effect 안티패턴을 피하는 방식.

***현재 완성된 데이터 피처
✅ 구매 내역 (`/data/purchases`)
- 월 선택 + 카테고리 필터 + 통화별 합계
- 항목 / 상점 / 금액 + 통화 (BigDecimal, ISO 4217) / 카테고리 / **나눔 (SplitMode: SHARED · MINE · THEIRS)** / 메모
- 데스크톱: react-data-grid 인라인 편집 (셀 더블클릭 / Tab / Ctrl+C·V), 인라인-after-클릭 추가 흐름
  - "+ 항목 추가" 클릭 → draft 행 등장 + 품목 셀로 자동 포커스 → ⌘/Ctrl+Enter 저장, Esc 취소
- 모바일: MobileTable + 우하단 Fab + 모달 시트
- 카테고리 시드: 식비 🍱 / 교통 🚌 / 주거 🏠 / 의료 🩺 / 여가 🎬 / 의류 👕 / 기타 📦
- 정산 (Settlement):
  - 백엔드 `Settlement` 엔티티 + `/api/settlements?yearMonth=YYYY-MM`
  - 프론트 `settlement.ts` 순수 계산기: SHARED는 가구원 수만큼 분할, MINE은 본인만 부담, THEIRS는 타인 분할
  - `SettlementCard`: 통화별 "X → Y ₩Z" + 정산 완료 버튼 + 이 달 정산 기록 + 취소 버튼
- 카테고리 차트:
  - `CategoryChart`: KRW 한정 수제 SVG 도넛 (외경 70 / 내경 46) + 클릭 가능한 slice → 카테고리 필터 토글
  - 우측 레전드: 색 스와치 + 이모지 + 이름 + % + 금액 (모두 클릭 가능)
- 반복 항목 (Recurring):
  - `RecurringPurchase` 엔티티 + `/api/recurring-purchases`
  - 매월 `dayOfMonth` (1-28)에 자동 생성. `PurchaseService.list()` 호출 시 `RecurringPurchaseService.catchUp()`이 idempotent하게 누락 월을 채움 (별도 스케줄러 X).
  - `RecurringPurchasesModal`: 인라인 add/edit 폼 + 토글/편집/삭제 액션

✅ 공동 할 일 (`/data/todos`)
- 필터: 오늘 / 이번 주 / 전체 / 완료됨 (`Tabs` 프리미티브)
- 둘 중 누구든 완료 토글 가능; 누가 완료했는지 자동 기록
- 카테고리 시드: 집안일 🧹 / 쇼핑 🛒 / 일정 📅 / 공사 🔨 / 기타 📦

✅ 기념일 (`/data/anniversaries`)
- "다가오는 30일" 섹션이 자동으로 위로 (`Section` 프리미티브)
- 매년 반복 체크박스; N주년 배지 자동 계산
- 카테고리 시드: 기념일 🎉 / 생일 🎂 / 가족 👨‍👩‍👧 / 친구 🤝 / 기타 📦

✅ 캘린더 (`/calendar`)
- 백엔드 `/api/calendar/events?from&to`가 **4가지 소스**를 합쳐서 반환:
  - 기념일 (반복 적용) — 호박색 점 #d97706
  - 마감 있는 OPEN 할 일 — 네이비 점 #1b3a5c
  - 그 기간의 모든 구매 — 초록 점 #16a34a
  - 그 기간에 기록된 정산 — 보라 점 #9333ea
- 커스텀 DayButton이 날짜 숫자 아래 색 점을 가로로 나열 (최대 4개)
- 레전드: 픽커 아래에 4가지 색의 의미 표시
- **오늘** 버튼: 페이지 헤더 우측. 클릭 → 현재 달로 이동 + 오늘 선택
- 이벤트 클릭 → 해당 피처로 네비게이트 (purchase는 `?row=N`까지 포함해 그리드에서 스크롤 + 펄스)
- "이 날에 추가" 액션 바: 선택한 날짜 기준 [구매 추가] [할 일 추가] [기념일 추가] — 각 피처에 `?date=YYYY-MM-DD`로 진입

***아직 안 한 것 (블루프린트 §10 후속, 우선순위 순)
🚧 1. 유용한 링크 컬렉션 (`/data/links`) — DataHub 카드는 있지만 todo 상태
🚧 2. 레시피 컬렉션 (`/data/recipes`) — 드래그 앤 드롭 프리미티브 필요 (@dnd-kit)
🚧 3. 카테고리 관리 UI — 각 피처의 "관리" 탭. 백엔드 API는 admin-only로 존재; 지금은 curl만 가능.
🚧 4. 전역 헤더 + 아바타 드롭다운 + 로그아웃 — 지금은 Hub 우상단 "관리" 칩만 있음
🚧 5. MDX 콘텐츠 이주 — Honeymoon/Cleaning/Stock의 실제 내용은 아직 레거시 .tsx에 그대로
🚧 6. 폴더 뷰 (Finder 스타일) — 문서 수가 적어 보류
🚧 7. UI 폴리시 후속:
       - 통합 헤더 컴포넌트 (전체 페이지 톤 일관화)
       - 카테고리 차트 → 모바일에서도 잘 보이는 가로 막대 폴백
       - 정산 기록 모바일 줄바꿈 / 회전 정렬 다듬기

***데이터 피처 확장 패턴
새 데이터 피처를 추가할 때 기존 4개(purchases/todos/anniversaries/calendar)와 똑같이:
1. 백엔드: `com.shareddocs.backend.<feature>/` 패키지에 Entity, Repository, Service, Controller, Dto, (선택) Category + CategoryBootstrapper
2. 프론트: `src/features/<feature>/` 폴더에 `api.ts` + `<Feature>List.tsx` + `<Feature>Form.tsx` (+ 필요 시 grid/modal 추가)
3. 폼은 `Modal` + `Field/Input/Select/Textarea/Button` 조합으로 구성. wrapper + keyed inner 패턴 사용
4. 리스트 페이지는 `Page/PageHeader/PageTitle/BackLink` 사용, FAB은 `Fab` 프리미티브
5. `src/pages/DataHub.tsx`에서 해당 카드의 status를 `'todo'` → `'done'`으로 변경
6. `src/App.tsx`에 라우트 추가 — **`React.lazy`로 분할**할 것 (`const X = lazy(() => import('./features/x/XList'))`)

권한 규칙(공통):
- 읽기: 인증된 모든 사용자 (공유 데이터)
- 수정: 작성자만
- 삭제: 작성자 + 관리자
- 카테고리 관리: 관리자만
- 백엔드 `me.role` / `me.userId`로 강제

***스타일 규칙
- 모든 텍스트는 한국어
- 폰트: Noto Sans KR (본문), Noto Serif KR (제목/타이틀, 큰 합계 숫자)
- **컬러는 모두 `tokens.css`의 CSS 변수 사용** — 하드코딩 hex 금지 (예외: 캘린더의 4가지 이벤트 dot 색 — `EVENT_META`에 모여 있음)
- 모바일 우선: 최소 44×44px 터치 타겟, 바텀 네비 56px + safe-area-inset-bottom
- 클래스 명명: 새 컴포넌트는 CSS Modules로 스코프됨. 기존 feature CSS는 BEM-스러운 `.purchase__row--highlight` 그대로 둠
- 빈 상태/플레이스홀더 텍스트는 `var(--c-text-placeholder)` 또는 `var(--c-text-subtle)`

***새 문서(MDX) 추가 절차
1. `src/content/<id>.mdx` 파일 작성 (블루프린트 §3의 `meta` 블록 형식)
2. 인터랙티브 위젯이 필요하면 `src/content/_components/`에 작성하고 MDX에서 import
3. Hub는 레지스트리를 통해 자동 노출됨 (App.tsx 수정 불필요; `/doc/<id>`로 접근 가능)

> 현재 Hub는 하드코딩된 `guides[]` 배열을 쓰고 있고 MDX 레지스트리와 병행 중. 레거시 카드가 모두 정리되면 Hub도 레지스트리 단일 소스로 전환.

***인증 흐름 (요약)
1. 사용자가 `/`로 진입 → `RequireAuth`가 localStorage 토큰 없음 감지 → `/login`으로 리다이렉트
2. "Google로 로그인" 클릭 → `${VITE_API_BASE_URL}/oauth2/authorization/google`로 이동
3. Google 동의 → 백엔드 `/login/oauth2/code/google`로 콜백
4. 백엔드 OAuth2SuccessHandler가 allowlist 검사 → users 행 upsert → JWT 발급 → `${FRONTEND_URL}/auth/callback#token=<jwt>`로 302
5. `AuthCallback`이 fragment에서 토큰 추출 → localStorage 저장 → `/`로 navigate
6. 이후 모든 `/api/**` 요청에 `Authorization: Bearer <jwt>` 자동 첨부 (axios 인터셉터)

> 인증 모듈은 3개 파일로 분리: `authContext.ts` (context + 타입) / `AuthProvider.tsx` (컴포넌트) / `useAuth.ts` (훅). Fast Refresh 호환성 + 미래 확장을 위함.

***성능 메모
- 초기 번들 ≈ 202 kB / 65 kB gzip (이전 743 kB / 201 kB에서 -73% / -68%)
- 모든 무거운 라우트는 `React.lazy`로 분할됨. 새 페이지 추가 시 동일 패턴 유지
- 가장 큰 청크: PurchaseList (73 kB — react-data-grid + 정산/차트/반복 포함), CalendarPage (78 kB — react-day-picker)
- 레거시 가이드 (Honeymoon 111 kB / Cleaning 73 kB / Stock 55 kB)도 lazy. MDX 이주 후 더 줄어들 것

***백엔드 운영 메모
- 자체 호스팅 GitHub Actions 러너가 맥미니에서 동작 (`~/actions-runner-shared-docs/`, launchd 서비스)
- `main` 푸시 → `./gradlew bootJar` → Docker 이미지 빌드 → `docker compose up -d --force-recreate` → `/actuator/health` 확인
- Docker 컨테이너는 모두 `restart: unless-stopped` (재부팅 시 자동 시작)
- MariaDB는 `lunch-select-db` 컨테이너를 공유 (3307 호스트 포트, `shared_docs` DB)
- 환경변수는 GitHub Secrets → docker-compose env로 주입; 추적 파일에는 placeholder만
- **스키마 마이그레이션**: `ddl-auto: update`. 새 엔티티 추가 / nullable 컬럼 추가는 무중단 자동 적용. NOT NULL 컬럼은 반드시 `columnDefinition`에 `DEFAULT` 명시 (`Purchase.splitMode`, `RecurringPurchase.splitMode` 참고).
- 순환 의존 회피: `PurchaseService`가 `RecurringPurchaseService`를 `@Lazy`로 주입 (purchase → recurring → purchase 사이클 방지)

***백엔드 새 패키지 (2026-05-13 기준)
```
com.shareddocs.backend/
├── purchase/        ← Purchase + SplitMode + Category
├── settlement/      ← Settlement (정산 기록)
├── recurring/       ← RecurringPurchase (반복 항목 템플릿 + catch-up 생성기)
├── anniversary/, todo/, calendar/, comment/, user/, admin/, auth/, config/
```

***메모
- index.html / vite.config.ts / public/manifest.json — 건드릴 일 거의 없음
- public/ 폴더는 빌드 시 dist/로 그대로 복사됨 (manifest.json, favicon.svg, 레거시 HTML 가이드)
- 로컬 확인: `npm run dev` → localhost:5173
- 백엔드를 로컬에서 띄울 땐 `POST /api/auth/dev-login`으로 Google 없이 JWT 발급 가능 (local 프로필 한정)
- 폼/이펙트 안티패턴 회피:
  - URL → state는 `useSearchParams`에서 derived (`searchParams.get(...) ?? default`), `useState`로 복사하지 말 것
  - 모달의 "initial을 받으면 폼 리셋"은 wrapper + keyed inner로 (effect+setState 금지)
- ESLint `react-hooks/set-state-in-effect`가 enable되어 있음 — 모든 `useEffect` 안의 sync setState는 차단됨
