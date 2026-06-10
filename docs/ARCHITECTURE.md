# Architecture

> Last revised: 2026-05-29 (Phase 2 ship — added `calc/` feature). Visual rules live in [`DESIGN.md`](DESIGN.md); product scope lives in [`VISION.md`](VISION.md).
>
> ⚠️ **STALE for v2 (2026-06-10):** this doc describes the v1 single-workspace baseline. It does **not** reflect the shipped multi-tenant v2 — workspace scoping via `X-Workspace-Id`, invitations, cross-workspace note sharing, or the Decisions pillar. For current architecture use [`plans/2026-05-29-multi-tenant-v2.md`](plans/2026-05-29-multi-tenant-v2.md) (as-built spec) + the per-phase plans in `plans/`, and the feature table in [`../CLAUDE.md`](../CLAUDE.md). A full rewrite of this file is a pending follow-up.

## 1. Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 19 + TypeScript + CSS Modules |
| Editor | Tiptap v3 (StarterKit, Table, Highlight, custom extensions) |
| Data fetching | TanStack React Query + Axios |
| Routing | React Router v6 |
| State | Local component state + React Query cache. No Redux/Zustand. |
| Forms | Native HTML + React state. No form library. |
| Backend | Spring Boot 3.5 + Kotlin |
| Persistence | MariaDB (`shared_docs` DB, port 3307 host) |
| Migrations | Hibernate `ddl-auto: update` + `columnDefinition` defaults |
| Auth | Google OAuth2 → JWT (24h) → `Authorization: Bearer` header |
| Files | UUID-named on disk, served public at `/files/{name}` |
| Deploy | Vercel (frontend) + Cloudflare Tunnel → Mac Mini Docker (backend + DB) |

## 2. Frontend folder layout

```
shared-docs/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── VISION.md / ROADMAP.md / ARCHITECTURE.md / DESIGN.md
│   ├── plans/                          ← per-phase implementation plans
│   └── investment/                     ← personal content (not project docs)
├── public/
└── src/
    ├── api/
    │   ├── client.ts                   ← axios + Bearer + 401→/login
    │   ├── queryClient.ts              ← shared QueryClient
    │   ├── admin.ts                    ← admin endpoints
    │   └── comments.ts                 ← latent (unused since 2026-05 reset)
    ├── auth/
    │   ├── authContext.ts / AuthProvider.tsx / useAuth.ts / tokenStorage.ts
    │   └── RequireAuth.tsx / RequireRole.tsx
    ├── components/
    │   ├── ui/                         ← shared design system
    │   │   ├── tokens.css / themes.css ← see DESIGN.md
    │   │   ├── Page / BackLink / Card / Stack / Row / Section
    │   │   ├── Field / Label / Hint / ErrorText
    │   │   ├── Input / Select / Textarea / Checkbox
    │   │   ├── Button / IconButton / Fab
    │   │   ├── Badge / Kbd / Modal / Tabs
    │   │   ├── ConfirmDialog (Radix Dialog) / Menu (Radix DropdownMenu) / ContextMenu
    │   │   └── index.ts (barrel)
    │   └── common/                     ← responsive layout primitives
    │       ├── AppSidebar / AppSidebarSheet
    │       ├── MobileShell / TopNav / BottomNav
    │       └── MobileTable
    ├── features/                       ← 1 folder = 1 feature
    │   ├── notes/                      ← memo (Tiptap-based)
    │   │   ├── api.ts / types.ts
    │   │   ├── workspace/              ← 3-pane shell
    │   │   ├── sidebar/                ← AppSidebar content
    │   │   ├── list/                   ← middle pane
    │   │   ├── editor/                 ← right pane + Tiptap extensions
    │   │   └── shared/                 ← formatters, tag extraction
    │   ├── sheets/                     ← 2-pane spreadsheet (frozen — see ROADMAP)
    │   ├── calc/                       ← /calc — tape + 5 modes + CalcSnapshot embed
    │   │   ├── compute/                ← pure per-mode functions (basic/installment/loan/dutch/date)
    │   │   ├── modes/                  ← per-mode UI (BasicMode, InstallmentMode, etc.)
    │   │   ├── tape/                   ← TapeView + TapeLine + TapeEmpty
    │   │   └── embed/                  ← CalcSnapshot Tiptap atom + Card + Picker
    │   ├── snapshots/                  ← DataSnapshot block atom
    │   ├── settings/                   ← theme / font / line-height
    │   ├── search/                     ← ⌘K palette
    │   ├── purchases/                  ← 구매 + 정산 + 반복 항목 (deferred)
    │   ├── todos/ anniversaries/       ← stable
    │   ├── links/ recipes/             ← stable
    │   └── calendar/                   ← 4-source aggregator
    ├── lib/
    │   ├── format.ts                   ← formatMoney / monthBounds / formatShortDate
    │   ├── color.ts                    ← hexWithAlpha
    │   └── useMediaQuery.ts            ← useIsDesktop / Mobile / Touch
    ├── pages/
    │   ├── Hub.tsx                     ← '/' — NoteWorkspace (lazy)
    │   ├── SheetsPage.tsx              ← '/sheets' (lazy)
    │   ├── DataLayout.tsx              ← '/data' nested layout
    │   ├── CalendarPage.tsx            ← '/calendar' (lazy)
    │   ├── Admin.tsx / Login.tsx / AuthCallback.tsx / Forbidden.tsx / NotFound.tsx
    └── App.tsx                         ← routing + Suspense
```

