shared-docs — 프로젝트 지침서
> Claude Code와 함께 이어가기 위한 컨텍스트 및 작업 가이드
> 최근 업데이트: 2026-05-15 (데이터 스냅샷 v1 추가 후)

***프로젝트 개요
진과 채연 두 사람을 위한 비공개 웹앱.
**메모(Bear/Apple Memo 풍 마크다운 에디터) + 시트(스프레드시트) + 데이터 트래킹(구매·할 일·기념일) + 캘린더**가 한곳에 모여 있다.
배포: Vercel(프론트엔드) + Cloudflare Tunnel → 맥미니 Docker(백엔드 + MariaDB + uploads 볼륨)
스택: Vite + React 19 + TypeScript (프론트), Spring Boot + Kotlin (백엔드, 별도 레포 `shared-docs-backend`)
접근 제어: Google OAuth2 + 이메일 화이트리스트(현재 2명) + JWT
중요: 모든 UI 텍스트는 한국어.
**미감 기준은 Bear (macOS 노트 앱)**. 새 UI를 만들 때는 "Bear에 들어가도 안 어색한가?"를 먼저 묻는다. 디테일은 `/.../memory/feedback_aesthetic.md` 참조.
**아이콘은 무조건 Lucide** — 이모지를 chrome으로 쓰지 않는다. 디테일은 `/.../memory/feedback_icons.md` 참조.

***상위 폴더 구조
```
shared-docs-root/
├── shared-docs/           ← 이 레포 (프론트엔드)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
└── shared-docs-backend/   ← 별도 레포 (Spring Boot, GitHub Actions self-hosted runner)
    ├── docker-compose.yml ← uploads 볼륨 마운트 포함
    └── docs/
        ├── AUTH_BLUEPRINT.md       ← Google OAuth + JWT 설계
        ├── SCALING_BLUEPRINT.md    ← 로드맵 + 구현 로그 (메모/시트/검색/설정 등)
        └── REFERENCES_BLUEPRINT.md ← 데이터 스냅샷 + 메모 백링크 설계 (다음 작업 2건)
```

