shared-docs — 프로젝트 지침서
> Claude Code와 함께 이어가기 위한 컨텍스트 및 작업 가이드

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
        └── SCALING_BLUEPRINT.md   ← MDX, 모바일, 데이터 피처 로드맵
```

***src/ 폴더 구조 (현재)
```
src/
├── api/                    ← axios 클라이언트 + 공유 QueryClient
│   ├── client.ts           ← Bearer 토큰 인터셉터, 401→/login 리다이렉트
│   ├── queryClient.ts
│   ├── comments.ts         ← 댓글 API + TanStack 훅
│   └── admin.ts            ← 관리자 API
├── auth/                   ← 인증 컨텍스트 + 라우트 가드
│   ├── AuthContext.tsx     ← jwt-decode로 클레임 파싱, localStorage 동기화
│   ├── RequireAuth.tsx     ← 미로그인 → /login
│   ├── RequireRole.tsx     ← role 불일치 → <Forbidden /> (403 페이지)
│   └── tokenStorage.ts
├── components/
│   ├── common/             ← 반응형 프리미티브
│   │   ├── MobileTable.tsx ← 모바일=카드, 데스크톱=테이블
│   │   ├── MobileShell.tsx ← 바텀 네비를 위한 레이아웃 래퍼
│   │   └── BottomNav.tsx   ← 모바일 전용 고정 바텀 네비
│   ├── Comments.tsx        ← 댓글 리스트 + 폼 (Google 프로필 사용)
│   ├── CommentsFab.tsx     ← 우하단 💬 → 슬라이드인 드로어
│   ├── DocLayout.tsx       ← MDX 문서용 공통 래퍼
│   └── FloatingToc.tsx     ← 우측 고정 TOC
├── content/                ← MDX 콘텐츠 레지스트리
│   ├── index.ts            ← import.meta.glob('./*.mdx')로 자동 발견
│   └── honeymoon.mdx       ← 현재 스캐폴드만; 실제 내용은 /honeymoon에 남아있음
├── features/               ← 데이터 피처별 1폴더 = 1피처
│   ├── purchases/          ← 💰 구매 내역
│   ├── todos/              ← ✅ 공동 할 일
│   ├── anniversaries/      ← 🎉 기념일
│   └── calendar/           ← 📅 캘린더 (집계 전용 — 자체 엔티티 없음)
├── lib/useMediaQuery.ts    ← useIsDesktop / useIsMobile
├── pages/
│   ├── Hub.tsx             ← 메인 가이드북 카드 허브 (+ 관리자용 "관리" 칩)
│   ├── DataHub.tsx         ← /data 인덱스 (5개 피처 카드: done/todo 상태)
│   ├── CalendarPage.tsx    ← /calendar (react-day-picker)
│   ├── Admin.tsx           ← /admin 사용자 + 화이트리스트 관리
│   ├── Doc.tsx             ← /doc/:id MDX 렌더러
│   ├── Login.tsx           ← Google 로그인 버튼
│   ├── AuthCallback.tsx    ← #token 파싱 → localStorage 저장
│   ├── Forbidden.tsx       ← 403 (RequireRole 미스매치)
│   ├── NotFound.tsx        ← 404
│   ├── Honeymoon.tsx       ← 레거시 가이드 (≈1200 LOC, MDX 이주 보류)
│   ├── Cleaning.tsx        ← 레거시 가이드
│   └── Stock.tsx           ← 레거시 가이드
└── App.tsx                 ← 라우팅 (MobileShell 레이아웃 라우트 사용)
```

***라우트 매핑
| 경로 | 페이지 | 보호 |
|---|---|---|
| `/login`, `/auth/callback` | Login / AuthCallback | public |
| `/` | Hub | authed |
| `/data` | DataHub | authed |
| `/data/purchases` | PurchaseList | authed |
| `/data/todos` | TodoList | authed |
| `/data/anniversaries` | AnniversaryList | authed |
| `/calendar` | CalendarPage | authed |
| `/admin` | Admin | ADMIN only |
| `/honeymoon`, `/cleaning`, `/stock` | 레거시 가이드 | authed |
| `/doc/*` | Doc (MDX) | authed |
| `*` | NotFound | — |

***현재 완성된 데이터 피처
✅ 구매 내역 (`/data/purchases`)
- 월 선택 + 카테고리 필터 + 통화별 합계
- 항목 / 카테고리 / 금액 + 통화 (BigDecimal, ISO 4217) / 메모
- 카테고리 시드: 식비 🍱 / 교통 🚌 / 주거 🏠 / 의료 🩺 / 여가 🎬 / 의류 👕 / 기타 📦

✅ 공동 할 일 (`/data/todos`)
- 필터: 오늘 / 이번 주 / 전체 / 완료됨
- 둘 중 누구든 완료 토글 가능; 누가 완료했는지 자동 기록
- 카테고리 시드: 집안일 🧹 / 쇼핑 🛒 / 일정 📅 / 공사 🔨 / 기타 📦

✅ 기념일 (`/data/anniversaries`)
- "다가오는 30일" 섹션이 자동으로 위로
- 매년 반복 체크박스; N주년 배지 자동 계산
- 카테고리 시드: 기념일 🎉 / 생일 🎂 / 가족 👨‍👩‍👧 / 친구 🤝 / 기타 📦

✅ 캘린더 (`/calendar`)
- 백엔드 `/api/calendar/events?from&to`가 기념일(반복 적용) + 마감 있는 OPEN 할 일을 합쳐서 반환
- 호박색 점 = 기념일, 네이비 점 = 할 일, 둘 다 = 분할 색 표시기
- 날짜 선택 → 그 날의 이벤트 리스트

***아직 안 한 것 (블루프린트 §10 후속)
🚧 1. 유용한 링크 컬렉션 (`/data/links`) — DataHub 카드는 있지만 todo 상태
🚧 2. 레시피 컬렉션 (`/data/recipes`) — 드래그 앤 드롭 프리미티브 필요
🚧 3. 카테고리 관리 UI — 각 피처의 "관리" 탭. API는 이미 admin-only로 존재; curl로 가능.
🚧 4. 전역 헤더 + 아바타 드롭다운 + 로그아웃 — 지금은 Hub 우상단 "관리" 칩만 있음
🚧 5. MDX 콘텐츠 이주 — Honeymoon/Cleaning/Stock의 실제 내용은 아직 레거시 .tsx에 그대로
🚧 6. 폴더 뷰 (Finder 스타일) — 문서 수가 적어 보류

***데이터 피처 확장 패턴
새 데이터 피처를 추가할 때는 기존 4개(purchases/todos/anniversaries/calendar)와 똑같이:
1. 백엔드: `com.shareddocs.backend.<feature>/` 패키지에 Entity, Repository, Service, Controller, Dto, (선택) Category + CategoryBootstrapper
2. 프론트: `src/features/<feature>/` 폴더에 `api.ts` + `<Feature>List.tsx` + `<Feature>Form.tsx` + `<feature>.css`
3. `src/pages/DataHub.tsx`에서 해당 카드의 status를 `'todo'` → `'done'`으로 변경
4. `src/App.tsx`에 라우트 추가

권한 규칙(공통):
- 읽기: 인증된 모든 사용자 (공유 데이터)
- 수정: 작성자만
- 삭제: 작성자 + 관리자
- 카테고리 관리: 관리자만
- 백엔드 `me.role` / `me.userId`로 강제

***스타일 규칙
- 모든 텍스트는 한국어
- 폰트: Noto Sans KR (본문), Noto Serif KR (제목/타이틀)
- 컬러 변수: --cream `#F4EFE5` (배경), --text `#1C1916`, --muted `#6B6660`, primary `#1B3A5C`
- 모바일 우선: 최소 44×44px 터치 타겟, 바텀 네비 56px + safe-area-inset-bottom
- BEM-스러운 클래스명: `.purchase__row--highlight`

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

***백엔드 운영 메모
- 자체 호스팅 GitHub Actions 러너가 맥미니에서 동작 (`~/actions-runner-shared-docs/`, launchd 서비스)
- `main` 푸시 → `./gradlew bootJar` → Docker 이미지 빌드 → `docker compose up -d --force-recreate` → `/actuator/health` 확인
- Docker 컨테이너는 모두 `restart: unless-stopped` (재부팅 시 자동 시작)
- MariaDB는 `lunch-select-db` 컨테이너를 공유 (3307 호스트 포트, `shared_docs` DB)
- 환경변수는 GitHub Secrets → docker-compose env로 주입; 추적 파일에는 placeholder만

***메모
- index.html / vite.config.ts / public/manifest.json — 건드릴 일 거의 없음
- public/ 폴더는 빌드 시 dist/로 그대로 복사됨 (manifest.json, favicon.svg, 레거시 HTML 가이드)
- 로컬 확인: `npm run dev` → localhost:5173
- 백엔드를 로컬에서 띄울 땐 `POST /api/auth/dev-login` 으로 Google 없이 JWT 발급 가능 (local 프로필 한정)
