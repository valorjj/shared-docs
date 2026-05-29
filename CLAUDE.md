# CLAUDE.md

> Project bible. Last revised: 2026-05-29 — multi-tenant v2 rebuild in progress. The 2026-05-28 "private 2-person app" framing has been reversed.

## What this is

A multi-tenant shared workspace app for small groups (couples, families, friend circles, hobby clubs). One user belongs to many workspaces. Within a workspace, data is shared by default; PRIVATE notes are author-only. Cross-workspace per-doc shares let you grant individual documents to specific outsiders.

Currently in the middle of a v2 rebuild from a single-workspace prototype. The active spec is [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md) — read it first.

The product, inside any workspace, has four pillars:

1. **Personal notebook** (PRIVATE notes — already implemented)
2. **Shared notebook** (Bear-style memo — already implemented)
3. **Decisions** (Plan → SubPlan → Option → Decision; deferred until after v2 ships)
4. **Calculator** (tape-style engineering calc — already implemented)

After v2, the multi-calendar overlay (work + family + hobby in one view) is the next direction. Read [`docs/VISION.md`](docs/VISION.md) for the full why, [`docs/ROADMAP.md`](docs/ROADMAP.md) for the v2 phase order.

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

## Branch strategy during v2

- `main` — v1 codebase, frozen. Production deploys from here until cutover.
- `v2-multi-tenant` — the rebuild. All phase work merges here. To be created at the start of Phase A.

Don't merge v2 work to `main` until cutover. Don't add v1 features to `main` either — it's frozen.

## Stack at a glance

- **Frontend:** Vite + React 19 + TypeScript + CSS Modules. Tiptap v3 for the editor. React Query for data. React Router v6.
- **Backend:** Spring Boot 3.5 + Kotlin. JPA + MariaDB (port 3307 host). Hibernate `ddl-auto: update`.
- **Auth:** Google OAuth2 → JWT (24h). Open sign-up; a temporary `app.auth.allowed-emails` kill-switch (env flag `APP_AUTH_ALLOWLIST_ENABLED`) gates prod during the v2 build, off in dev. Phase F flips it off in prod at launch.
- **Deploy:** Vercel (frontend) + Cloudflare Tunnel → Mac Mini Docker (backend + DB + uploads volume).

Full details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (note: v1 baseline; v2 changes will land as Phase A merges).

## Daily-use commands

### Frontend (`shared-docs/`)
```bash
npm run dev               # localhost:5173
npm run build             # production build → dist/
npx tsc --noEmit          # type-check only
npx eslint src/           # lint
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
7. **No backwards-compat shims, no feature flags.** Ship to the v2 branch or don't ship. (The allowlist kill-switch is the single exception during the v2 build window.)
8. **Comments default to none.** Only write a comment when the *why* is non-obvious.

Once v2 lands, every API endpoint also requires:

9. **Every workspace-scoped query filters by `currentWorkspace.id`.** No exceptions. This is the bug we're designing against.
10. **Resource ownership is per-workspace.** A note belongs to exactly one workspace; cross-workspace access goes through `ResourceShare`, never through "the recipient sees it in their workspace list."

ESLint enforces 1–6 mechanically. The rest is review discipline.

## Feature status (v1 baseline, all to be ported into v2)

| Feature | State |
|---|---|
| Memo | **v1 stable.** Personal/shared split implemented via `Note.visibility`. Port to v2: add `workspace_id`, rename `SHARED` → `WORKSPACE`. |
| Sheets | **v1 frozen.** Carried into v2 unchanged except `workspace_id`. |
| 구매 / 정산 / 반복 항목 | **v1 stable.** Port to v2 with `workspace_id` + per-workspace categories. |
| 할 일 / 기념일 / 링크 / 레시피 | **v1 stable.** Same v2 port. |
| Calendar | **v1 stable.** v2: workspace-scoped only; multi-calendar overlay is post-v2. |
| Calculator | **v1 stable.** Tape becomes workspace-scoped in v2. |
| Settings, Auth, Search palette | **v1 stable.** Auth gets open sign-up + workspace bootstrap in v2 Phase A. |
| Workspaces / Memberships | **v2 Phase A — not yet built.** |
| Invitations | **v2 Phase D — not yet built.** |
| Per-doc ShareGrant / "공유받은 항목" | **v2 Phase E — not yet built.** |
| Decisions | **Post-v2.** |
| Multi-calendar overlay | **Post-v2.** |
| Presence on shared notes | **Post-v2.** |

## Routes (v1; v2 adds workspace switcher + `/invite/:token` + `/shared`)

| Path | Page | Auth | Lazy |
|---|---|---|---|
| `/login`, `/auth/callback` | Login / AuthCallback | public | no |
| `/` | NoteWorkspace (Hub) | required | yes |
| `/sheets` | SheetWorkspace | required | yes |
| `/data` | DataLayout (sidebar + Outlet) | required | no |
| `/data/purchases` | PurchaseList | required | yes |
| `/data/todos` | TodoList | required | yes |
| `/data/anniversaries` | AnniversaryList | required | yes |
| `/data/links` | LinkList | required | yes |
| `/data/recipes` | RecipeList | required | yes |
| `/data/recipes/:id` | RecipeEditor | required | yes |
| `/calendar` | CalendarPage | required | yes |
| `/calc` | CalcWorkspace | required | yes |
| `/admin` | Admin | ADMIN | yes |
| `/admin/categories` | AdminCategories | ADMIN | yes |

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

### v2 (incoming, on the `v2-multi-tenant` branch)

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

Implementation plans live in `docs/plans/`. Active spec:

- [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md) — multi-tenant v2 architecture (the active build target).

Per-phase plans (Phase A onward) get written as each phase starts, not in advance.

## When in doubt

- Visual question → [`docs/DESIGN.md`](docs/DESIGN.md)
- Scope question → [`docs/VISION.md`](docs/VISION.md) and the "not-list"
- Build-order question → [`docs/ROADMAP.md`](docs/ROADMAP.md)
- v2 data model / API / auth flow → [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md)
- "How is X wired in v1?" → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

Memory file (Claude-internal): `~/.claude/projects/-Users-jeongjin-WebstormProjects-shared-docs-root/memory/MEMORY.md`.
