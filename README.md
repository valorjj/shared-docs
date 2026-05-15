# shared-docs

A private web app for two people. Vite + React 19 + TypeScript on the
front, Spring Boot + Kotlin on the back, MariaDB on the side. Visually
modelled on **Bear** (the macOS note app).

Deployed at **https://shared-docs-nine.vercel.app** (Vercel for the
front, Cloudflare Tunnel → Mac Mini for the API). Access is restricted
to two Google accounts via an OAuth + JWT pipeline; everything else
404s after a login redirect.

## What it does

- **메모** (`/`) — Bear/Apple-Memo hybrid markdown editor. Three-pane
  desktop layout (sidebar tags · note list · editor), single-pane on
  mobile. Tiptap WYSIWYG with task lists, tables, bubble menu, `/`
  slash command palette, `#hashtag` parsing surfaced in the sidebar
  with counts and click-to-filter. Paste / drag / clip-button image
  and file uploads. A note's attachments appear in a gallery strip
  below the body with thumbnails, filename + size pills, per-file
  download and delete, and a full-screen image lightbox. Pin and
  per-note autosave on every keystroke.
- **시트** (`/sheets`) — lightweight spreadsheet. Two-pane workspace.
  On desktop a react-data-grid (column rename via header double-click,
  delete via hover ×, `+ 행` / `+ 열` toolbar). On mobile the same
  data renders as a **card-per-row** view with labeled inputs, a
  per-card kebab for row delete, a dashed `+ 행 추가` at the bottom,
  and a **열 관리** slide-up sheet for column rename / delete / add.
  Debounced autosave of the whole grid as one JSON payload.
- **데이터** (`/data`) — Bear-style sidebar workspace for the typed
  mini-apps. Left rail lists each tracker (구매 내역 / 할 일 / 기념일,
  with 유용한 링크 / 레시피 as "준비 중"); main pane shows the active
  subroute via React Router nested routes. On `/data` with no
  subroute, a clean picker list mirrors the same options.
  - 구매 내역 — multi-currency, inline-edit grid on desktop, per-row
    split mode (SHARED · MINE · THEIRS), per-currency settlement card
    with one-click 정산 완료 + history, KRW donut chart by category,
    recurring expenses with monthly auto-generation
  - 할 일 — tabs filter, anyone toggles done
  - 기념일 — annual recurrence, N주년 badges, upcoming-30-days section
- **캘린더** (`/calendar`) — Bear-style sidebar workspace too. Left
  rail = filter list of the four event sources (기념일 · 할 일 · 구매 ·
  정산) with live counts and toggle visibility; main pane shows the
  `react-day-picker` grid with colored dots per *visible* source and
  the day-detail card. Clickable events jump back to their source
  page (purchases scroll to the exact row). On mobile the filter list
  lives in a slide-up sheet opened from the page-header chip.
- **관리** — admin page for the email allowlist + user roles.
- **⌘K** — global search palette across memo (title + body) and sheet
  (title) results. Opens via `⌘K` / `Ctrl+K`, via the search chip in
  the desktop TopNav, or via the 검색 item in the mobile BottomNav.
  Keyboard-navigable; Enter opens the result, Esc closes.

iPhone-aware: the workspace collapses to single pane, mobile back
buttons drop you out of the editor, a slide-up sheet exposes the
sidebar's tag filters from the list header, touch targets are ≥44px,
and the iOS keyboard reflows the layout via
`interactive-widget=resizes-content`.

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict)
- **React Router v7** with layout routes (`<MobileShell>` adds bottom
  nav + safe-area padding under all protected routes) and `React.lazy`
  for every non-trivial page
- **TanStack Query** for server state; **axios** for HTTP with a bearer
  interceptor + 401 → /login redirect
- **Tiptap v3** for the memo editor (`@tiptap/starter-kit`, `image`,
  `link`, `placeholder`, `task-list`, `table`, `@tiptap/suggestion` for
  the slash menu, plus custom `Tag` mark and `SlashCommand` extension).
  Bubble menu via `@tiptap/react/menus` — hidden on touch.
- **react-data-grid v7** for the sheet editor and the purchase grid
- **react-day-picker v10** with a custom `DayButton` for the calendar
- **Radix Primitives** (selective): `@radix-ui/react-dialog` for
  modals, the mobile tags drawer, and the calendar's mobile filter
  sheet; `@radix-ui/react-dropdown-menu` for the kebab `…` menu on
  notes and sheets. Wrapped in `components/ui/ConfirmDialog.tsx`,
  `components/ui/Menu.tsx`, and the shared `components/common/
  AppSidebar` + `AppSidebarSheet`. No Tailwind, no shadcn-style mass
  import.
- **jwt-decode** to read claims from the issued JWT
- **Plain CSS Modules** per component; tokens-based design system
  in `src/components/ui/`. No Tailwind, no CSS-in-JS runtime.

## Repo layout (frontend)

```
src/
├── api/                        # axios client + shared QueryClient
├── auth/                       # authContext / AuthProvider / useAuth (split 3 files)
├── components/
│   ├── ui/                     # design system (CSS Modules + tokens.css)
│   │                           # primitives + ConfirmDialog + Menu wrappers
│   └── common/                 # MobileTable, MobileShell, TopNav, BottomNav
├── features/
│   ├── notes/                  # ★ memo: api + workspace/sidebar/list/editor/shared
│   │   └── editor/extensions/  #   custom Tiptap: Tag mark, SlashCommand
│   ├── sheets/                 # ★ sheet: same shape — workspace/list/editor/shared
│   ├── purchases/              # 💰 purchases + settlement + recurring + category chart
│   ├── todos/
│   ├── anniversaries/
│   └── calendar/               # aggregator hook (4 event sources)
├── lib/
│   ├── format.ts / color.ts
│   └── useMediaQuery.ts        # useIsDesktop / useIsMobile / useIsTouch
├── pages/                      # Hub (notes), SheetsPage, DataHub, CalendarPage,
│                               # Login, AuthCallback, Forbidden, NotFound, Admin
└── App.tsx                     # routes + Suspense
```

