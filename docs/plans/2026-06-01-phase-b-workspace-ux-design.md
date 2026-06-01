# Phase B — Workspace Integration UX (Design Spec)

> Status: **design approved 2026-06-01**, pending spec review → implementation plan.
> Predecessor: Phase A (workspace tenancy) — complete, tagged `phase-a-complete`.
> Branch: continue on `main` (now == the former `v2-multi-tenant`; they were fast-forwarded equal).

## Why

Phase A made every resource workspace-scoped and wired the frontend to send
`X-Workspace-Id`. Two incidents during Phase A validation exposed gaps this phase
closes:

1. **Silent 400-storm when a session has no workspace.** After a mid-session DB
   wipe, the browser kept a valid token but its user/workspace were gone. The app
   rendered a normal-looking hub and then failed *every* resource call with
   `missing-workspace-context`, with no way out from the UI. The app must never
   get stuck like this.
2. **Dev actions hit the live app.** The deployed backend and local dev both use
   `shared_docs` on `:3307`, so a dev migration (and later a manual wipe) landed
   on the live database. Prod needs its own database.

There is also a deferred item from Phase A Section 5: **no create-workspace UI**
(the switcher is read+switch only), so a user genuinely can't make a second
workspace from the product.

## Goal & guiding principle

**Robustness first.** Make the single-workspace path bulletproof and never-stuck,
and give users a minimal way to create another workspace — *without* yet building
heavy multi-workspace management. We are a solo dev with one workspace today;
invest in correctness and the never-stuck guarantee, not breadth.

## Scope

### In scope
1. **DB separation (infra, first task).** The deployed backend uses its own
   database; local dev keeps `shared_docs`.
2. **Backend: optional, auto-generated slug.** `slug` becomes optional on create;
   the server generates one when omitted.
3. **Frontend: create-workspace flow.** A name-only modal, reachable from the
   onboarding screen and the desktop switcher.
4. **Frontend: zero-workspace onboarding screen.** The core "never stuck" fix.

### Out of scope (explicitly deferred)
- Workspace **rename** / **settings page** / **delete**.
- **Member management / listing** (invitations are Phase D).
- **Mobile workspace switcher** (switching / creating *more* on mobile). Mobile
  still gets the full-screen onboarding screen, since that's a full-page route.
- Slug-based URLs (slug stays an internal identifier).

## Architecture

The workspace state plumbing from Phase A is unchanged and reused:
`ActiveWorkspaceProvider` (owns `{ workspaces, active, activeId, setActiveId, ready }`)
+ the `X-Workspace-Id` axios interceptor + `useWorkspaces` / `useCreateWorkspace`
React Query hooks + `WorkspaceController` (list/detail/create).

**Chosen approach (A): gate in `MobileShell`, shared modal, provider unchanged.**

- `ActiveWorkspaceProvider` keeps owning *state* (already resolves
  `active = stored-in-list ?? first ?? null`, so a stale/foreign stored id already
  falls back gracefully — no change needed there).
- `MobileShell` owns the *gate*. It already holds the app behind `!ready`. We add:
  when `ready && active == null`, render `<WorkspaceOnboarding>` instead of
  `<Outlet>`. Resource pages therefore never mount without a workspace → no
  headerless 400-storm.
- Components own *UI*: a shared `CreateWorkspaceModal` (built on the existing
  `Modal` primitive + `useCreateWorkspace`) is opened from both the onboarding
  screen and the switcher's new "+ 새 워크스페이스" item.

Rejected alternatives: a dedicated `/onboarding` route (extra redirect logic for
no benefit — readiness is already centralized), and rendering onboarding from
inside the provider (mixes UX into the state layer).

## Components & changes

### Task 1 — DB separation (infra)
- **`docker-compose.yml`**: parameterize the database name in
  `SPRING_DATASOURCE_URL` → `…/${DB_NAME:-shared_docs}?…` (default keeps local
  behavior unchanged).
- **`.github/workflows/deploy.yml`**: add `DB_NAME: shared_docs_prod` to the
  "Start new container" step's `env`.
- Result: **prod → `shared_docs_prod`**, **local dev → `shared_docs`**,
  **tests → `shared_docs_test`** (already). `createDatabaseIfNotExist=true` +
  Flyway build `shared_docs_prod` clean on first deploy.
