# Phase E — per-note cross-workspace sharing (design)

> **Status:** approved 2026-06-10. Implementation plan derived from this doc.
> Scopes down v2 spec §4.2–4.4 / Phase E to **Notes only**, on a generic core.

## Goal

Let a note's author (or workspace OWNER) grant a specific outside user `VIEW` or
`EDIT` access to one note. The recipient sees it in a workspace-independent
"공유받은 항목" view and opens it read-only (VIEW) or editable (EDIT), even though
the note lives in someone else's workspace.

## Locked decisions (this phase)

1. **Notes only.** Build the generic `resource_shares` machinery once; wire only
   the `NOTE` kind. The other 9 kinds fan out later on the proven abstraction.
2. **VIEW + EDIT.** Full permission model, enforced on both read and write.
3. **Separate `/api/shares/*` access path.** Cross-workspace reads/writes never
   go through the workspace-scoped `/api/notes/*` endpoints — CLAUDE.md rule #9
   ("every workspace-scoped query filters by currentWorkspace.id") stays absolute.
4. **Recipient must be an existing user** (spec §4.2). Email lookup → 404
   `user-not-found` if absent. No pending-email share rows.
5. **No public guest links.** The deleted `PublicShareLink`/`PublicViewController`
   are out of scope.

## 1. Data model

`resource_shares` (Flyway `V17__resource_shares.sql`), entity extends `BaseEntity`:

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | BaseEntity |
| version | BIGINT | optimistic lock |
| resource_kind | VARCHAR | enum `ResourceKind { NOTE }` — one value today |
| resource_id | BIGINT | polymorphic → **no FK** (enforced in service, documented) |
| granted_to_user_id | BIGINT FK→users RESTRICT | recipient |
| granted_by_user_id | BIGINT FK→users RESTRICT | author/owner who shared |
| permission | VARCHAR | enum `SharePermission { VIEW, EDIT }` |
| created_at / updated_at | TIMESTAMP | BaseEntity |

Unique constraint: `(resource_kind, resource_id, granted_to_user_id)` — one grant
per recipient per note; re-granting upserts the permission.

`resource_id` is polymorphic, so it carries no FK constraint — the service layer
verifies the note exists and belongs to the granter's workspace before inserting.
This is the deliberate, documented exception to the FK-everywhere standard (a
single FK can't point at a polymorphic column).

## 2. API surface

### 2a. Grant management — workspace-scoped (the note is in *your* workspace)

`@CurrentWorkspace` + `@AuthenticationPrincipal` apply; rule #9 intact.

```
POST   /api/notes/:id/shares          { email, permission }   author or workspace OWNER
GET    /api/notes/:id/shares          list grants on this note
PATCH  /api/notes/:id/shares/:userId  { permission }          change level
DELETE /api/notes/:id/shares/:userId  revoke
```

- `POST` resolves `email` → user. **404 `user-not-found`** if absent (hint: recipient
  must sign in first). **404** if the recipient is the granter themselves or already
  an active member of the note's workspace (sharing is pointless — reject quietly).
- Only the note's author or the workspace OWNER may grant/revoke. Otherwise 404.
- Upsert on the unique constraint (re-share changes permission, no duplicate row).

### 2b. Shared access — cross-workspace (resolved purely by grant, NO workspace filter)

```
GET    /api/shares              notes shared with me → [{ noteId, title, ownerName, permission, sharedAt }]
GET    /api/shares/notes/:id    full note + effectivePermission   (404 if no grant)
PATCH  /api/shares/notes/:id    edit title/body   (404 if no grant; 403 if grant=VIEW; optimistic-locked)
```

These are the only endpoints that read a note without a workspace filter. They take
`@AuthenticationPrincipal` but **not** `@CurrentWorkspace` — access is resolved
entirely through `resource_shares`.

## 3. Permission resolution

A `ShareAccess` component (revives the deleted `AccessControl` idea), used only by
the `/api/shares/*` endpoints:

```kotlin
fun resolveNotePermission(noteId: Long, userId: Long): SharePermission?  // VIEW | EDIT | null
```

- `GET /api/shares/notes/:id` → resolve; `null` → 404 (don't leak existence).
- `PATCH /api/shares/notes/:id` → resolve; `null` → 404; `VIEW` → 403 `view-only`;
  `EDIT` → write back to the note in the owner's workspace; optimistic lock guards
  concurrent edits.

`effectivePermission` is returned **only** on `GET /api/shares/notes/:id`. The
in-workspace `NoteResponse` is untouched — members are implicitly EDIT there, so the
field buys nothing on the hot path. Blast radius: one new field on one new endpoint.

**PRIVATE notes:** granting a PRIVATE note is allowed (spec §11 #1). The grant
overrides PRIVATE for that one recipient. No special-casing in the resolver —
visibility constrains workspace-mates, the grant constrains the outsider.

## 4. Frontend (`src/features/shares/`)

- **`ShareDialog`** — opened from the note's existing action area. Lists current
  grants (recipient name + permission + remove); an "add" row with email input +
  VIEW/EDIT picker. On 404 `user-not-found`: inline
  "이 이메일의 사용자가 없어요. 먼저 가입해야 공유할 수 있어요." Mutations hit
  `/api/notes/:id/shares`.
- **`/shared` route — `SharedList`** ("공유받은 항목") — notes shared with me,
  grouped by owner name, each row showing its permission. Workspace-independent
  (stable across workspace switches, per §4.4). New nav entry. Lazy-split route.
- **`SharedNoteView`** — opening a shared note **reuses the existing NoteEditor
  (Tiptap)** with `editable = effectivePermission === 'EDIT'`. VIEW renders read-only
  with edit affordances hidden; EDIT saves via `PATCH /api/shares/notes/:id`. Loads
  via `GET /api/shares/notes/:id` — no `X-Workspace-Id` dependency.

Reusing NoteEditor (not a parallel viewer) keeps Tiptap rendering DRY — same config,
gated by permission.

## 5. Scope & testing

**In:** generic `resource_shares` core; Notes wired end-to-end (grant → 공유받은 항목
→ read-only/editable); VIEW+EDIT enforced on read *and* write; separate
`/api/shares/*` path.

**Out (deliberate):** the other 9 resource kinds; public guest links; pending-email
shares.

**Backend tests** (`@SpringBootTest @ActiveProfiles("test") @Transactional`):
grant upsert, self/member-share rejection, 404 `user-not-found`, VIEW blocks PATCH
(403), EDIT writes through, revoke, cross-workspace isolation (a non-grantee 404s),
PRIVATE-note grant works, only author/owner may grant.

**Frontend gate:** `npx tsc -b --noEmit` + `npx eslint src/features/shares` + `npm run build`.