## Run locally

```bash
npm install
npm run dev               # http://localhost:5173 (Vite)
```

Set `VITE_API_BASE_URL` in `.env.development` to point at a backend
(`http://localhost:8090` for local; the production env var on Vercel is
`https://docs-api.markflowing.com`).

Backend lives in the sibling repo `shared-docs-backend`. For local
end-to-end work, run `./gradlew bootRun` there and the
`SPRING_PROFILES_ACTIVE=local` profile exposes a `POST /api/auth/dev-login`
that issues a JWT for any allowlisted email without going through
Google.

## Build

```bash
npm run build             # tsc -b && vite build → dist/
```

Vercel uses this same command. The build bakes `VITE_API_BASE_URL`
into the bundle, so a deploy after changing the env var is required
for prod to pick it up.

Bundle shape (gzip): main ≈ 64 kB · Hub chunk (Tiptap-heavy) ≈ 147 kB
on first visit to `/` · CalendarPage ≈ 23 kB · SheetsPage ≈ 5 kB
(react-data-grid shared with PurchaseList).

## Backend & deployment

The backend repo (`valorjj/shared-docs-backend`) handles:
- Google OAuth2 + JWT issuance
- All `/api/**` data endpoints (notes, attachments, sheets, purchases,
  settlements, recurring purchases, todos, anniversaries, calendar
  aggregator, comments, admin)
- `/files/{storedFilename}` serves note attachments from a Docker
  volume (`./uploads:/app/uploads`); UUID filenames + Cloudflare
  Tunnel act as the perimeter, not auth
- A self-hosted GitHub Actions runner on the Mac Mini that
  builds + redeploys via Docker Compose on every push to `main`

A Cloudflare Tunnel routes `docs-api.markflowing.com` → `localhost:8090`
on the Mac Mini.

Two blueprints in `shared-docs-backend/docs/` document the architecture
and roadmap:

- `AUTH_BLUEPRINT.md` — Google OAuth, JWT, allowlist, admin model
- `SCALING_BLUEPRINT.md` — feature roadmap + implementation log (latest
  entries cover the memo + sheet workspaces, Bear sidebar for
  `/data` and `/calendar`, the `#tag` input-rule fix, and the
  chrome refinement pass)

## Conventions

- All UI text is in Korean.
- TypeScript strict mode.
- **Aesthetic**: Bear is the reference. Hairlines, no shadows, generous
  spacing, monochrome warm palette with `--c-accent` (Bear-red) used
  *sparsely* — selection rail, pinned glyph, active sidebar item,
  hashtag pills. The rule is codified at the design-system level:
  `Card.module.css` has no `box-shadow`, `Badge` has no `icon` prop,
  and only the `Fab` / Radix-floating surfaces (Menu, Modal,
  ConfirmDialog) carry shadows because they are *floating*, not
  *lifted*.
- **Buttons**: `variant="primary"` (solid navy) is reserved for actions
  that actually mutate data (e.g. the inline-add "저장" on the
  purchase grid). Navigation / enter-mode actions are `outline`,
  secondaries are `ghost` / `soft`. Most screens have zero or one
  navy button.
- **Icons**: Lucide only in chrome. Emojis are fine in user-authored
  content (note bodies, comments) but never as UI icons. The
  `Category.icon` field in the backend still stores an emoji string,
  but the frontend deliberately ignores it everywhere.
- **Components**: many small single-purpose files, each with its own
  `.module.css`. A "list item" is one file, not a section of a 600-line
  component. Micro-tuning lands in one place.
- New code uses the shared primitives in `src/components/ui/` — don't
  hand-roll a new button or input. Tokens live in `tokens.css`.
- One feature = one folder under `src/features/` with `api.ts` +
  `types.ts` + a tight component tree. Backend mirrors with one Kotlin
  package per feature.
- BigDecimal money + ISO 4217 currency code per row; `formatMoney()`
  from `src/lib/format.ts` wraps `Intl.NumberFormat('ko-KR', { currency })`.
- No global state library — React state + TanStack Query cache.
- No setState inside `useEffect` (ESLint `react-hooks/set-state-in-effect`
  is on). Use `useSyncExternalStore` for subscriptions, derived state
  for prop reset, the wrapper + keyed inner pattern for "reset form on
  open" — see any of the three `*Form.tsx` files, or `NoteEditorTitle`
  re-keyed by `note.id`, for the canonical shape.

## Cross-feature routing tricks

- **Memo**: `/?note=N` — activate that note (URL is the source of
  truth; mobile back button just clears the param).
- **Sheet**: `/sheets?sheet=N` — same pattern.
- **Purchases**: `?month=YYYY-MM` (month filter source of truth),
  `?date=YYYY-MM-DD` (opens add modal pre-filled), `?edit=N` (opens
  edit modal once rows load), `?row=N` (scrolls grid + 1.8s pulse).
- **Todos / Anniversaries**: `?date=YYYY-MM-DD`.

The calendar uses these to make every event clickable: clicking a
purchase event lands on `/data/purchases?month=...&row=...`, scrolls,
and pulses.