***src/ 폴더 구조 (현재)
```
src/
├── api/                            ← axios 클라이언트 + 공유 QueryClient
│   ├── client.ts                   ← Bearer 토큰 인터셉터, 401→/login 리다이렉트
│   ├── queryClient.ts
│   ├── comments.ts                 ← 댓글 API + TanStack 훅 (현재 메모/시트에서 미사용; 데이터 피처용)
│   └── admin.ts                    ← 관리자 API
├── auth/                           ← 인증 (3개 파일로 분리: Fast Refresh 호환)
│   ├── authContext.ts / AuthProvider.tsx / useAuth.ts / tokenStorage.ts
│   ├── RequireAuth.tsx / RequireRole.tsx
├── components/
│   ├── ui/                         ← ★ 공유 디자인 시스템 (CSS Modules + tokens.css)
│   │   ├── tokens.css              ← 색/간격/반경/그림자/모션 + Bear-red --c-accent
│   │   ├── Page.tsx / BackLink.tsx / Card.tsx / Stack.tsx / Row.tsx / Section.tsx
│   │   ├── Field.tsx / Label.tsx / Hint.tsx / ErrorText.tsx
│   │   ├── Input.tsx / Select.tsx / Textarea.tsx / Checkbox.tsx
│   │   ├── Button.tsx / IconButton.tsx / Fab.tsx
│   │   ├── Badge.tsx / Kbd.tsx / Modal.tsx / Tabs.tsx
│   │   ├── ConfirmDialog.tsx       ← Radix Dialog 래퍼 (destructive variant)
│   │   ├── Menu.tsx                ← Radix DropdownMenu 래퍼 + MenuItem + MenuSeparator
│   │   └── index.ts
│   └── common/                     ← 반응형 레이아웃 프리미티브
│       ├── AppSidebar.tsx          ← Bear-풍 사이드바 셸 (brand/section/item) — Data + Calendar에서 사용
│       ├── AppSidebarSheet.tsx     ← 모바일 슬라이드업 시트 (Radix Dialog) — AppSidebar의 모바일 대응
│       ├── MobileTable.tsx         ← 모바일=카드, 데스크톱=테이블 (구매 등 데이터 피처에서 사용)
│       ├── MobileShell.tsx         ← TopNav + Outlet + BottomNav 래퍼
│       ├── TopNav.tsx              ← 데스크톱 헤더 (메모/시트/데이터/캘린더/관리)
│       └── BottomNav.tsx           ← 모바일 전용 하단 네비 (safe-area-inset 포함)
├── features/                       ← 1폴더 = 1피처. 각 컴포넌트는 자체 .module.css 보유
│   ├── notes/                      ← ★ 메모 (Bear 풍 마크다운 에디터)
│   │   ├── api.ts                  ← Note + Attachment CRUD 훅
│   │   ├── types.ts
│   │   ├── workspace/
│   │   │   └── NoteWorkspace.tsx   ← 3-pane 셸 (사이드바 + 리스트 + 에디터)
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx         ← 데스크톱 사이드바 (모든 메모/고정됨/태그)
│   │   │   ├── SidebarSection.tsx
│   │   │   └── SidebarSheet.tsx    ← 모바일 슬라이드업 시트 (필터 드로어)
│   │   ├── list/
│   │   │   ├── NoteList.tsx
│   │   │   ├── NoteListHeader.tsx  ← 메모 N · + 새 메모 · 모바일 필터 chip
│   │   │   ├── NoteListItem.tsx
│   │   │   └── NoteListEmpty.tsx
│   │   ├── editor/
│   │   │   ├── NoteEditor.tsx      ← 오케스트레이터 (autosave + pin/delete + uploads)
│   │   │   ├── NoteEditorTitle.tsx ← serif 큰 제목 입력 (note id로 re-key)
│   │   │   ├── NoteEditorMeta.tsx  ← 작성자·시간·저장 중 · 핀 표시 · 케밥 메뉴
│   │   │   ├── NoteEditorToolbar.tsx ← B/I/S/H1/H2/리스트/체크리스트/인용/코드/표/링크/첨부
│   │   │   ├── NoteEditorBody.tsx  ← Tiptap useEditor + 확장 등록 + 붙여넣기/드롭 핸들러
│   │   │   ├── NoteEditorBubbleMenu.tsx ← 텍스트 선택 시 떠오르는 다크 풍선 (터치에선 숨김)
│   │   │   ├── NoteEditorEmpty.tsx
│   │   │   ├── NoteEditorMobileBar.tsx ← 모바일 < 메모 뒤로가기
│   │   │   ├── SlashMenuPopup.tsx  ← '/' 명령 메뉴 (포털, 뷰포트 클램프)
│   │   │   ├── slashItems.ts       ← 명령 리스트 (H1-3, lists, task, quote, code, table, file)
│   │   │   ├── NoteAttachments.tsx ← 본문 아래 첨부 갤러리 섹션 (zero attachments면 숨김)
│   │   │   ├── NoteAttachmentRow.tsx ← 썸네일(이미지) 또는 파일 아이콘 + 이름 + 사이즈 + 다운로드 + 케밥(삭제)
│   │   │   ├── NoteAttachmentLightbox.tsx ← Radix Dialog 풀스크린 이미지 뷰어
│   │   │   └── extensions/
│   │   │       ├── Tag.ts          ← '#tag' 인라인 mark (markInputRule + markPasteRule)
│   │   │       └── SlashCommand.ts ← @tiptap/suggestion 래핑 확장
│   │   └── shared/
│   │       ├── PinButton.tsx       ← (현재 미사용; Menu의 핀 아이콘으로 흡수됨)
│   │       ├── notePreview.ts      ← HTML → 평문 발췌, 제목 추출
│   │       ├── formatRelativeTime.ts ← "방금" / "3분 전" / "어제" / "YYYY-MM-DD"
│   │       └── extractTags.ts      ← DOMParser로 본문에서 #tag 수집
│   ├── sheets/                     ← ★ 시트 (스프레드시트)
│   │   ├── api.ts
│   │   ├── types.ts                ← SheetSummary / SheetFull / SheetColumn / SheetRow / SheetData
│   │   ├── workspace/SheetWorkspace.tsx ← 2-pane (리스트 + 그리드)
│   │   ├── list/                   ← Notes와 같은 패턴 (Header/Item/Empty/List)
│   │   ├── editor/
│   │   │   ├── SheetEditor.tsx     ← 오케스트레이터 (debounced JSON autosave + useIsMobile 스왑)
│   │   │   ├── SheetEditorTitle.tsx
│   │   │   ├── SheetEditorMeta.tsx ← 노트와 동일한 케밥 패턴
│   │   │   ├── SheetEditorToolbar.tsx ← 데스크톱: + 행 / + 열 · 모바일: 열 관리
│   │   │   ├── SheetEditorGrid.tsx ← 데스크톱: react-data-grid v7 래퍼 + 헤더 dblclick 이름 변경
│   │   │   ├── SheetEditorCardList.tsx ← 모바일: 카드-퍼-로우 (각 행 = 카드, 각 열 = 라벨된 input)
│   │   │   ├── SheetColumnSheet.tsx ← 모바일: 슬라이드업 시트 (열 추가/이름변경/삭제)
│   │   │   ├── SheetEditorEmpty.tsx
│   │   │   └── SheetEditorMobileBar.tsx
│   │   └── shared/sheetData.ts     ← JSON 파스/직렬화 + 기본값 + nextColumnKey/Label
│   ├── snapshots/                  ← ★ 데이터 스냅샷 (메모 본문에 frozen 카드)
│   │   ├── types.ts                ← SnapshotKind/Filter/Frozen/Attrs
│   │   ├── compute.ts              ← 순수 컴퓨터: filter + cached data → frozen
│   │   ├── refresh.ts              ← queryClient.fetchQuery로 재캡처
│   │   ├── sourceLink.ts           ← /data 딥링크 생성
│   │   ├── DataSnapshot.ts         ← Tiptap block node (atom, draggable, JSON in data-* attrs)
│   │   ├── DataSnapshotCard.tsx    ← React NodeView 카드 (새로고침/삭제 케밥)
│   │   └── DataSnapshotPicker.tsx  ← Radix Dialog 2-step (종류 → 필터 + 미리보기)
│   ├── settings/                   ← ★ 외형 설정 (테마/글꼴/줄간격)
│   │   ├── SettingsProvider.tsx    ← localStorage 영속화 + <html>에 data-* 속성 반영
│   │   ├── SettingsDialog.tsx      ← Radix Dialog, 3 섹션 (테마/글꼴/줄 간격), 클릭 즉시 적용
│   │   ├── settingsContext.ts      ← useSettings()
│   │   └── types.ts                ← THEMES/FONTS/LINE_HEIGHTS + labels
│   ├── search/                     ← ★ ⌘K 검색 팔레트 (전역)
│   │   ├── SearchPaletteProvider.tsx ← Radix Dialog 마운트 + ⌘K/Ctrl+K 글로벌 단축키
│   │   ├── SearchPalette.tsx       ← 입력 + 결과 리스트 + 키보드 네비
│   │   ├── searchContext.ts        ← useSearchPalette() 컨텍스트
│   │   ├── useSearchResults.ts     ← useNotes + useSheets 캐시 데이터 필터링
│   │   └── stripHtml.ts            ← Tiptap HTML → 평문 (검색용)
│   ├── purchases/                  ← 💰 구매 내역 (기존)
│   │   ├── api.ts                  ← Purchase + SplitMode + 카테고리 + 통화
│   │   ├── PurchaseList.tsx        ← 페이지 (월/카테고리 필터, ?date ?month ?edit ?row)
│   │   ├── PurchaseGrid.tsx        ← 데스크톱 react-data-grid 인라인 편집
│   │   ├── PurchaseForm.tsx        ← 모바일/추가 모달
│   │   ├── settlement.ts           ← 순수 정산 계산기
│   │   ├── SettlementCard.tsx / settlementApi.ts
│   │   ├── CategoryChart.tsx       ← 수제 SVG 도넛 (KRW 한정)
│   │   └── RecurringPurchasesModal.tsx / recurringApi.ts
│   ├── todos/                      ← ✅ 공동 할 일
│   ├── anniversaries/              ← 🎉 기념일
│   └── calendar/                   ← 📅 캘린더 집계 (자체 엔티티 없음, 4개 소스 조인)
├── lib/
│   ├── format.ts                   ← formatMoney / monthBounds / formatShortDate 등
│   ├── color.ts                    ← hexWithAlpha
│   └── useMediaQuery.ts            ← useSyncExternalStore 기반 — useIsDesktop/Mobile/Touch
├── pages/
│   ├── Hub.tsx                     ← 메인 / — NoteWorkspace 렌더 (React.lazy)
│   ├── SheetsPage.tsx              ← /sheets — SheetWorkspace 렌더
│   ├── DataLayout.tsx              ← /data 레이아웃 (AppSidebar + Outlet, /data 인덱스 = 모바일 친화 picker)
│   ├── CalendarPage.tsx            ← /calendar — AppSidebar로 이벤트 종류 필터링
│   ├── Admin.tsx / Login.tsx / AuthCallback.tsx / Forbidden.tsx / NotFound.tsx
└── App.tsx                         ← 라우팅 + Suspense
```