## 3. Backend folder layout

```
shared-docs-backend/
└── src/main/kotlin/com/shareddocs/backend/
    ├── note/           ← Note + Attachment + FileStorage + EntityRef indexer
    ├── calc/           ← CalcEntry — shared tape ledger; client-side math
    ├── sheet/          ← Sheet entity (frozen)
    ├── purchase/       ← Purchase + SplitMode + Category (deferred)
    ├── settlement/     ← 정산 (deferred)
    ├── recurring/      ← 반복 항목 (deferred)
    ├── todo/           ← Todo + Category
    ├── anniversary/    ← Anniversary + Category
    ├── calendar/       ← 4-source aggregator
    ├── search/         ← EntitySearchService — unified entity search
    ├── comment/        ← latent (no controller wired)
    ├── user/ admin/ auth/ config/
```

## 4. Layering & boundaries

The backend follows a strict 4-layer pattern per feature:

```
Controller  → REST endpoint, request/response DTOs only, calls Service.
Service     → Business logic, transaction boundaries, owns the entity lifecycle.
Repository  → Spring Data JPA queries. No business logic.
Entity      → JPA-annotated domain. Immutable IDs, `var` mutable fields, lazy associations.
```

**Rules:**
- Controllers never touch repositories.
- Services own all `@Transactional` boundaries.
- Repositories return entities; controllers receive DTOs. Service does the mapping.
- No service-to-service circular dependency. If discovered, use `@Lazy` injection (existing example: `PurchaseService` ↔ `RecurringPurchaseService`).

## 5. Authentication flow

1. User hits a protected route → `RequireAuth` detects missing token → redirects to `/login`.
2. "Google로 로그인" → `${VITE_API_BASE_URL}/oauth2/authorization/google`.
3. Google → `/login/oauth2/code/google` (Spring handles).
4. `OAuth2SuccessHandler` checks allowlist → upserts `users` row → issues JWT → redirects to `${FRONTEND_URL}/auth/callback#token=<jwt>`.
5. `AuthCallback` reads fragment → stores in localStorage → navigates to `/`.
6. Axios interceptor (`api/client.ts`) attaches `Authorization: Bearer <jwt>` to every `/api/**` request.
7. `/files/**` is `permitAll` — auth bypassed (UUID-based obscurity + Cloudflare Tunnel).

**Dev shortcut:** `POST /api/auth/dev-login` issues a JWT without Google, scoped to a dev profile.

## 6. Entity & permission pattern

Every shared entity follows this pattern:

| Aspect | Rule |
|---|---|
| Read | Authenticated user (both allowlisted users see everything by default) |
| Write | Author only (compared by `createdBy.userId === currentUser.userId`) |
| Delete | Author or ADMIN |
| Soft-delete | `deletedAt: Instant?` — set, not removed; `/restore` clears, `/forever` hard-deletes |

The **only deviation** (incoming in Phase 1) is `Note.visibility`: a PRIVATE note is invisible to the non-author even though both users are authenticated. See `plans/2026-05-28-personal-shared-notes.md` for the predicate.

## 7. Cross-entity references

Notes can `@`-mention other entities. The wire format is a Tiptap atom:

```html
<span data-type="entity-link"
      data-kind="note|sheet|purchase|todo|anniversary|recipe|link"
      data-id="123"
      data-title="원본 제목">
```

Backend side:

- `EntityRefIndexer` parses the body on save (JSoup) and writes rows to `entity_refs (from_note_id, to_kind, to_id, PK)`.
- `EntityRefService` answers "what notes reference X?" — used by `NoteReferrers` panel above the editor.
- Legacy `note_links` table is dropped after Phase 1 stability cycle.

After Phase 3 ships, `to_kind` extends with `'plan'`, `'subplan'`, `'option'`, `'decision'`. The indexer is kind-agnostic — only the existence-check needs new repository wiring.

## 8. Data flow patterns

### Memo body autosave
- Edit body → 600ms debounce → `PATCH /api/notes/:id { body }`
- Edit title → on blur → `PATCH /api/notes/:id { title }`
- Flush on note switch / unmount

### Calendar
- Aggregates 4 sources server-side: anniversaries (recurring annually), todos (with due dates), purchases (by purchase date), settlements (by settlement date).
- Returns a flat array of `{ date, kind, refId, title, color }`. Frontend groups and renders.
- Phase 3 adds `kind: 'decision'` to the source list.

