# CLAUDE.md

> Project bible. Last revised: 2026-07-08 — multi-tenant v2 (Phases A–F) **shipped to production**, the full Decisions backlog, the post-v2 multi-calendar direction, **real-time collaborative editing on shared notes**, **real-time collaboration on the Decisions pillar** (shipped to production 2026-07-07), and the **sub-decision tree (Life Story Board Phase 1, 2026-07-08)** are all **shipped**. **Open Google sign-up is already live** — the rebuild removed the email allowlist; there is no gate to flip. Going public = sharing the URL.
>
> **2026-07-08 shipped:** **Sub-decision tree (Life Story Board Phase 1).** A 계획 can now nest under a parent 계획 (`plans.parent_plan_id`, Flyway **V23**): root-only 결정 board, `GET /api/plans/{id}/hierarchy` (ancestors + live subtree + counts), 하위결정 card section, breadcrumb + zoom-in navigation, floating tree navigator, canvas sub-decision pill nodes, 안건→하위결정 promotion (`POST /api/subplans/{id}/promote` — 선택지+투표 move via native re-point), subtree-cascading 휴지통/영구삭제, `SUBDECISION_ADDED/REMOVED` + `SUBPLAN_PROMOTED` timeline events. Phases 2 (자료+댓글 community section) and 3 (스토리 뷰) are designed but unbuilt. Design/plan: `docs/plans/2026-07-08-life-story-board-design.md` + `2026-07-08-sub-decision-tree-plan.md`.
>
> **2026-07-07 shipped to production:** **Real-time collaboration on Decisions.** Because Decisions data is server-authoritative (MariaDB + optimistic locking), this is **not** Yjs-on-the-data: after every Decisions write commits, a Spring `@TransactionalEventListener(AFTER_COMMIT)` broadcasts a `{"planId":…}` frame over a listen-only WS `/ws/decisions/{workspaceId}`, and each client re-runs its existing `decisionKeys.scope(wsId)` React Query invalidation (invalidate-on-reconnect makes it self-healing). Presence (who's viewing a plan) is a separate Yjs-**awareness** channel `/ws/plans/{planId}` (empty Y.Doc) + an avatar stack. Both reuse a **shared collab transport seam** (`com.shareddocs.backend.collab`: `RoomKey`/`CollabRoomRegistry`/`BlindRelayHandler`/`JwtQueryTokenInterceptor`) onto which the **shipped notes relay was retrofitted** — one real-time subsystem, not three handlers. Cross-instance fan-out is deliberately deferred (single Mac Mini; the distributed ladder lives in the separate `shared-doc-yjs` lab). Backend suite green (226 tests); FE gates green. Discussion-note collab is a documented, unbuilt severable follow-up. Design/plan: `docs/plans/2026-07-07-decisions-realtime-collab-{design,plan}.md`.
>
> **2026-07-02 shipped:** **Real-time collaborative editing on shared notes** — Yjs CRDT via a protocol-blind Spring WebSocket relay (`/ws/notes/{noteId}`), ephemeral session sync (no permanent Yjs state — `Note.body` persistence via the existing debounced PATCH is unchanged). Live colored cursors (custom extension wrapping `@tiptap/y-tiptap`'s `yCursorPlugin` — the official cursor package is incompatible with this Tiptap version) + an avatar stack of who's currently viewing. Also fixed a prerequisite gap: `NoteService.update()` was author-only for every note, even WORKSPACE-visibility ones — any active workspace member can now edit a WORKSPACE note's title/body/pinned (PRIVATE notes and visibility changes stay author-only). This reverses VISION.md's "not a real-time CRDT editor" line — see the amendment there. Design/plan: `docs/plans/2026-07-02-realtime-collaboration-{design,plan}.md`.
>
> **2026-06-19 shipped:** **Cross-workspace calendar overlay** (전체 워크스페이스) — toggle to overlay every workspace's calendar in one view, per-workspace filter chips, workspace label on events, click-to-switch-active-workspace. `GET /api/calendar/events/all` (membership-enforced merge). This was VISION.md's "sweet spot" post-v2 direction — built ahead of schedule. Design/plan: `docs/plans/2026-06-19-cross-workspace-calendar-{design,plan}.md`.
>
> **2026-06-15 shipped, deployed:** (1) Decisions **deadlines (기한, backlog A.4)** — date-only deadline on 계획/안건 with a live D-day chip + frozen "기한 내/지나 결정·완료" annotation; lock-guarded set/clear endpoints recording `DEADLINE_SET`/`DEADLINE_CLEARED` timeline events; added `Plan.completedAt`. Flyway **V22**. Design/plan: `docs/plans/2026-06-15-decisions-deadlines-{design,plan}.md`. (2) **PlanDetail redesign** — document-column layout, sticky control strip with condensed title on scroll, mobile FAB/top-pinned-strip shape, discussion rail placement. Design/plan: `docs/plans/2026-06-15-plan-page-redesign-{design,plan}.md`.
>
> **2026-06-12 shipped:** Decisions **backlog B.5/B.6 — vote mode + discussion pane.** `OptionVote` entity (Flyway V20) with cast/move/retract + lock/decided guards, vote tally snapshot frozen onto `Decision` at 확정; lazy 1:1 plan discussion note (Flyway V21) as a slim discussion rail, entity-link chip kinds for 계획/안건/선택지 + deep-link landing. **This completed the entire Decisions backlog** — see `docs/plans/decisions-backlog.md`. Design/plan: `docs/plans/2026-06-11-plan-discussion-vote-{design,plan}.md`.
>
> **2026-06-11 shipped:** (1) Decisions **list-view connections + drag-reorder** — an order-spine, hover-highlight, a 연결 modal, and `@dnd-kit` reorder backed by a batch `sortOrder` endpoint. (2) **Abuse protection** — a per-user write-throttle (Bucket4j), per-user upload quota, and a global upload-dir disk guard. (3) Decisions **plan lock (A.1)** and **complete/discard (A.2/A.3)** — see `docs/plans/decisions-backlog.md`. Designs/plans in `docs/plans/2026-06-10-decisions-list-spine-*`, `docs/plans/2026-06-11-rate-limiting-abuse-*`, `docs/plans/2026-06-11-plan-lock-*`, `docs/plans/2026-06-11-plan-complete-discard-*`.

## What this is

A multi-tenant shared workspace app for small groups (couples, families, friend circles, hobby clubs). One user belongs to many workspaces. Within a workspace, data is shared by default; PRIVATE notes are author-only. Cross-workspace per-doc shares let you grant individual documents to specific outsiders.

The multi-tenant v2 rebuild (Phases A–F) is **complete and deployed** as of 2026-06-10 — `main` is the live v2 codebase. The architecture spec is [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md); each phase has its own dated design+plan in `docs/plans/`. Open Google sign-up is **already live** — the v2 rebuild removed the old email allowlist (no `APP_AUTH_ALLOWLIST_ENABLED` gate exists in the code). Any Google account is accepted; only `active=false` accounts are rejected. Making it public is just sharing the URL.

The product, inside any workspace, has four pillars:

1. **Personal notebook** (PRIVATE notes — already implemented)
2. **Shared notebook** (Bear-style memo — already implemented)
3. **Decisions** (Plan → SubPlan → Option → Decision; **shipped 2026-06** — React Flow canvas + roadmap board + timeline/feed + full lifecycle/vote/discussion backlog, see below)
4. **Calculator** (tape-style engineering calc — already implemented)

The multi-calendar overlay (work + family + hobby in one view) **shipped 2026-06-19** — see feature table below. Read [`docs/VISION.md`](docs/VISION.md) for the full why, [`docs/ROADMAP.md`](docs/ROADMAP.md) for the v2 phase order.

## Repo layout

```
shared-docs-root/
├── shared-docs/           ← this repo (frontend)
│   ├── CLAUDE.md          ← you are here
│   ├── docs/
│   │   ├── VISION.md      ← multi-tenant framing, 4 pillars, not-list
│   │   ├── ROADMAP.md     ← v2 phases A-F + post-v2
│   │   ├── ARCHITECTURE.md← v1 baseline; will be updated as v2 lands
│   │   ├── DESIGN.md      ← visual identity, tokens, Bear rules
│   │   ├── plans/         ← per-phase implementation plans
│   │   │   └── 2026-05-29-multi-tenant-v2.md   ← active spec
│   │   └── investment/    ← personal content (not project docs)
│   └── src/
└── shared-docs-backend/   ← separate repo (Spring Boot + Kotlin)
```

## Branch strategy

- `main` — the live v2 codebase. Production deploys from here (frontend → Vercel; backend → CD on push to the Mac Mini runner, which applies Flyway).
- Feature work branches off `main` (e.g. `phase-e-sharing`), merges back via `--no-ff`, then deploys. The old long-lived `v2-multi-tenant` branch is retired — v2 was merged to `main` at cutover.

## Stack at a glance

- **Frontend:** Vite + React 19 + TypeScript + CSS Modules. Tiptap v3 for the editor. React Query for data. React Router v6.
- **Backend:** Spring Boot 3.5 + Kotlin. JPA + MariaDB (port 3307 host). **Flyway owns the schema** (latest V23); Hibernate `ddl-auto: validate` (asserts entities match the migrated schema, never mutates it).
- **Auth:** Google OAuth2 → JWT (24h). **Open sign-up — any Google account is accepted.** The v2 rebuild removed the old `allowed_emails` allowlist; there is **no** `APP_AUTH_ALLOWLIST_ENABLED` gate in the code. Only deactivated accounts (`User.active=false`) are rejected at login. `app.auth.bootstrap-admins` promotes listed emails to admin on sign-in.
- **Deploy:** Vercel (frontend) + Cloudflare Tunnel → Mac Mini Docker (backend + DB + uploads volume).

Full details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (note: v1 baseline; v2 changes will land as Phase A merges).

## Daily-use commands

### Frontend (`shared-docs/`)
```bash
npm run dev               # localhost:5173
npm run build             # production build → dist/
npx tsc -b --noEmit       # type-check — MUST use -b (root tsconfig is a references stub; plain `tsc --noEmit` checks ZERO files and falsely passes)
npx eslint src/           # lint  ·  `npm run build` is the authoritative gate
```

### Backend (`shared-docs-backend/`)
```bash
./gradlew bootRun         # local — needs MariaDB on :3307
./gradlew test            # run JUnit tests
./gradlew build -x test   # build without tests
./gradlew bootJar         # produce executable JAR
```

Docker: `docker-compose.yml` orchestrates app + MariaDB. Profiles: `local` (DB on localhost:3307), `docker` (DB via host.docker.internal).

Dev shortcut: `POST /api/auth/dev-login` returns a JWT bypassing Google.

## Day-to-day rules (the ones that matter every commit)

These survive the v2 rebuild because they're orthogonal to scope:

1. **All UI text in Korean.** No English chrome.
2. **Lucide icons, never emoji.** Emoji rendering depends on OS; users can write emoji in their note body, but the chrome cannot.
3. **CSS Modules + tokens.** No Tailwind, no styled-components, no hardcoded hex. See [`docs/DESIGN.md`](docs/DESIGN.md).
4. **One primary button per screen.** Browse / navigate / add are `outline`. The single primary is for the screen's one commit action.
5. **Card never lifts.** Hairline border + `--c-surface-tint` hover. Shadow is for floating surfaces only.
6. **No setState in effect.** Derive from `useSearchParams`, or use the wrapper+keyed-inner pattern for forms with `initial` props. Canonical examples: `NoteEditorTitle` re-keyed by `note.id`; calc mode components re-keyed by `seedEntry?.id ?? 'fresh'` in `CalcWorkspace`.
7. **No backwards-compat shims, no feature flags.**
8. **Comments default to none.** Only write a comment when the *why* is non-obvious.

Once v2 lands, every API endpoint also requires:

9. **Every workspace-scoped query filters by `currentWorkspace.id`.** No exceptions. This is the bug we're designing against.
10. **Resource ownership is per-workspace.** A note belongs to exactly one workspace; cross-workspace access goes through `ResourceShare`, never through "the recipient sees it in their workspace list."

ESLint enforces 1–6 mechanically. The rest is review discipline.

## Feature status (v2 — all shipped & deployed)

| Feature | State |
|---|---|
| Memo (Personal/Shared) | **Shipped.** `Note.visibility` ∈ {PRIVATE, WORKSPACE}; workspace-scoped. |
| Sheets | **Shipped.** Workspace-scoped. |
| 구매 / 정산 / 반복 항목 | **Shipped.** Workspace-scoped + per-workspace categories. |
| 할 일 / 기념일 / 링크 / 레시피 | **Shipped.** Workspace-scoped. |
| Calendar | **Shipped.** Workspace-scoped 4-source aggregation. Multi-calendar overlay is post-v2. |
| Calculator | **Shipped.** Workspace-scoped tape. |
| Settings, Auth, Search palette | **Shipped.** OAuth + first-sign-in workspace bootstrap. |
| Workspaces / Memberships (Phase A–B) | **Shipped.** `X-Workspace-Id` scoping, switcher, create/settings. |
| Per-workspace categories (Phase C) | **Shipped.** |
| Invitations (Phase D) | **Shipped.** Copy-link claim flow (no email), member management. |
| Per-doc sharing / "공유받은 항목" (Phase E) | **Shipped 2026-06-10.** Notes-only slice on a generic `resource_shares` core; VIEW/EDIT; separate `/api/shares/*` path. |
| Decisions (Pillar 3) | **Shipped 2026-06, backlog fully drained by 2026-06-19.** Plan→SubPlan→Option→Decision; canvas, roadmap board, timeline/feed. **List view (2026-06-11):** order-spine (sortOrder), connection accent layer (chips + hover-highlight), 연결 modal to wire edges, drag-reorder via `@dnd-kit` + batch `PATCH /api/plans/{id}/subplans/order`. **Lock + complete + discard (2026-06-11):** freeze/read-only, ACTIVE\|COMPLETED status, soft-delete 휴지통. **Vote + discussion (2026-06-12):** `OptionVote` tally (cast/move/retract, frozen snapshot at 확정), lazy 1:1 discussion note per plan, entity-link chips + deep-links. **Deadlines (2026-06-15, deployed):** date-only `deadline` on 계획/안건 + `Plan.completedAt` (Flyway V22), `DeadlineChip` (live D-day + frozen 기한 내/지나 annotation), lock-guarded `PUT/DELETE /api/plans/{id}/deadline` + `/api/subplans/{id}/deadline` recording `DEADLINE_SET`/`DEADLINE_CLEARED` events. **PlanDetail redesign (2026-06-15):** document-column layout, sticky control strip, mobile FAB shape. See `docs/plans/decisions-backlog.md` (now closed). |
| Launch polish (Phase F) | **Shipped 2026-06-10.** Privacy/Terms pages, split landing, fresh-workspace welcome. |
| Abuse protection / rate-limiting | **Shipped 2026-06-11.** Per-user write-throttle (`RateLimitFilter`, Bucket4j in-memory, 429 + Retry-After, off in `test` profile), per-user upload quota (413 over `app.storage.per-user-quota-bytes`, 500MB), global upload-dir disk guard in `FileStorageService.store()` (413 over `app.storage.total-quota-bytes`, 10GB). **Deferred:** Cloudflare edge rules + signup/workspace caps. |
| Open public sign-up | **Already live** — no allowlist gate in code (removed in the rebuild). Going public = share the URL. |
| Multi-calendar overlay | **Shipped 2026-06-19.** 전체 워크스페이스 toggle overlays every workspace's calendar, per-workspace filter chips, `GET /api/calendar/events/all` (membership-enforced). |
| Decisions 하위결정 tree (Life Story Board Phase 1) | **Shipped 2026-07-08.** `plans.parent_plan_id` (V23), root-only board, subtree trash cascade, hierarchy endpoint, 하위결정 section + breadcrumb + zoom navigation + floating tree navigator + canvas nodes, 안건→하위결정 promotion. Phases 2 (자료+댓글) & 3 (스토리 뷰) pending. Design/plan: `docs/plans/2026-07-08-life-story-board-design.md` + `2026-07-08-sub-decision-tree-plan.md`. |
| Real-time collaborative editing on shared notes | **Shipped 2026-07-02.** Yjs CRDT via a protocol-blind Spring WebSocket relay (`/ws/notes/{noteId}`); ephemeral session sync, `Note.body` persistence unchanged. Live colored cursors + avatar stack. Fixed a prerequisite gap where non-authors couldn't edit WORKSPACE notes at all. Design/plan: `docs/plans/2026-07-02-realtime-collaboration-{design,plan}.md`. |

## Routes

| Path | Page | Auth | Lazy |
|---|---|---|---|
| `/login`, `/auth/callback` | Login / AuthCallback | public | no |
| `/invite/:token` | InviteClaim | public | yes |
| `/privacy`, `/terms` | LegalPage | public | yes |
| `/` | NoteWorkspace (Hub) | required | yes |
| `/sheets` | SheetsPage | required | yes |
| `/data` + `/data/{purchases,todos,anniversaries,links,recipes,recipes/:id}` | DataLayout + sub-pages | required | yes |
| `/calendar` | CalendarPage | required | yes |
| `/calc` | CalcWorkspace | required | yes |
| `/decisions`, `/decisions/:planId` | DecisionList / PlanDetail | required | yes |
| `/shared`, `/shared/:noteId` | SharedItemList (공유받은 항목) | required | yes |
| `/settings/members` | SettingsMembers | required | yes |
| `/settings/categories` | SettingsCategories (any member; replaced `/admin/categories`) | required | yes |
| `/admin` | Admin | ADMIN | yes |

Query params worth knowing:
- `/` — `?note=N` activates that note
- `/sheets` — `?sheet=N`
- `/data/purchases` — `?month=YYYY-MM`, `?date=YYYY-MM-DD`, `?edit=N`, `?row=N`
- `/data/todos` / `/data/anniversaries` — `?date=YYYY-MM-DD`

## Entity & permission pattern

### v1 (current `main`)

Every shared entity follows this contract:

- **Read** — any authenticated user (everyone allowlisted sees everything)
- **Write** — author only (`createdBy.userId === me.userId`)
- **Delete** — author or ADMIN
- **Soft-delete** — `deletedAt: Instant?`, plus `/restore` + `/forever`

The exception is `Note.visibility`: PRIVATE notes are invisible to the non-author.

### v2 (current — live on `main`)

Every resource entity gets `workspace_id` (NOT NULL). The contract becomes:

- **Read** — workspace member, OR `ResourceShare` recipient. Else 404.
- **Write** — workspace member with `EDIT` (default for OWNER and MEMBER), OR `ResourceShare` recipient with `permission=EDIT`. PRIVATE notes still author-only inside the workspace.
- **Delete** — author or workspace OWNER.
- **Soft-delete** — preserved.

`Note.visibility` ∈ `{PRIVATE, WORKSPACE}` (renamed from `SHARED`). Cross-workspace grants on PRIVATE notes are allowed (the grant overrides the PRIVATE flag for the specific recipient).

See [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md) §4 for the API-level details.

## Adding a new data feature

The v1 pattern still applies; v2 adds one mandatory addition (workspace scoping).

1. **Backend** — `com.shareddocs.backend.<feature>/`: Entity, Repository, Service, Controller, Dto. Entity has `workspace_id` (NOT NULL FK). Repository queries take `workspaceId` parameter. Optional Category + Bootstrapper (Category also workspace-scoped).
2. **Frontend** — `src/features/<feature>/`: `api.ts` + `types.ts` + component tree. **One `.module.css` per component.**
3. Forms use `Modal` + primitives. Wrapper + keyed inner pattern; never `setState` in effect.
4. List pages use `Page`/`PageHeader`/`PageTitle`/`BackLink` or a custom List/Header/Item structure. FAB via `Fab`. For `/data/*` sub-pages, use `<BackLink to="/data" mobileOnly>`.
5. Add the route to `src/App.tsx` and **`React.lazy`-split it.**
6. Mobile-first: single-pane drill-in, back button, safe-area-inset on chrome.
7. **v2: every API endpoint requires `X-Workspace-Id` header (injected by axios interceptor). Backend filters by `@CurrentWorkspace.id`.**

## Plans

Implementation plans + designs live in `docs/plans/`. The v2 architecture spec is [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md); each phase (A–F) and the Decisions pillar (D1a–D5) has its own dated design+plan doc alongside it. The v2 build is complete — new work gets a fresh dated plan.

## When in doubt

- Visual question → [`docs/DESIGN.md`](docs/DESIGN.md)
- Scope question → [`docs/VISION.md`](docs/VISION.md) and the "not-list"
- Build-order question → [`docs/ROADMAP.md`](docs/ROADMAP.md)
- v2 data model / API / auth flow → [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md)
- "How is X wired in v1?" → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

Memory file (Claude-internal): `~/.claude/projects/-Users-jeongjin-WebstormProjects-shared-docs-root/memory/MEMORY.md`.