***라우트 매핑
| 경로 | 페이지 | 보호 | 코드 분할 |
|---|---|---|---|
| `/login`, `/auth/callback` | Login / AuthCallback | public | eager |
| `/` | Hub (NoteWorkspace) | authed | **lazy** |
| `/sheets` | SheetsPage (SheetWorkspace) | authed | **lazy** |
| `/data` | DataLayout (사이드바 + Outlet) | authed | eager |
| `/data/purchases` | PurchaseList (nested in DataLayout) | authed | **lazy** |
| `/data/todos` | TodoList (nested in DataLayout) | authed | **lazy** |
| `/data/anniversaries` | AnniversaryList (nested in DataLayout) | authed | **lazy** |
| `/calendar` | CalendarPage (AppSidebar 필터) | authed | **lazy** |
| `/admin` | Admin | ADMIN only | **lazy** |
| `*` | NotFound | — | eager |

쿼리 파라미터:
- **메모**: `/?note=N` — 해당 노트 활성화 (없으면 빈 에디터 / 모바일은 리스트만)
- **시트**: `/sheets?sheet=N` — 같은 패턴
- **구매**: `?month=YYYY-MM` · `?date=YYYY-MM-DD` · `?edit=N` · `?row=N`
- **할 일/기념일**: `?date=YYYY-MM-DD`

