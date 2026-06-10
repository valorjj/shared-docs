# Multi-tenant v2 — architecture spec

> **Status:** ✅ IMPLEMENTED & DEPLOYED (Phases A–F shipped 2026-06-10). This was the architecture spec for the multi-tenant rebuild; it now reads as the as-built reference. Per-phase design+plan docs live alongside it in this folder. Note: §5.4's "allowlist kill-switch in Phase F" never materialized — the rebuild removed the email allowlist outright in Phase A, so open sign-up has been live since cutover (no `APP_AUTH_ALLOWLIST_ENABLED` gate exists).
>
> **Replaces:** the 2026-05-28 "private 2-person app" framing in `VISION.md`, `ROADMAP.md`, `README.md`, `CLAUDE.md` and the `project_public_launch.md` / `project_vision_reset.md` memories. Those docs all need rewriting once this spec lands. **Do not implement code until the user signs off on this spec.**

---

## 1. Why we're rebuilding

The 2026-05-28 reset narrowed the product to "me + wife only." A day later (2026-05-29), that constraint was lifted: this is going to be a real multi-tenant app that anyone can sign up for, organize into workspaces, invite their own circles into, and share individual documents across workspace boundaries.

The 14-file `share/` package we deleted on 2026-05-28 was not wrong code — it was right code with the wrong scope. Most of it gets resurrected, adapted to a workspace model that didn't exist before.

**Target audience:** anyone with a Google account. **Target scale (v2 launch):** 20–100 users. **Commercial intent:** none — same user explicitly said this is not for revenue. But it does need real-product UX (sign-up, onboarding, invitations, empty states) because users will not be the author.

## 2. Core concepts

