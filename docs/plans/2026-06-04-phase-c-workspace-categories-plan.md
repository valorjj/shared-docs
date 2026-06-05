# Phase C — Per-workspace categories + onboarding seed

> Status: **✅ COMPLETE — merged, deployed, accepted, tagged (2026-06-05).** Merged `phase-c` →
> `main` (fast-forward) and tagged `phase-c-complete` on BOTH repos: backend `320bc6f`, frontend
> `e0462ef`. Backend CD ran Flyway **V13** against `shared_docs_prod` + Vercel redeployed; live
> categories accepted. Builds were green pre-merge (`./gradlew build` +5 tests; `npm run build` +
> tsc clean; eslint clean on changed files — 25 pre-existing errors remain in untouched files).
>
> **Next phase:** Phase D (invitations via Resend + claim flow) or Phase E (per-doc ShareGrant +
> `/shared` view). Nothing open in Phase C.
>
> Decisions that landed (2026-06-04): any **member** manages categories (no ADMIN guard — the
> WorkspaceContextFilter enforces membership); management lives at **`/settings/categories`**
> (entry via SettingsDialog → 워크스페이스 → 카테고리 관리); the global `/admin/categories` page
> was retired. Seeding moved from 5 startup CommandLineRunners to a per-workspace
> `WorkspaceCategorySeeder` (listens for `WorkspaceCreatedEvent`, runs in the create transaction).
> Emoji category icons kept as data (out of scope). FK ON DELETE RESTRICT.

Spec: [`2026-05-29-multi-tenant-v2.md`](2026-05-29-multi-tenant-v2.md) §3.2 (categories belong to a
workspace) and the Phase C line (§"Phase C: per-workspace category bootstrapping").

---

## Goal

Today all five category kinds (**purchase, todo, anniversary, link, recipe**) are **global** —
one flat table each, seeded once at app startup by a `CommandLineRunner`, managed by a global
`ADMIN` at `/admin/categories`. Phase A scoped every *resource* by `workspace_id` but explicitly
deferred categories (the comment `"Categories are global (admin-managed) (Phase A decision)"`
appears in four `api.ts` files).

Phase C closes that gap:

1. **Each workspace owns its own categories.** Add `workspace_id` to all five `*_categories`
   tables; scope every read/write by it.
2. **Seed defaults at workspace-create time**, not at app startup. A brand-new workspace gets the
   same default sets that the `CommandLineRunner`s seed today.
3. **Any workspace member manages categories** (decision 2026-06-04), not a global ADMIN.
4. **Management UI moves into a per-workspace settings page** (decision 2026-06-04). The global
   `/admin/categories` route is retired; the existing `CategoryAdminPanel` is reused on a new
   `/settings/categories` page scoped to the active workspace.

### Decisions locked (2026-06-04)

- **Who manages:** any active workspace **member** (OWNER and MEMBER alike). Mutations require
  `X-Workspace-Id` + membership — no more `hasRole('ADMIN')` guard on categories.
- **Where:** a per-workspace **settings page** at `/settings/categories`, reusing
  `CategoryAdminPanel`. Retire `/admin/categories`. The global `/admin` page (other admin tools)
  is untouched.
- **FK on delete:** `workspace_id` FK uses **ON DELETE RESTRICT**, matching the resource-table
  convention from Phase A (workspaces are soft-deleted anyway, so this rarely fires).
- **Resource rows untouched:** resources store category as a denormalized `VARCHAR(64)` *name*
  (`Purchase.category`, `TodoItem.category`, …), NOT an FK to the category id. So making
  categories per-workspace requires **zero migration of resource tables** — the string values are
  self-contained. (The existing "이 카테고리를 쓰던 항목은 그대로 남아요" warning in the admin
  panel already reflects this.)

### Non-goals (explicitly deferred)

- **Emoji category icons.** The seed defaults store emoji in the `icon` column (🍱 🚌 …). That's
  user-editable *data*, not chrome, so it's out of scope here despite the "Lucide-not-emoji for
  chrome" rule. Revisit as its own task if we want a Lucide icon picker.
- **Custom default sets / templates per workspace type.** Every workspace seeds the same defaults.
- **Cross-workspace category copy.** No "import categories from workspace A" in this phase.

---

## The shape of the data today (verified)

All five `*Category` entities are structural clones:

```kotlin
@Entity @Table(name = "<kind>_categories",
  indexes = [Index(name = "...", columnList = "name", unique = true)])   // ← global unique on name
class XCategory(
  @Column(nullable=false, unique=true, length=64) var name: String,
  @Column(length=16) var color: String? = null,
  @Column(length=8)  var icon: String? = null,                          // emoji today
  @Column(name="sort_order", nullable=false) var sortOrder: Int = 0,
  @Column(nullable=false) var active: Boolean = true,
  @Id @GeneratedValue(IDENTITY) val id: Long? = null,                   // ← NOT BaseEntity
)
```