***공유 디자인 시스템 (`src/components/ui/`)
- 모든 새 코드는 `src/components/ui` 또는 자체 피처 폴더의 컴포넌트에서 import.
- 스타일링: **CSS Modules** (`*.module.css`) — 각 컴포넌트 옆에 위치. 글로벌 `tokens.css`의 변수 사용.
- 토큰: `--c-primary` (navy, 액션/링크), `--c-accent` (Bear-red #e8434a, **희소하게** — 선택 레일·핀·해시태그), `--c-text/muted/subtle/placeholder`, `--c-bg` (웜 크림), `--c-surface` (흰), `--c-surface-tint`, `--c-border/strong/dashed`, `--sp-1..9`, `--r-xs/sm/md/lg/pill`, `--shadow-sm/md/lg/fab`, `--t-fast/base`.
- 폰트: 본문 `Noto Sans KR`, 큰 제목 `Noto Serif KR`. 둘 다 `var(--font-sans/serif)`로.
- Radix 프리미티브는 **선택적으로** 채택 — `ConfirmDialog`(=Dialog)와 `Menu`(=DropdownMenu)가 현재 두 도입처. 헤드리스만 가져와 CSS Modules로 입힘. Tailwind는 도입하지 않음.
- **사이드바**는 `components/common/AppSidebar`로 통일 — `<AppSidebar brand>` + `<AppSidebarSection label>` + `<AppSidebarItem Icon label count active onClick>`. 모바일 미러는 `<AppSidebarSheet>` (Radix Dialog 슬라이드업). 메모/시트는 자체 `Sidebar`를 유지하지만 시각적 규칙은 동일.

***메모 (`/`) 핵심
- **3-pane on desktop / 1-pane on mobile** — URL이 진실의 소스.
- Tiptap v3 + StarterKit + Image + Link + Placeholder + TaskList + Table + 커스텀 **Tag** mark + 커스텀 **SlashCommand** 확장.
- **autosave**: 본문은 키 입력 후 600ms 디바운스 → PATCH `/api/notes/:id { body }`. 제목은 blur에 저장. 노트 전환/언마운트 시 flush.
- **첨부**: 이미지 붙여넣기/드롭/툴바 클립 → `POST /api/notes/:id/attachments` (multipart) → 응답 URL을 `<img>`로 삽입. 비이미지 파일은 `📎 파일명` 링크로 삽입.
- **태그**: 본문에 `#travel`/`#여행` 입력 후 **공백을 누르면** 인라인 mark로 변환 (Bear-red pill). 트리거는 trailing whitespace — `$`-anchored 규칙으로 매 키스트로크마다 발화시키면 문자가 사라지는 회귀가 있었음 (`Tag.ts`의 코멘트 참조). `shared/extractTags.ts`가 모든 노트의 HTML을 파스해 사이드바 태그 섹션을 만들고 카운트 표시 → 클릭 시 필터.
- **slash menu**: `/` → 헤딩/리스트/체크리스트/인용/코드/표/파일첨부 명령 메뉴. 키보드 네비 (Up/Down/Enter/Tab/Esc), 뷰포트 클램프, 포털 렌더.
- **bubble menu**: 텍스트 선택 시 뜨는 다크 풍선 (B/I/S/code/link). **터치 디바이스에선 숨김** — iOS 네이티브 선택 메뉴와 충돌하기 때문 (`useIsTouch`).
- **케밥 메뉴**: 메타 strip의 `…` → Radix DropdownMenu → 고정/해제 + 삭제 (ConfirmDialog).
- **첨부 갤러리**: 본문 아래 `NoteAttachments` 섹션이 `useAttachments(noteId)`로 모든 첨부를 나열. 행 = 썸네일(이미지) / 파일 아이콘 + 이름 + `formatBytes()` 사이즈 + 다운로드 링크 + 케밥(삭제 → ConfirmDialog). 이미지 클릭 시 `NoteAttachmentLightbox` (Radix Dialog) 풀스크린 뷰어. 첨부가 0개면 섹션 자체가 숨겨짐. 본문에 삽입된 `<img>`/링크는 첨부 삭제와 독립 — 사용자가 본문에서도 함께 지워야 함 (ConfirmDialog 설명에 안내).
- **이미지 첨부 크기 제한**: 클라이언트 게이트 `MAX_IMAGE_BYTES = 5MB` (`notes/api.ts`에서 export). `uploadAttachmentReq`가 `image/*` 타입의 5MB 초과 파일을 즉시 Korean Error로 reject — 네트워크 요청이 가지 않음. 서버 멀티파트 한도(20MB)는 백스톱. 에러 메시지는 `NoteEditor` / `NoteEditorBody`에서 `window.alert`로 노출. 비이미지 첨부에는 제한 없음 (서버 한도까지).
- **데이터 스냅샷**: 슬래시 메뉴 `데이터 스냅샷` → `DataSnapshotPicker`(2-step Radix Dialog) → 본문에 `dataSnapshot` 블록 노드 삽입. 종류 4종: `purchase-total` / `settlement` / `todo-subset` / `anniversary`. 카드는 **frozen** 값을 그대로 렌더 — 자동 refetch 없음. 새로고침 버튼이 `queryClient.fetchQuery`로 재캡처 후 `updateAttributes({ frozen })`. JSON 필드는 `data-*` 속성에 stringify되어 라운드트립. 디자인 근거 → `REFERENCES_BLUEPRINT.md` Part 1.

***시트 (`/sheets`) 핵심
- **2-pane** (리스트 + 그리드). 모바일은 같은 단일-팬 드릴인 패턴.
- 데이터는 **불투명 JSON LONGTEXT 블롭** (`{ columns: [{key, name, width?}], rows: [{key: value}] }`). 스키마 진화 없음 — 프런트가 모든 형태 변화를 흡수.
- **데스크톱**: react-data-grid v7 그리드, 셀 더블클릭 편집. 열 이름은 헤더 더블클릭 → `window.prompt`. 열 삭제는 헤더 호버 시 `×` 버튼. (`SheetEditorGrid`)
- **모바일**: 카드-퍼-로우 뷰 (`SheetEditorCardList`) — 각 행이 카드, 각 열이 라벨된 input. 카드 헤더에 `#N` 행 번호 + 케밥(삭제). 하단에 `+ 행 추가` 점선 버튼. 열 추가/이름변경/삭제는 툴바의 **열 관리** → 슬라이드업 시트 (`SheetColumnSheet`).
- 데스크톱/모바일 스왑은 `SheetEditor`에서 `useIsMobile()`로. 둘 다 동일한 `localData / handleDataChange` 흐름을 공유 → 자동 저장 로직은 한 곳.
- **autosave**: 변경 후 800ms 디바운스. 전체 data JSON 통째로 PATCH.

***엔티티 & 권한 규칙
| 엔티티 | 위치 | 권한 |
|---|---|---|
| `Note` (id, title?, body LONGTEXT HTML, pinned, createdBy, ts) | `com.shareddocs.backend.note` | 읽기=인증 사용자 모두 / 수정=작성자 / 삭제=작성자 또는 ADMIN |
| `Attachment` (id, note FK, originalFilename, contentType, sizeBytes, storedFilename UUID, uploadedBy) | 같음 | 작성자만 업로드 / 작성자·ADMIN 삭제 |
| `Sheet` (id, title?, data LONGTEXT JSON, pinned, createdBy, ts) | `com.shareddocs.backend.sheet` | Note와 동일 |
| `Purchase` / `Settlement` / `RecurringPurchase` | `purchase/` / `settlement/` / `recurring/` | 같은 패턴 |
| `Anniversary` / `Todo` / `Comment` | 각 패키지 | 같은 패턴 |

읽기는 공유 데이터, 수정은 작성자, 삭제는 작성자+ADMIN — **이 패턴을 모든 새 엔티티에서 유지**.

***백엔드 파일 저장 (uploads)
- `FileStorageService` (`note/` 패키지)가 `app.storage.upload-dir`로 파일 저장.
  - local: `./uploads`
  - docker: `/app/uploads` (docker-compose에서 `./uploads:/app/uploads` 볼륨 마운트)
- 저장 파일명은 UUID + 확장자. 경로 트래버설 방어 (`startsWith(root)` 체크).
- 멀티파트 한도: `spring.servlet.multipart.max-file-size: 20MB`, `max-request-size: 25MB`.
- 서빙: `GET /files/{storedFilename}` — **public** (SecurityConfig에서 `permitAll`). 보안은 UUID 추측 불가능성 + Cloudflare Tunnel에 의존.
- 응답: 원본 content-type + `inline` disposition + 1년 immutable 캐시.

***새 데이터 피처 확장 패턴
새 데이터 피처를 추가할 때 기존 6개(notes/sheets/purchases/todos/anniversaries/calendar)와 똑같이:
1. **백엔드**: `com.shareddocs.backend.<feature>/` 패키지에 Entity, Repository, Service, Controller, Dto. (옵션) Category + CategoryBootstrapper.
2. **프론트**: `src/features/<feature>/` 폴더에 `api.ts` + `types.ts` + 단일-책임 컴포넌트 트리. **컴포넌트마다 자체 `.module.css`** — 마이크로 UI 튜닝이 한 파일에서 끝나야 함.
3. 폼은 `Modal` + `Field/Input/Select/Textarea/Button` 조합. **wrapper + keyed inner 패턴** (set-state-in-effect 방지).
4. 리스트 페이지는 `Page/PageHeader/PageTitle/BackLink` 또는 자체 List/Header/Item 구조. FAB은 `Fab`. **데이터 서브페이지면 `<BackLink to="/data" mobileOnly>` 사용** — 데스크톱에서 사이드바와 중복되지 않게.
5. 라우트를 `src/App.tsx`에 추가하고 **`React.lazy`로 분할**.
6. 모바일: 단일-팬 드릴인 + 백 버튼 + 안전 영역 인셋.

***모바일 (iPhone) 친화 규칙
- 뷰포트 메타에 `interactive-widget=resizes-content` 포함 → 키보드 올라올 때 레이아웃이 줄어 캐럿이 가려지지 않음.
- `BottomNav`는 `padding-bottom: env(safe-area-inset-bottom)` — 홈 인디케이터 위에 안전하게 떠 있음.
- 워크스페이스 높이는 `calc(100svh - 56px - env(safe-area-inset-bottom))` — 콘텐츠가 인디케이터 아래로 새지 않게.
- 터치 타깃 ≥44px (Apple HIG). 데스크톱 시각은 그대로, 모바일에서만 `@media (max-width: 767px)`로 확장.
- 에디터/리스트 사이 이동: **백 버튼**(`< 메모` / `< 시트`)으로 명시적 affordance.
- 사이드바는 모바일에서 숨김 — 리스트 헤더의 **필터 chip**이 슬라이드업 시트(`SidebarSheet`)로 동일 콘텐츠 노출.
- `BubbleMenu` 같은 hover 전제 UI는 `useIsTouch()` 가드.

***스타일 규칙
- 모든 텍스트는 한국어.
- 폰트: Noto Sans KR (본문), Noto Serif KR (큰 제목/타이틀).
- **컬러는 `tokens.css` 변수만** — 하드코딩 hex 금지 (예외: 캘린더의 4가지 이벤트 dot 색 — `SOURCE_META`).
- **이모지를 chrome으로 쓰지 않음** — Lucide 아이콘 전용. 사용자가 작성한 본문(노트 body, 댓글)에서는 자유.
  - **카테고리 `icon` 필드 caveat**: DB의 `Purchase/Todo/Anniversary Category.icon`은 OS 이모지 문자열(🍔/🚌/🏠/…)을 담고 있지만 — 관리자가 큐레이션한 *콘텐츠*이더라도 — chrome(Select option, `<Badge>`, 차트 범례)에 그리지 않는다. 필드는 유지하되 UI는 무시. (메모리 `feedback_icons.md` 참조)
- **그림자/카드 lift 없음. Hairline 보더만.** 이 규칙은 `Card.module.css`에서 강제 — `.card`에는 `box-shadow`가 없고 `border-radius`는 `--r-md`. Hover는 `--c-surface-tint` 배경 톤 변화로만.
  - 예외: `Modal`, `ConfirmDialog`, `Menu` (Radix Portal로 떠있는 표면)와 `Fab` (떠있는 FAB)은 `--shadow-md/lg/fab`를 유지 — "lift"가 아닌 "floating"이라 OK.
- **버튼 위계**: `primary`(solid navy)는 **실제로 데이터가 변하는 commit 액션 한 곳에만**. 페이지 진입용/탐색용 액션("+ 항목 추가", "오늘", "반복 항목")은 `outline`. 보조 액션은 `ghost`/`soft`. 결과적으로 한 화면에서 navy 버튼은 0~1개.
- **BackLink**는 사이드바가 같은 정보를 노출하는 데스크톱(≥901px)에서는 시각 노이즈가 됨 — `<BackLink to="/data" mobileOnly>` 처럼 `mobileOnly` 프롭으로 데스크톱에서 숨김. 데이터 서브페이지 3개가 이 패턴 사용.
- 모바일 우선: 최소 44×44 터치 타깃, BottomNav 56 + safe-area.
- 클래스 명명: 새 컴포넌트는 CSS Modules로 스코프됨. 기존 feature CSS는 BEM-스러운 클래스 유지.

***인증 흐름 (요약)
1. 사용자가 `/`로 진입 → `RequireAuth`가 localStorage 토큰 없음 감지 → `/login` 리다이렉트.
2. "Google로 로그인" → `${VITE_API_BASE_URL}/oauth2/authorization/google`.
3. Google 동의 → 백엔드 `/login/oauth2/code/google` 콜백.
4. `OAuth2SuccessHandler`가 allowlist 검사 → `users` upsert → JWT 발급 → `${FRONTEND_URL}/auth/callback#token=<jwt>` 302.
5. `AuthCallback`이 fragment에서 토큰 추출 → localStorage 저장 → `/` navigate.
6. 이후 모든 `/api/**`에 `Authorization: Bearer <jwt>` 자동 첨부 (axios 인터셉터).
7. `/files/**`는 `permitAll` — 위 흐름과 무관 (UUID 추측 불가성 + 사설 터널에 의존).

***안티패턴 회피 (ESLint가 강제)
- **setState in effect** 금지 (`react-hooks/set-state-in-effect`).
  - URL → state는 `useSearchParams`에서 derived (`searchParams.get(...) ?? default`), `useState`로 복사하지 말 것.
  - 모달의 "initial을 받으면 폼 리셋"은 **wrapper + keyed inner**로 (effect+setState 금지). 동일 패턴이 NoteEditor와 SheetEditor의 title 입력에서도 사용됨 (`key={note.id}`).
- **refs in render** 금지 (`react-hooks/refs`, `react-hooks/immutability`).
  - ref에 값 쓰기는 effect 안에서. 렌더 중에 ref 값 읽기 금지.
  - ref를 함수에 인자로 전달할 때는 react-hooks/refs가 경고 — `// eslint-disable-next-line` + 사유 코멘트로 명시 허용.
- `this`-aliasing 금지 (`@typescript-eslint/no-this-alias`) — Tiptap extension에서 `this.options`를 메서드 시작에서 디스트럭처링.

***성능 메모
- 초기 main 번들 ≈ 200 kB / 64 kB gzip.
- Hub 청크 (NoteWorkspace + Tiptap 전체) ≈ 474 kB / 147 kB gzip — `/` 도착 시에만 로드.
- SheetsPage 청크 ≈ 13 kB. react-data-grid는 PurchaseList와 공유 청크(`styles-*`).
- CalendarPage 청크 ≈ 78 kB.
- 새 페이지 추가 시 `React.lazy` 동일 패턴 유지.

***백엔드 운영 메모
- 자체 호스팅 GitHub Actions 러너가 맥미니에서 동작 (`~/actions-runner-shared-docs/`, launchd 서비스).
- `main` 푸시 → `./gradlew bootJar` → Docker 이미지 빌드 → `docker compose up -d --force-recreate` → `/actuator/health` 확인.
- 모든 컨테이너는 `restart: unless-stopped`.
- MariaDB는 `lunch-select-db` 컨테이너를 공유 (3307 호스트 포트, `shared_docs` DB).
- 환경변수는 GitHub Secrets → docker-compose env로 주입.
- **uploads 볼륨**: `./uploads:/app/uploads` — 컨테이너 재시작/재빌드에도 파일 유지.
- **스키마 마이그레이션**: `ddl-auto: update`. 새 엔티티 추가 / nullable 컬럼 추가는 무중단 자동 적용. NOT NULL 컬럼은 반드시 `columnDefinition`에 `DEFAULT` 명시 (`Purchase.splitMode`, `Note.pinned`, `Sheet.pinned` 참고).
- 순환 의존 회피: `PurchaseService`가 `RecurringPurchaseService`를 `@Lazy` 주입.

***백엔드 패키지 (현재)
```
com.shareddocs.backend/
├── note/           ← Note + Attachment + FileStorageService + FileController + 컨트롤러 5개
├── sheet/          ← Sheet + 컨트롤러
├── purchase/       ← Purchase + SplitMode + Category
├── settlement/     ← 정산 기록
├── recurring/      ← 반복 항목 템플릿 + catch-up
├── anniversary/    ← + AnniversaryCategory
├── todo/           ← + TodoCategory
├── calendar/       ← 4-소스 집계 (anniversaries + todos due + purchases + settlements)
├── comment/        ← 댓글 (현재 메모/시트에는 미연결; 데이터 피처용)
├── user/ admin/ auth/ config/
```

***외형 설정 (`src/features/settings/`)
- `SettingsProvider`가 `SearchPaletteProvider` 바깥에서 `MobileShell`을 감쌈. `theme` / `font` / `lineHeight` 3개 키를 `localStorage`(`shared-docs:settings:v1`)에 영속화 + `<html>`에 `data-theme` / `data-font` / `data-line-height` 속성 반영. 크로스탭 동기화는 `storage` 이벤트로.
- 테마 4종: `light`(기본), `dark`, `dracula`, `monokai`. 각각 `themes.css`의 `:root[data-theme="X"]` 블록에서 `--c-*` / `--shadow-*` 토큰 전체 재정의. 변수명은 동일 — 피처 CSS는 그대로.
- 글꼴 3종: `sans`(기본, Noto Sans KR), `serif`(Noto Serif KR — 본문도 세리프 "독서 모드"), `mono`(시스템 모노). `--font-sans`만 갈아끼움 — 큰 제목은 항상 `--font-serif`로 고정.
- 줄 간격 3단: `compact`(1.45) / `normal`(1.65, 기본) / `relaxed`(1.85). `--lh-body` 변수 → `NoteEditorBody.module.css`의 `.editor`에서 사용.
- 트리거 두 곳: 데스크톱 `TopNav`의 `Settings2` 아이콘 버튼, 모바일 `BottomNav`의 6번째 `설정` 버튼 (검색과 동일하게 NavLink 아닌 `<button>`).
- 설정 변경은 클릭 즉시 반영 (저장 버튼 없음). Bear 스타일.

***⌘K 검색 팔레트 (`src/features/search/`)
- `SearchPaletteProvider`가 `MobileShell` 안쪽에 마운트되어 ⌘K / Ctrl+K 글로벌 키 리스너 등록.
- 트리거 두 곳: 데스크톱은 `TopNav`의 검색 칩(`Search` 아이콘 + `Kbd ⌘K` 힌트), 모바일은 `BottomNav`의 검색 버튼(NavLink 아닌 `<button>`이라 다른 페이지로 이동하지 않고 팔레트만 엶).
- 검색 소스: `useNotes()` + `useSheets()` 캐시 데이터. 노트는 제목 + 본문(Tiptap HTML → DOMParser로 평문화) 매칭, 시트는 제목만(목록 API에 셀 데이터 없음 — 서버 사이드 풀텍스트는 v2 검토).
- 랭킹: 제목 매치 → 본문 매치, pinned 가산, `updatedAt desc`로 동률 해소. 최대 24개.
- 키보드 네비 ↑/↓, Enter 선택, Esc 닫기. 활성 인덱스는 `safeActive = Math.min(active, max)`로 렌더 중 derive (set-state-in-effect 회피).
- 결과 클릭 시 `/?note=N` 또는 `/sheets?sheet=N`으로 라우팅.

***아직 안 한 것 (다음 작업 우선순위)
🚧 1. **메모 백링크** — `@`멘션 / `[[제목]]` 자동 링크 + soft-delete + tombstone + 참조됨 패널. 설계 → `REFERENCES_BLUEPRINT.md` Part 2. `note_links` 테이블 마이그레이션 필요.
🚧 2. **전역 헤더 + 아바타 드롭다운 + 로그아웃** — 현재 로그아웃 UI 경로 없음 (localStorage 비우는 게 유일).
🚧 3. **유용한 링크 컬렉션** (`/data/links`) — OpenGraph 프리뷰.
🚧 4. **레시피 컬렉션** (`/data/recipes`) — `@dnd-kit` 필요.
🚧 5. **카테고리 관리 UI** — 각 피처의 "관리" 탭. 백엔드 API는 admin-only로 존재; 현재 curl만 가능.
🚧 6. **노트/시트 사이드바를 `AppSidebar`로 통합** — 현재는 자체 `Sidebar` 보유. 같은 시각 규칙이지만 코드 중복.
🚧 7. **시트 셀 검색 서버 사이드** — 현재 ⌘K 팔레트는 시트는 제목만 검색.
🚧 8. **설정 서버 동기화** — 현재 localStorage 기반. 디바이스 간 동기화하려면 `user_settings` 테이블 필요.
🚧 9. **첨부와 본문 inline 참조 동기화** — 현재 첨부 삭제는 본문 `<img>`/링크를 건드리지 않음 (사용자가 수동 정리).
🚧 10. **데이터 스냅샷 v2 — 시트 셀 / 메모 블록 스냅샷** — 현재 v1은 `/data` 4종만. 시트 셀 값 또는 메모 블록 transclusion은 후속.

***메모 (Claude용)
- `npm run dev` → localhost:5173. 백엔드를 로컬에서 띄울 땐 `POST /api/auth/dev-login`으로 Google 없이 JWT.
- 빌드 후 청크 크기 확인 — Hub 청크가 ~500kB 넘어가면 Tiptap 확장 추가를 의심.
- 새 Tiptap 확장은 v3 형식 (named exports, e.g. `import { Table } from '@tiptap/extension-table'`).
- `BubbleMenu`는 `@tiptap/react/menus`에서 import.
- Memory는 `/Users/jeongjin/.claude/projects/-Users-jeongjin-WebstormProjects-shared-docs-root/memory/`에. `MEMORY.md`가 인덱스, 개별 파일에 상세.