| Concept | One sentence |
|---|---|
| **User** | A human with a Google identity, persisted in `users` (id, email, name, picture, lastLoginAt, role). |
| **Workspace** | A container for one circle's data (home / work / hobby / etc.). Owned by exactly one user; has 1..N members. |
| **Membership** | A (user, workspace, role) triple. Many-to-many: a user can belong to many workspaces, a workspace can have many users. |
| **Resource** | Any document a user creates: Note, Sheet, CalcEntry, Purchase, Settlement, Todo, Anniversary, Link, Recipe, RecurringPurchase. Each resource belongs to exactly one workspace. |
| **ShareGrant** | A per-resource permission granted to a specific user (typically outside the resource's workspace). Permission ∈ {VIEW, EDIT}. |
| **Invitation** | A pending email-tied token that, when claimed by a Google sign-in matching the invited email, adds the user as a workspace member. |
| **Visibility** | A per-note flag (PRIVATE / WORKSPACE) — independent of share grants. PRIVATE means only the author sees it, even inside the workspace. Currently only Notes have this; v2 keeps that scoping. |

### A user's data, in one diagram

```
                                            ┌──────────────┐
                              owns ─────────► Workspace "home" (with wife)
                              │                │ Note, Sheet, CalcEntry, ...
              ┌─► Membership ─┤
              │                └─► Workspace "work" (with colleagues)
   User ──────┤                    │ Note, Sheet, CalcEntry, ...
              │
              └─► Membership ─────► Workspace "hobby" (with club)
                                    │ Note, ...

   User ──── receives ──► ShareGrant ──► Resource (in some other workspace)
                                          (rendered in "공유받은 항목" view)
```

## 3. Data model

### 3.1 New tables

**`workspaces`**
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR(80) | "내 워크스페이스" by default |
| slug | VARCHAR(40) | unique-ish, generated from name; used in URLs |
| created_by_user_id | BIGINT FK→users | the original owner |
| created_at | TIMESTAMP | |
| deleted_at | TIMESTAMP NULL | soft-delete |

**`workspace_members`**
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| workspace_id | BIGINT FK→workspaces | |
| user_id | BIGINT FK→users | |
| role | ENUM(OWNER, MEMBER) | exactly one OWNER per workspace |
| joined_at | TIMESTAMP | |
| left_at | TIMESTAMP NULL | soft-leave; row stays for audit (`createdBy` resolution) |

Unique constraint: `(workspace_id, user_id) WHERE left_at IS NULL` — a user is at most an active member of a given workspace once.

**`workspace_invitations`**
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| workspace_id | BIGINT FK→workspaces | |
| email | VARCHAR(255) | lowercase; the invitee |
| token | VARCHAR(64) | URL-safe random; unique |
| invited_by_user_id | BIGINT FK→users | |
| expires_at | TIMESTAMP | default: now + 14 days |
| claimed_at | TIMESTAMP NULL | when a matching sign-in consumed it |
| created_at | TIMESTAMP | |

**`resource_shares`**
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| resource_kind | ENUM(NOTE, SHEET, CALC_ENTRY, PURCHASE, SETTLEMENT, TODO, ANNIVERSARY, LINK, RECIPE, RECURRING_PURCHASE) | |
| resource_id | BIGINT | FK polymorphic — enforced in service layer |
| granted_to_user_id | BIGINT FK→users | |
| granted_by_user_id | BIGINT FK→users | the resource's author or workspace owner |
| permission | ENUM(VIEW, EDIT) | |
| created_at | TIMESTAMP | |

Unique constraint: `(resource_kind, resource_id, granted_to_user_id)` — one row per recipient per resource.

> **Note:** this table has the same shape as the `resource_shares` we deleted in commit `122e489`. The DROP TABLE SQL we staged at `shared-docs-backend/scripts/migrations/2026-05-28-drop-share-tables.sql` is now obsolete — do **not** run it. The wipe (§7) takes care of the old data.

### 3.2 Changes to existing entities

Every resource entity gets a non-null `workspace_id` foreign key, declared with an explicit FK constraint in a Flyway migration (per [`../ENGINEERING-STANDARDS.md`](../ENGINEERING-STANDARDS.md) §2.1). Because the DB is wiped on cutover, the baseline migration creates every table with `workspace_id NOT NULL` from the start — no backfill needed.

Affected entities (one `workspace_id` column added to each):

```
note, attachment, entity_ref         (entity_refs may need a workspace_id too — see §3.3)
sheet
calc_entry
purchase, purchase_category
settlement
recurring_purchase
todo, todo_category
anniversary, anniversary_category
link, link_category
recipe, recipe_step, recipe_ingredient
```

Categories belong to a workspace (each workspace has its own "쇼핑" / "할 일" / etc. categories).

`Note.visibility` is preserved (PRIVATE / WORKSPACE). The current `SHARED` value gets renamed to `WORKSPACE` for clarity — `SHARED` is ambiguous now that ShareGrant also exists.

### 3.3 Cross-entity references

`entity_refs(from_note_id, to_kind, to_id)` currently lets a note `@`-mention any other entity. After v2:

- Both sides must live in the same workspace. The indexer enforces this at insert.
- If a note mentions a resource that gets shared cross-workspace via ShareGrant, the chip renders for the recipient but the chip's target view enforces ShareGrant lookup.

We may want `workspace_id` on `entity_refs` itself for read-path filtering — TBD, low risk to add.

## 4. API contract

### 4.1 Workspace context: header, not URL

Every request that touches workspace-scoped data includes:

```
X-Workspace-Id: 42
Authorization: Bearer <jwt>
```

Backend filter (`WorkspaceContextFilter`) reads the header, validates the calling user is an active member of that workspace, and stashes the resolved workspace on the request scope (via a custom `@CurrentWorkspace` argument resolver). Services receive `currentWorkspace.id` and filter every query by it.

**Why header over URL:** the existing API surface stays unchanged (`GET /api/notes/123`, not `GET /api/workspaces/3/notes/123`). Frontend writes a one-line axios interceptor that injects `X-Workspace-Id` from `localStorage`. Switching workspaces is a localStorage write + React Query cache clear — no token re-issue, no logout, no URL rewrites.

**Exception:** workspace-meta operations live under `/api/workspaces/...` and do NOT require the header (they operate on workspaces themselves, not workspace contents):

```
POST   /api/workspaces                              create new (caller becomes OWNER)
GET    /api/workspaces                              list mine (workspaces I'm a member of)
GET    /api/workspaces/:id                          detail
PATCH  /api/workspaces/:id                          rename (OWNER only)
DELETE /api/workspaces/:id                          delete + cascade (OWNER only, soft-delete)

GET    /api/workspaces/:id/members
POST   /api/workspaces/:id/members/:userId/role     change role (OWNER only)
DELETE /api/workspaces/:id/members/:userId          remove (OWNER), or self-leave (MEMBER)

POST   /api/workspaces/:id/invitations              invite by email (OWNER only)
GET    /api/workspaces/:id/invitations              list pending (OWNER only)
DELETE /api/workspaces/:id/invitations/:invId       revoke

POST   /api/invitations/:token/claim                claim — Google-signed-in caller's email must match
```

### 4.2 Sharing endpoints

```
GET    /api/shares                                  resources shared with me ("공유받은 항목" view)
POST   /api/notes/:id/shares                        grant on a specific note
DELETE /api/notes/:id/shares/:userId                revoke

POST   /api/sheets/:id/shares                       grant on a specific sheet
... mirror for each resource kind
```

Shape:

```json
POST /api/notes/123/shares
{ "email": "friend@example.com", "permission": "VIEW" }
```

If the email exists as a user, grant goes straight in. If it doesn't, fail with `404 user_not_found` and a hint that the recipient must sign in first. (We don't auto-create a placeholder user from a share — keeps the user table clean.)