- Repos: `findAllByActiveTrueOrderBy…`, `findAllByOrderBy…`, `existsByName`. (Purchase also has
  `findByName`.) **No `workspaceId` anywhere.**
- Services: global, no `@CurrentWorkspace`.
- Controllers: `GET /api/<kind>-categories` (any authed user) + `GET/POST/PATCH/DELETE
  /api/admin/<kind>-categories` (`hasRole('ADMIN')`).
- Bootstrappers: 5 × `CommandLineRunner`, seed once at startup, idempotent via `existsByName`.
- Frontend: 5 hooks with **unscoped** keys (`['todo-categories']`, …); `categoryAdmin.ts` drives
  the admin panel via `/api/admin/*` + a `PUBLIC_KEY` cross-invalidation map.

### Default seed sets (reused verbatim from the current bootstrappers)

| Kind | Defaults (name · sortOrder) |
|------|------|
| purchase | 식비(1) 교통(2) 주거(3) 의료(4) 여가(5) 의류(6) 기타(99) |
| todo | 집안일(1) 쇼핑(2) 일정(3) 공사(4) 기타(99) |
| anniversary | 기념일(1) 생일(2) 가족(3) 친구(4) 기타(99) |
| link | 개발(1) 디자인(2) 글(3) 영상(4) 도구(5) 기타(99) |
| recipe | 한식(1) 일식(2) 양식(3) 중식(4) 디저트(5) 기타(99) |

(colors + emoji icons carried over exactly — see the bootstrapper tables in the explore notes.)

---

## Backend tasks

### Task 1 — V13 migration (schema + reseed)

`src/main/resources/db/migration/V13__categories_workspace.sql`. For each of the five tables
(`purchase_categories`, `todo_categories`, `anniversary_categories`, `useful_link_categories`,
`recipe_categories`):

1. `DELETE FROM <table>;` — the old global rows are garbage in v2 (no workspace). Safe: resources
   keep their denormalized name strings, so deleting category rows loses nothing.
2. `DROP INDEX` the single-column unique-on-`name` index.
3. `ADD COLUMN workspace_id BIGINT NOT NULL`, `version BIGINT NOT NULL DEFAULT 0`,
   `created_at`/`updated_at` `DATETIME(6)` (to match `BaseEntity` auditing — see V6's settlement
   precedent which added `created_at`/`updated_at`).
4. `ADD CONSTRAINT … FOREIGN KEY (workspace_id) REFERENCES workspaces(id)` **ON DELETE RESTRICT**.
5. `ADD UNIQUE KEY (workspace_id, name)` — composite, so two workspaces can each have "기타".
6. **Seed existing workspaces:** `INSERT INTO <table> (workspace_id, name, color, icon, sort_order,
   active, version, created_at, updated_at) SELECT w.id, d.* FROM workspaces w CROSS JOIN (defaults
   as a VALUES list) d;` — so the workspaces already created during Phase B testing get their
   defaults. New workspaces are seeded in Kotlin (Task 4).

> The default VALUES list is duplicated between this SQL and the Kotlin constants (Task 4). That's
> a deliberate, documented duplication — seed data is static and Flyway-idiomatic in SQL, and the
> Kotlin copy is the runtime source for new workspaces. A comment in both points at the other.

`ddl-auto: validate` will confirm the entities (Task 2) match this schema on boot.

### Task 2 — Entities extend BaseEntity + carry workspaceId

For all five `*Category` classes: extend `BaseEntity` (drop the standalone `@Id`/`id`), add
`@Column(name = "workspace_id", nullable = false) var workspaceId: Long`, and replace the
single-column unique index with the composite `(workspace_id, name)` in `@Table`. Mirrors exactly
what Phase A did to the resource entities.

### Task 3 — Repositories + services workspace-scoped

- Repos: `findAllByWorkspaceIdAndActiveTrueOrderBySortOrderAscIdAsc(wsId)`,
  `findAllByWorkspaceIdOrderBySortOrderAscIdAsc(wsId)`,
  `existsByWorkspaceIdAndName(wsId, name)`, and a scoped `findByWorkspaceIdAndId(wsId, id)` for
  update/delete ownership checks (return 404 if it belongs to another workspace).
- Services: take `workspaceId` on every method. Scope all reads; uniqueness check is now
  per-workspace; `update`/`delete` load via `findByWorkspaceIdAndId` (cross-workspace id → 404).

### Task 4 — Per-workspace seeding (replaces the 5 CommandLineRunners)

- **Delete** the five `*CategoryBootstrapper : CommandLineRunner` classes (they'd violate the new
  `workspace_id NOT NULL` on next boot anyway).