- **Migration impact:** the live app starts empty again — the single workspace
  currently in `shared_docs` stays behind; you re-login once and the sign-in
  bootstrap recreates a personal workspace in `shared_docs_prod`. Acceptable
  (no real data yet).

### Task 2 — Backend: optional slug + server-side generation
- **`WorkspaceDto.CreateWorkspaceRequest`**: `slug` → `String? = null` (drop the
  `@NotBlank`; keep `@Size`/`@Pattern` applied only when non-blank).
- **`WorkspaceService.create`**: if `slug` is null/blank, generate
  `ws-<6 lowercase alphanumerics>`. Uniqueness per `(createdByUserId, slug)` is
  enforced by the existing unique index; the existing
  `DataIntegrityViolationException → WorkspaceSlugTakenException` backstop covers
  the rare collision (regenerate-and-retry a small fixed number of times before
  surfacing).
- **`WorkspaceController.create`**: unchanged signature; passes the (optional)
  slug through.
- Personal workspace bootstrap still uses the fixed slug `personal` (unchanged).

### Task 3 — Frontend: create-workspace flow
- **`CreateWorkspaceModal`** (`features/workspaces/`): one Korean **name** field
  (no slug field), submit button, validation (non-empty, max 80). Uses the
  existing `Modal` primitive + `useCreateWorkspace`. On success:
  `setActiveId(created.id)`, close, land in the new workspace's hub.
  Single primary button; Bear-minimal; Lucide icons; one `.module.css`.
- **`WorkspaceSwitcher`**: add a separator + "+ 새 워크스페이스" `MenuItem` that
  opens the modal.

### Task 4 — Frontend: zero-workspace onboarding
- **`WorkspaceOnboarding`** (`features/workspaces/`): centered screen —
  "아직 워크스페이스가 없어요" + a short line + an inline create form (reuses the
  same create logic as the modal; factor the form body into a small shared piece
  so the modal and the onboarding screen don't duplicate it).
- **`MobileShell`**: `if (ready && !active) return <WorkspaceOnboarding/>`
  (before the existing `<Outlet>` render). Responsive — works full-screen on
  mobile and desktop.

## Data flow (create)
`CreateWorkspaceModal`/`WorkspaceOnboarding` → `useCreateWorkspace` mutation →
`POST /api/workspaces { name }` → backend generates slug + creates workspace +
OWNER membership (existing `WorkspaceService.create`) → `201` →
`invalidate(['workspaces'])` + `setActiveId(created.id)` → provider re-resolves,
`active` set, `X-Workspace-Id` flows → hub renders.

## Error handling
- Create failure (e.g., validation) surfaces the RFC 7807 `detail` already parsed
  by the axios client; the modal shows it inline and stays open.
- Zero-workspace state is the onboarding screen, never the broken hub.
- A stored `activeWorkspaceId` that isn't in the user's list (deleted / not a
  member) already falls back to the first workspace in the provider; if the list
  is empty, the onboarding screen handles it. No 400/403 storm path remains.

## Testing
- **Backend:** integration test — `create` with slug omitted generates a valid,
  unique slug and an OWNER membership; two omitted-slug creates for one user
  don't collide. (`@SpringBootTest`, `shared_docs_test`, follows Phase A pattern.)
- **Frontend:** `tsc --noEmit` + `eslint` (changed files) + `npm run build` clean.
  No FE test infra yet — manual smoke on the deployed app: fresh login → land in
  workspace; create a second workspace via the switcher → it becomes active;
  (to exercise onboarding) clear `activeWorkspaceId` + simulate empty list.
- **Manual deploy verification:** after Task 1 redeploy, confirm the container
  uses `shared_docs_prod` (Flyway log + `printenv`), login bootstraps a workspace
  there, and `shared_docs` (dev) is untouched.

## Risks / notes
- **DB switch wipes the live view once** (data stays in `shared_docs`, prod moves
  to `shared_docs_prod`). Communicated; acceptable pre-users.
- **Slug auto-gen** must stay collision-safe; rely on the unique index + retry,
  not just the pre-check.
- Keep the create form factored so the modal and onboarding screen share it
  (avoid two divergent create forms).