### 4.3 Read path with shares

When loading a resource (`GET /api/notes/:id`):

1. Resolve note from DB.
2. Permission check, in order:
   - Is the note's workspace_id one the caller is an active member of? → grant the workspace member's effective permission (EDIT if MEMBER, EDIT if OWNER, with author-only delete; PRIVATE notes still hidden from non-authors).
   - Is there a ShareGrant for this note → caller? → grant the ShareGrant's permission (VIEW or EDIT).
   - Neither → 404 (not 403; don't leak existence).

The response includes `effectivePermission: VIEW | EDIT` so the frontend can hide edit affordances accordingly.

### 4.4 List endpoints

List endpoints (e.g. `GET /api/notes`) return only resources in the current workspace (from header). Cross-workspace shared resources do NOT appear in `/api/notes` — they appear in `/api/shares?kind=NOTE`.

This avoids the confusing "workspace switcher changes, but shared notes float around" UX. The "공유받은 항목" view is a stable, workspace-independent surface.

## 5. Auth and onboarding flow

### 5.1 First-time sign-in

1. User clicks "Google로 시작하기" → standard OAuth2 flow.
2. `OAuth2SuccessHandler`:
   - Upserts the User row (no allowlist check anymore).
   - **If user has 0 workspaces:** creates a "내 워크스페이스" workspace + OWNER membership. This is the user's permanent personal workspace.
   - Checks for pending invitations matching the user's email. (Doesn't auto-claim — user must explicitly accept at `/invite/:token` to avoid accidental membership.)
3. JWT issued; user redirected to `/auth/callback#token=...`.
4. Frontend `AuthCallback` stores token + sets `activeWorkspaceId` in localStorage to the user's personal workspace if not already set.
5. Redirect to `/` → loads with workspace context.

### 5.2 Returning user

Same except step 2's workspace-create branch is skipped.

### 5.3 Active workspace state

Lives in `localStorage` (`activeWorkspaceId`). Synced into a React context (`useActiveWorkspace`) at app boot. Switching workspace:

1. User picks from workspace switcher.
2. Write to localStorage.
3. React Query `queryClient.clear()` — wipe all cached data (it's workspace-specific).
4. Navigate to `/` (or stay in place if the current route is workspace-agnostic).

If the saved `activeWorkspaceId` is invalid (workspace deleted, membership revoked), fall back to the user's first available workspace; if none, fall back to creating a fresh personal workspace.

### 5.4 No allowlist

The 2-email allowlist is gone in v2. Any Google-authenticated user can sign in. As a **temporary kill-switch** during development we may keep `app.auth.allowed-emails` as an *opt-in* gate (controlled by an env flag `APP_AUTH_ALLOWLIST_ENABLED=true/false`), defaulted to off in dev and on in prod until phase F flips it.

## 6. Invitation flow

### 6.1 Owner invites a person

1. Owner opens 워크스페이스 설정 → 멤버 → "초대".
2. Owner types email, picks role (always MEMBER for now — owner is unique).
3. `POST /api/workspaces/:id/invitations` → backend creates row, generates token, sends email.
4. Email contains a link: `https://<frontend>/invite/:token`.

### 6.2 Recipient claims

1. Recipient clicks email link → frontend `/invite/:token` route.
2. If not signed in: prompt Google sign-in; on success, check that the signed-in email matches the invitation's email; if mismatch, show "이 초대는 다른 이메일을 위한 것입니다" error.
3. `POST /api/invitations/:token/claim` → backend marks `claimed_at`, creates `workspace_members` row (role=MEMBER).
4. Frontend redirects to `/` with `activeWorkspaceId` set to the new workspace.

### 6.3 Email infrastructure

For Phase D we need to actually send email. Options, in order of preference:

| Service | Cost | Setup | Notes |
|---|---|---|---|
| **Resend** | 100/day free | API key only | Simple, modern API, generous free tier |
| **SES** | $0.10/1000 | AWS account + verified domain | Cheapest at scale, more setup |
| **Postmark** | 100/mo free, then $15/mo | API key + verified domain | Best deliverability, costlier |
| **SMTP via Gmail** | free | App password | 500/day limit, fine for dev |

**Recommendation:** Resend for v2 launch. Migrate to SES if we ever exceed 100/day. SMTP for local dev.

### 6.4 Invitation expiry

Default 14 days. Backend cron sweeps expired un-claimed invitations weekly (soft-delete or hard delete — TBD; soft preferred for audit).

## 7. Existing data: wipe

Per the 2026-05-29 confirmation, all current data is wiped on v2 launch.

```sql
-- on prod MariaDB, one-shot
DROP DATABASE shared_docs;
CREATE DATABASE shared_docs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then **Flyway** replays `V1__baseline.sql` (and subsequent migrations) on first boot, building the entire v2 schema. Hibernate runs `ddl-auto: validate` — it asserts the entity model matches the migrated schema and refuses to start on mismatch, but never mutates the schema itself. (This supersedes the original "Hibernate `ddl-auto: update` recreates everything" plan — see [`../ENGINEERING-STANDARDS.md`](../ENGINEERING-STANDARDS.md) §1.)

**What's lost:**
- All current notes, sheets, calc entries, purchases, settlements, todos, anniversaries, links, recipes for both me (jeongjin@ecoletree.com) and wife (채연).
- All uploaded attachments — and **the actual files on disk are NOT auto-deleted**. We need a separate step: `rm -rf /app/uploads/*` on the Mac Mini Docker after the DB wipe.

**What's preserved:**
- The Google OAuth app credentials (they're tied to the OAuth client, not the user table).
- The JWT secret (same env var).
- The frontend deploy on Vercel.
- The Cloudflare Tunnel.

**Pre-wipe backup:** before wiping prod, dump everything to a JSON file (`mysqldump shared_docs > pre-v2-backup.sql`). Keep it on the Mac Mini for ~30 days. Not for restore — for nostalgia / accidental-loss insurance.

## 8. Visibility within a workspace

A `Note.visibility` flag persists in v2 with these semantics:

| Visibility | Who sees it |
|---|---|
| `PRIVATE` | Only the author, within the author's current workspace. Other workspace members do NOT see it. |
| `WORKSPACE` | All active members of the workspace see it. Non-members see nothing (unless granted via ShareGrant). |

Only Notes currently have visibility. Other resource kinds are always workspace-shared (no PRIVATE concept). If we later want PRIVATE sheets / calc entries, that's a column addition — out of v2 scope.

Cross-workspace ShareGrants are evaluated *separately* from visibility:

- Granting a PRIVATE note to a user outside the workspace is **allowed** (locked 2026-05-29). The author is the one granting, so they're consciously sharing. The grant overrides the PRIVATE flag for that one recipient. Visibility constrains workspace-mates; ShareGrant constrains outsiders.

## 9. Phase breakdown

Sequence is strict. Each phase ships behind the temporary allowlist kill-switch until phase F. No phase merges to main until its tests are green.

### Phase A: workspaces + memberships + scoped reads (~7-10 days)

- New tables: `workspaces`, `workspace_members`.
- Add `workspace_id` column to every resource table.
- `WorkspaceContextFilter` + `@CurrentWorkspace` resolver.
- Every existing repository / service updated to filter by workspace.
- On first sign-in, auto-create personal workspace.
- Existing API contract unchanged from frontend perspective except for the new `X-Workspace-Id` header.
- Frontend: axios interceptor injects the header; otherwise the app should keep working as if nothing changed.
- **Wipe production DB to ship this phase** — no migration path for old un-scoped data.

### Phase B: workspace switcher + create-workspace UI (~3-5 days)

- New `WorkspaceSwitcher` chrome component (top-left dropdown next to the existing app logo).
- "워크스페이스 추가" action → `POST /api/workspaces`.
- "워크스페이스 설정" page (rename, delete).
- localStorage `activeWorkspaceId` syncing; React Query cache clear on switch.
- Mobile: switcher lives inside the sidebar / settings menu (no top-left chrome on mobile).

### Phase C: per-workspace category bootstrapping (~2-3 days)

- When a new workspace is created, seed default categories (쇼핑 / 식비 / etc. for purchases; 할 일 / 기념일 / 링크 / 레시피 categories).
- Refactor category services to be workspace-scoped (no global categories anymore).

### Phase D: invitations (~7-10 days)

- `workspace_invitations` table + endpoints.
- Resend integration for email send.
- 멤버 관리 page (list members, pending invites, invite button, leave/remove actions).
- `/invite/:token` frontend route + claim flow.
- Email template (Korean, plain HTML, no marketing).

### Phase E: per-doc ShareGrant + "공유받은 항목" (~10-14 days)

- `resource_shares` table + endpoints.
- ShareDialog component per resource kind (probably one generic dialog parameterized by kind).
- "공유받은 항목" top-level view (new route `/shared`).
- Permission resolution in every read endpoint.
- Frontend: hide edit affordances when `effectivePermission === 'VIEW'`.
- Revive the deleted `share/` package via `git show 122e489^:src/main/kotlin/.../share/...` and adapt to workspace model.

### Phase F: polish + remove kill-switch + launch (~3-5 days)

- Empty-state UI for fresh workspaces (onboarding cards: "첫 메모를 작성해보세요", "캘린더를 확인해보세요").
- User profile page (display name, picture, sign out).
- Disable `APP_AUTH_ALLOWLIST_ENABLED` in prod → open sign-up.
- Minimal "Privacy" + "Terms" placeholder pages (template, will iterate).
- Basic landing page for `/login` (currently text-only).

### Out of v2 scope

The following are explicitly **deferred** beyond v2 to keep the rebuild focused:

- **Phase 3 Decisions feature** — gets built on top of v2. Originally the wedge; still the wedge.
- **Real-time collaboration / CRDT** — out forever (per existing roadmap).
- **Email/SMS expense ingestion** — out forever.
- **Mobile apps** — responsive web only.
- **Billing / payments / pricing** — no commercial intent in v2.
- **Per-resource PRIVATE flag for kinds other than Note** — additive, do when needed.

## 10. Migration & rollback

### 10.1 Branching strategy

```
main         ─┬─────────────────────────────────────►  (current prod)
              │
              └─► v2-multi-tenant ─────────────────►   (rebuild)
```

All v2 work happens on `v2-multi-tenant`. The branch is long-lived. Bug-fixes to current prod (if any) merge to `main` and get cherry-picked into v2 if relevant.

Vercel auto-deploys main to `shared-docs-nine.vercel.app` (prod). Vercel preview deploys per branch — `v2-multi-tenant` previews to a separate URL for testing.

### 10.2 Cutover

When phase F is green:

1. Tag `main` as `v1-final` for rollback reference.
2. Stop traffic to the Mac Mini backend (Cloudflare Tunnel pause).
3. `mysqldump shared_docs > pre-v2-backup.sql` on the Mac Mini.
4. `DROP DATABASE shared_docs; CREATE DATABASE shared_docs;`
5. `rm -rf /app/uploads/*` on the Mac Mini.
6. Merge `v2-multi-tenant` → `main`.
7. Vercel auto-deploys frontend.
8. SSH to Mac Mini, `docker compose pull && docker compose up -d --force-recreate backend`.
9. Resume Cloudflare Tunnel.
10. Sign in with jeongjin@ecoletree.com → personal workspace auto-created → invite wife.
11. Watch logs for 24h.

### 10.3 Rollback

If something goes catastrophically wrong:

1. Cloudflare Tunnel pause.
2. `git checkout v1-final` on Mac Mini.
3. `mysql shared_docs < pre-v2-backup.sql`.
4. `docker compose up -d --force-recreate backend`.
5. Resume Cloudflare Tunnel.

Total recovery time target: <30 min.

## 11. Locked decisions

All eight questions reviewed and locked 2026-05-29:

1. **PRIVATE notes + ShareGrant interaction.** Author **can** grant a PRIVATE note to an outsider. The grant overrides PRIVATE for the recipient. Visibility constrains workspace-mates; ShareGrant constrains outsiders.

2. **Workspace slugs are user-scoped.** Each user has their own slug namespace. Two different users can both have `my-workspace`. Slug uniqueness constraint: `(created_by_user_id, slug)`, not just `slug`.

3. **No resource transfer.** v2 ships without a "move this note to another workspace" feature. If a member needs to contribute to another user's workspace, they edit in-place there (their membership grants edit access). Worth a one-line note in the docs but no UI affordance.

4. **New email = new account.** A user changing their Google primary email creates a fresh account. Known limitation, accepted.

5. **Soft-delete hides everything.** When a workspace is soft-deleted, all its resources become un-queryable to everyone (including author). Hard delete (after 30 days) cascades and frees disk.

6. **Calendar is workspace-scoped only.** The existing 4-source aggregation (anniversaries + todos + purchases + settlements) filters to the current workspace. ShareGrant-only resources do NOT appear on the calendar — they appear in "공유받은 항목" instead. See §15 for the post-v2 multi-calendar direction this opens up.

7. **Email is Korean-only.** Invitation emails, error messages, future notification emails — all Korean.

8. **Author display names persist after leaving.** When a user leaves a workspace, their `workspace_members` row gets `left_at` set but is not deleted. Old resources still show their name. (Reminder: in v2 launch the DB is wiped, so this concern is theoretical until real users accumulate history.)

## 12. Post-v2 directions worth flagging

These are explicitly **not** in v2 scope but the v2 architecture should leave room for them.

### 12.1 Multi-calendar overlay (the "sweet spot")

The current calendar is one view per workspace. The natural next step (post-v2) is a **single "전체 일정" view that overlays calendars from multiple workspaces the user belongs to** — like Google Calendar's "내 캘린더 / 직장 / 가족" toggles in the left rail. Each workspace gets a color; events from all of them render together; per-workspace visibility toggles let the user mute work events on weekends, etc.

Why this matters: real users (notably the original couple's use case) keep separate calendars for work, family, hobby — and a unified weekly view is what they actually need. The multi-workspace model from v2 makes this almost free to build later — just a UI that calls each workspace's calendar endpoint in parallel and merges client-side.

**What v2 needs to do to keep this door open:**
- Workspace ID must be retained in calendar event payloads (so the UI can color/group by source).
- The calendar aggregator service should be stateless w.r.t. workspace context — pass workspace ID as a param, don't read from request scope.
- No design lock-in that assumes "calendar = current workspace only."

### 12.2 Phase 3 Decisions feature

Originally the wedge of the product (Plan → SubPlan → Option → Decision with audit-trail timeline). Deferred until after v2 ships. When it does ship, it lives inside the workspace model — each Plan belongs to a workspace, each Decision is tagged with the user who decided.

## 13. What this spec does NOT include

- Specific file paths to create/edit (those go in per-phase plans).
- Test plans (per-phase plans).
- UI mockups (per-phase plans; we'll use the existing Bear-aesthetic conventions).
- Performance targets (TBD; n=100 users is small enough that we're unlikely to hit issues).

## 14. Next step after sign-off

Once you've reviewed and signed off on this spec:

1. **Doc/memory cleanup commit** — rewrite `VISION.md`, `ROADMAP.md`, `README.md`, `CLAUDE.md`, plus update `project_public_launch.md`, `project_vision_reset.md`, and add `project_multi_tenant_v2.md` so the docs reflect what's actually being built.
2. **Phase A detailed plan** — `docs/plans/2026-05-29-phase-a-workspaces.md`, written using the writing-plans skill structure (bite-sized TDD tasks, exact file paths, commit boundaries).
3. **Branch creation** — `git checkout -b v2-multi-tenant` on both repos.
4. **Phase A execution.**