- Define the default sets as Kotlin constants (one list per kind — keep them next to each
  category service, or a single `DefaultCategories` object). These mirror the V13 SQL VALUES.
- Add a `seedDefaults(workspaceId)` path. Cleanest: each category service exposes
  `seedDefaults(workspaceId)`; a small `WorkspaceCategorySeeder` calls all five.
- **Invoke from `WorkspaceService.create(...)`** inside the existing `@Transactional` so a new
  workspace + its 5×default category sets commit atomically. (Phase B's `create` already
  auto-generates the slug and the OWNER membership — seeding slots in alongside.)

### Task 5 — Controllers: scope reads, move mutations off /admin

- `GET /api/<kind>-categories`: now requires `X-Workspace-Id` (any member), passes
  `@CurrentWorkspace.id` to the service. (Already behind auth; the interceptor already sends the
  header for non-`/api/workspaces|auth` URLs.)
- **Move** `POST/PATCH/DELETE` from `/api/admin/<kind>-categories` (ADMIN) to
  `POST/PATCH/DELETE /api/<kind>-categories` requiring membership (no `@PreAuthorize`). Delete the
  now-empty admin category controller methods. Keep the rest of the admin controller intact.

### Task 6 — Backend tests

- **Isolation:** ws-A's categories absent from ws-B's `GET`.
- **Seeding:** `WorkspaceService.create` → new workspace has exactly the default count per kind.
- **Membership:** a member can POST/PATCH/DELETE; a non-member gets 403; missing header → 400
  problem+json (reuse the Phase A pattern).
- **Composite unique:** same name in two workspaces OK; duplicate within one workspace → 409/handled.

---

## Frontend tasks

### Task 7 — Scope the 5 category query keys

In each feature `api.ts` (purchases, todos, anniversaries, links, recipes): make the category key
workspace-scoped — `['<kind>-categories', activeId]` — read `useActiveWorkspace()`, set
`enabled: activeId != null`. Remove the four "categories are global (Phase A decision)" comments.
Update `categoryAdmin.ts` `PUBLIC_KEY` map + `adminKey` to include the workspace id so admin
mutations cross-invalidate the right scoped cache. (Same refactor shape as the Phase B query-key
work — watch for external consumers; `npm run build` is the safety net, not just `tsc --noEmit`.)

### Task 8 — Point the management UI at the new (non-admin) endpoints

`categoryAdmin.ts`: switch mutation URLs from `/api/admin/<kind>-categories` to
`/api/<kind>-categories`. The GET already maps to the scoped list. No request now needs ADMIN.

### Task 9 — Relocate management UI → /settings/categories

- New lazy route `/settings/categories` → a thin page that reuses the existing
  `CategoryAdminPanel` (5 tabs, already a good editor). Scoped automatically via the
  now-workspace-scoped hooks + the axios header. Bear-minimal page chrome
  (`Page`/`PageHeader`/`PageTitle` + `BackLink`).
- **Entry point:** add a "카테고리 관리" row to `SettingsDialog` (closes the dialog, navigates to
  `/settings/categories`). Optionally also from the `WorkspaceSwitcher` menu.
- **Retire** `/admin/categories`: remove the route from `App.tsx` and delete
  `pages/AdminCategories.tsx` + `.module.css` (the panel moves; the admin wrapper goes). Leave the
  `/admin` page and its other tools alone.

### Task 10 — Frontend validation

`npx tsc --noEmit` + `npm run build` clean; `npx eslint src/` clean (React Compiler rule: setState
setters in `useCallback` deps).

---

## Validation & cutover

1. Backend `./gradlew build` green (new isolation/seeding tests included).
2. Frontend tsc + build + eslint clean.
3. Deploy: push `phase-c` → `main` on both repos (fast-forward, solo-dev convention) → Backend CD
   self-hosted runner rebuilds the image and runs **V13** (truncate global cats → add `workspace_id`
   → reseed existing workspaces) + Vercel redeploys. **Never** hand-restart the prod container
   (placeholder secrets break OAuth/JWT) — re-run the workflow.
4. Live acceptance: a fresh workspace shows the default categories in every feature's picker;
   editing a category in `/settings/categories` reflects in that workspace only; a second
   workspace has independent categories; switching workspaces swaps the category lists (keys now
   scoped); a non-owner member can still edit.
5. Tag `phase-c-complete` on both repos.

## Risk notes

- **V13 on the existing prod DB** (`shared_docs_prod`) deletes the global category rows and reseeds
  per existing workspace. All current data is declared disposable test data, so this is safe — but
  it's a destructive-to-categories migration; the resource rows (with their denormalized names) are
  untouched.
- **Order of operations on deploy:** entities (Task 2) and V13 (Task 1) must land together — a
  partial deploy (new entity vs old schema, or vice versa) fails `ddl-auto: validate` at boot,
  which is the intended guard.