### ⌘K search
- Client-side over `useNotes()` + `useSheets()` cache data — no server search call.
- Notes match on title + HTML body (DOMParser strips tags).
- Sheets match on title only (cell-level search is a deferred enhancement).
- Phase 1 adds a defensive visibility filter so cached entries can't leak.

### Calculator (`/calc`)
- All math runs **client-side**; the backend `calc/` package is a ledger that stores immutable `CalcEntry` rows (mode + input JSON + result JSON + label + pinned).
- Tape is shared between both partners — no visibility filter; same household-shared model as everything except notes.
- BASIC mode is a multi-line Soulver-style scratchpad: `# comments`, `name = expr` assignments flow variables downward, errors are line-scoped. Live evaluation on every keystroke via `expr-eval`. The scratchpad persists in `localStorage` between sessions; only explicit 저장 writes a `CalcEntry`.
- Click any tape row → loads that entry into the matching mode's editor. The mode component is keyed on `seedEntry?.id ?? 'fresh'` (wrapper + keyed inner) so its `useState` initializers re-run cleanly. Save while a seed is loaded creates a **new** entry — tape entries are immutable.
- `CalcSnapshot` Tiptap atom mirrors `DataSnapshot` 1:1: same `data-*` JSON round-trip, same refresh-kebab, tombstone on source delete. Embedded in notes via the slash menu (`/계산 스냅샷`).

## 9. File uploads

- `POST /api/files/upload` — multipart, returns `{ url: "/files/{uuid.ext}" }`. Used by recipes (hero images) and generic file picker.
- `POST /api/notes/:id/attachments` — note-scoped, returns full `Attachment` record with FK. Used by editor drag/paste.
- Storage: `app.storage.upload-dir` (`./uploads` local, `/app/uploads` in Docker).
- Multipart limits: 20 MB file, 25 MB request.
- Image attachments are client-gated to 5 MB (`MAX_IMAGE_BYTES` in `notes/api.ts`).

## 10. Deployment

```
                   ┌──────────────────────┐
   developer  ───→ │   GitHub main push   │
                   └──────────┬───────────┘
                              ↓
              ┌──────────────────────────────────┐
              │ self-hosted Actions runner (Mac) │
              │  ./gradlew bootJar                │
              │  docker build  + compose up -d   │
              │  /actuator/health check          │
              └──────────────────────────────────┘
                              ↓
              ┌──────────────────────────────────┐
              │  Cloudflare Tunnel → Mac Mini    │
              │  api.shared-docs / app endpoints │
              └──────────────────────────────────┘

   Vercel  ←  shared-docs-nine.vercel.app  (frontend, npm run build)
```

- Backend container: `restart: unless-stopped`. MariaDB volume + `uploads` volume both persist across `docker compose up -d --force-recreate`.
- Schema migrations: `ddl-auto: update` handles nullable additions automatically. NOT NULL columns require `columnDefinition` with `DEFAULT`. Manual SQL is only needed for renames / drops.

## 11. Conventions

| Topic | Rule |
|---|---|
| All UI text | Korean |
| Icons | Lucide only — never OS emoji as chrome (users can write emoji in note body) |
| Comments | Default: none. Only write when the *why* is non-obvious (hidden constraint, subtle invariant, workaround) |
| File size | Prefer small, focused files. One component per file. CSS Module next to the component |
| State | useState / useReducer / React Query cache. No Redux/Zustand |
| Forms | Native HTML + React state. No formik / react-hook-form |
| Routes | Code-split with `React.lazy` for feature pages. Eager only for auth / 404 |
| Mobile | Mobile-first; desktop overrides via `@media (min-width: 768px)`. ≥44×44 touch targets |
| URL ↔ state | Derive state from `useSearchParams` directly — no `useState` copy |
| Wrapper + keyed inner | Forms that take an initial-value prop must use `key=` to remount; never `setState` in effect. Canonical examples: `NoteEditorTitle` re-keyed by note id; the 5 calc mode components re-keyed by `seedEntry?.id ?? 'fresh'` in `CalcWorkspace` when the user clicks a tape row |

## 12. ESLint-enforced anti-patterns

- `react-hooks/set-state-in-effect` — no `setState` inside `useEffect`
- `react-hooks/refs` — no ref writes during render
- `react-hooks/immutability` — no in-place mutation of state
- `@typescript-eslint/no-this-alias` — destructure `this` in Tiptap extension methods, never alias

## 13. Performance posture

- Initial main bundle: ~200 kB / 64 kB gzip
- `Hub` chunk (NoteWorkspace + Tiptap full): ~545 kB / 167 kB gzip — loaded only on `/`
- `SheetsPage`: ~61 kB
- `CalendarPage`: ~79 kB
- New features must add their own `React.lazy` boundary if they introduce a heavy dependency

Bundle health check: after a feature ships, run `npm run build` and check the chunk-size delta. New Tiptap extensions are the usual culprit.

## 14. Visibility leakage surfaces (Phase 1 follow-up)

After the personal/shared notes split lands, document any places where a PRIVATE note's existence could leak to the non-author:

- (To be filled in during Phase 1 implementation.)
