# Phase D — Workspace invitations (copy-link) + member management

> Status: **PLANNED — not started.** Written 2026-06-05, after Phase C shipped
> (`phase-c-complete`: backend `320bc6f`, frontend `e0462ef`). Brainstormed + design-approved
> 2026-06-05.
>
> **RESUME POINT:** No code yet. Start at Task 1 (backend V14 + entity). Work on the `phase-d`
> branch off `main` (both repos clean on `main`). When all tasks green + live-accepted, tag
> `phase-d-complete` on both repos. Next phase after this: Phase E (per-doc ShareGrant + `/shared`).

Spec: [`2026-05-29-multi-tenant-v2.md`](2026-05-29-multi-tenant-v2.md) §2 (workspace_invitations,
workspace_members), §4 (API), §5.1 (sign-in), §6 (invitation flow).

---

## Goal

Make workspaces actually multi-person. An OWNER can invite someone to their workspace; the invitee
claims the invite and becomes a MEMBER. Plus the member-management surface deferred from Phase B:
list members, see/revoke pending invites, remove a member, leave a workspace.

### Decisions locked (brainstormed 2026-06-05)

1. **Copy-link delivery, no email.** The backend stores the full invitation (token, expiry,
   inviter) but does NOT send email. The OWNER copies a `/invite/<token>` link and shares it
   however they like (KakaoTalk, etc.). Rationale: small circles + Korean sharing habits; zero mail
   infra / deliverability risk; Resend needs a verified domain we don't have. A thin
   `InvitationNotifier` seam is left so email can drop in later without rework — but no email
   implementation in this phase.
2. **Lazy expiry (14-day), no cron.** Claim rejects past `expires_at`; the pending list filters to
   unexpired+unclaimed; expired rows linger harmlessly (kept for audit). No `@EnableScheduling`. A
   cleanup sweep can be added in Phase F if rows ever pile up.
3. **Copy-link UX on `/settings/members`** — owner generates an invite, copies & shares the link.
4. **Owner can't leave** — must delete the workspace instead; ownership transfer is out of scope.
5. **Re-inviting an email returns the existing live link** (idempotent) — re-inviting an
   already-active member is a 409.

### Non-goals (deferred)

Real email send (copy-link only; `InvitationNotifier` seam only), ownership transfer, role changes
(invites are always MEMBER — OWNER is unique), resend-email, the sign-in-time "pending invites"
banner (spec §5.1 step 2 — the recipient uses the link directly), and cron cleanup of expired rows.

---

## Current state (verified 2026-06-05)

- **No email dependency** in `build.gradle.kts`; **no `@Scheduled`/`@EnableScheduling`** — neither
  is added (decisions 1 + 2 avoid both).
- `OAuth2SuccessHandler` upserts the user and bootstraps a personal workspace; it does **not** check
  invitations (and won't — §5.1 step 2 is a non-goal here).
- `WorkspaceController` (`/api/workspaces`) has list/detail/create only — **no member/invitation
  endpoints yet** (member mgmt was deferred from Phase B).
- `WorkspaceMember : BaseEntity` exists with soft-leave (`leftAt`), the active-uniqueness index
  `(workspace_id, user_id, left_at)`, and repo methods `findActive`,
  `findAllByWorkspaceIdAndLeftAtIsNullOrderByJoinedAtAsc`, `countByWorkspaceIdAndLeftAtIsNull`.
- `AppPrincipal` carries `email` → claim can match the signed-in email against the invite.
- `app.frontend-url` config exists (`FRONTEND_URL` secret) — used to build the `inviteUrl`.
- Phase B axios interceptor already skips `X-Workspace-Id` for `/api/workspaces` & `/api/auth`;
  **`/api/invitations` must be added to that skip-list** (a brand-new invitee has no/stale active
  workspace; the workspace filter would otherwise 403 the claim).

---

## Backend tasks

### Task 1 — V14 migration + `WorkspaceInvitation` entity

`V14__workspace_invitations.sql`: create `workspace_invitations` (id, workspace_id BIGINT NOT NULL,
email VARCHAR(255) NOT NULL, token VARCHAR(64) NOT NULL, invited_by_user_id BIGINT NOT NULL,
expires_at DATETIME(6) NOT NULL, claimed_at DATETIME(6) NULL, version/created_at/updated_at for
BaseEntity). Constraints: FK `workspace_id`→workspaces ON DELETE RESTRICT; FK
`invited_by_user_id`→users ON DELETE RESTRICT; **UNIQUE(token)**; index `(workspace_id)`; index
`(email)`. Entity `WorkspaceInvitation : BaseEntity` mirrors it (workspaceId, email, token,
invitedByUserId, expiresAt, claimedAt). `ddl-auto: validate` confirms the match.

> Note: no partial-unique on (workspace_id, email) — multiple historical/expired/claimed invites for
> the same email may coexist; the "one live invite" rule is enforced in the service (decision 5),
> not the DB.

### Task 2 — `InvitationRepository`

`findByToken(token)`, `findFirstByWorkspaceIdAndEmailAndClaimedAtIsNullAndExpiresAtAfter(wsId,
email, now)` (the live-invite lookup for idempotent create + pending filter),
`findAllByWorkspaceIdAndClaimedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(wsId, now)` (pending
list).

### Task 3 — `InvitationService`

- `create(workspaceId, rawEmail, inviterUserId)`: lowercase+trim email; if it belongs to an active
  member → `409 already_member`; if a live invite exists → return it (idempotent); else generate
  token (`SecureRandom`, URL-safe base64, 32 bytes) + `expiresAt = now + 14d`, save, return.
- `listPending(workspaceId)` → live invites only.
- `revoke(workspaceId, invitationId)`: load scoped to workspace (404 if mismatch); delete.
- `preview(token)`: 404 if missing; returns workspace name + inviter name + invitee email + a status
  enum (OK / EXPIRED / CLAIMED). Read-only; does NOT check the caller's email (the claim does).
- `claim(token, me: AppPrincipal)`: `404 not_found` if missing; **`410 expired`** if past expiry;
  `409 already_claimed` if claimed; **`403 wrong_email`** if `me.email`≠`invite.email` (case-insens);
  if already an active member → set `claimedAt`, return workspace (idempotent); else create
  `WorkspaceMember(workspaceId, me.userId, MEMBER)` + set `claimedAt`; return the workspace.
- Build `inviteUrl` from `app.frontend-url` + `/invite/<token>` (done in the controller/DTO).

### Task 4 — Member ops (extend `WorkspaceService`)

- `listMembers(workspaceId)`: any active member; join users → {userId, name, email, pictureUrl,
  role, joinedAt}.
- `removeMember(workspaceId, targetUserId, actorUserId)`: actor must be OWNER; `400` if
  `target == actor` (owner can't remove self); soft-leave the target (set `leftAt`).
- `leave(workspaceId, me)`: caller must be an active member; if caller is OWNER → `409 owner_cannot_leave`;
  else soft-leave.
- Add an `requireOwner(workspaceId, userId)` helper (reads `findActive`, checks role).

### Task 5 — Controllers + auth wiring

- Extend `WorkspaceController` (`/api/workspaces`): invitations (POST/GET/DELETE), members
  (GET, DELETE `/members/:userId`), `POST /leave`. These use `@PathVariable id` + explicit
  membership/role checks (NOT `@CurrentWorkspace` — the actor may be acting on a workspace via the
  path, and these are workspace-meta ops). Reuse the 404-not-403 "don't reveal membership" pattern
  for non-members where appropriate; use 403 where the spec wants an explicit "owner only".
- New `InvitationController` (`/api/invitations`): `GET /:token` (preview), `POST /:token/claim`.
  Both require auth, NOT a workspace header.
- `SecurityConfig`: `/api/invitations/**` is already covered by `.anyRequest().authenticated()`
  (not under `/api/admin/**` or `permitAll`), so no change needed — confirm the
  `WorkspaceContextFilter` tolerates a missing/irrelevant header on these (it does: the header is
  only validated when present, and these endpoints don't declare `@CurrentWorkspace`).

### Task 6 — Backend tests

- **create:** OWNER path; email lowercased; re-invite of an active member → 409; idempotent
  re-invite returns the same live invite (same token).
- **claim:** unknown token → 404; expired → rejected; `claimed_at` already set → rejected;
  email-mismatch → 403; happy path creates an active membership + sets `claimed_at`; claiming when
  already a member is idempotent (no second active row — relies on the active-uniqueness index).
- **members:** list visible to a member; `removeMember` OWNER-only + not-self; `leave` works for a
  MEMBER, `owner_cannot_leave` for the OWNER.
- **expiry:** an expired invite is excluded from `listPending` and rejected by `claim`.

---

## Frontend tasks

### Task 7 — Invitation/member API layer

`src/features/workspaces/membersApi.ts` (+ types): hooks for `useMembers(wsId)`,
`useInvitations(wsId)`, `useCreateInvitation`, `useRevokeInvitation`, `useRemoveMember`,
`useLeaveWorkspace`, `useInvitePreview(token)`, `useClaimInvitation`. Query keys workspace-scoped
where workspace-bound (`['ws-members', wsId]`, `['ws-invitations', wsId]`); the invite-preview/claim
keys are token-scoped. The create/revoke/remove/leave mutations invalidate the relevant lists (and
leave/claim also invalidate `useWorkspaces` since membership changed).

### Task 8 — `/settings/members` page

Mirrors the `/settings/categories` pattern (`Page`/`PageHeader`/`PageTitle`/`BackLink`). Sections:
**멤버** (list: avatar, name, role chip, joined date; OWNER sees a remove action per other-member),
**초대** (OWNER only: "초대" opens a small form → email → creates invite → shows the copyable
`/invite/<token>` link with a copy button; below it, the pending-invite list with copy-again +
revoke), and a footer **워크스페이스 나가기** for a MEMBER (hidden/disabled with a hint for the
OWNER). Add the entry to `SettingsDialog` (워크스페이스 → 멤버, next to 카테고리 관리). New lazy
route `/settings/members` under `MobileShell`.

### Task 9 — `/invite/:token` claim route

Lazy route, authed. If unauthenticated on mount: stash token in `sessionStorage` and redirect to
Google sign-in; `/auth/callback` (or the post-auth landing) checks the stash and routes back to
`/invite/:token`. Once authed: fetch preview → render workspace name + inviter; **수락** button →
claim → on success `setActiveId(workspace.id)` + navigate to `/`. Render distinct Korean states for
expired / already-claimed / wrong-email (the "이 초대는 다른 이메일을 위한 것입니다" case).

### Task 10 — Interceptor + validation

Add `/api/invitations` to the workspace-agnostic skip-list in `src/api/client.ts`. Then
`npx tsc --noEmit` + `npm run build` clean, `npx eslint src/` clean on changed files.

---

## Validation & cutover

1. Backend `./gradlew build` green (new invitation/member tests).
2. Frontend tsc + build + eslint clean.
3. Deploy: merge `phase-d` → `main` both repos (fast-forward) → Backend CD runs **V14** (purely
   additive — new table, no destructive change) + Vercel. Re-run the workflow; never hand-restart
   the prod container.
4. Live acceptance: as OWNER, open `/settings/members` → invite an email → copy the link; open it as
   a second Google account → 수락 → land in the workspace as a MEMBER; the member appears in the
   list; member can leave; owner can remove; owner-leave is blocked; an expired/foreign-email link
   shows the right error.
5. Tag `phase-d-complete` on both repos.

## Risk notes

- **V14 is additive** (new table only) — unlike V13 it touches no existing data, so prod risk is
  low.
- **Cross-account testing** needs a second Google account to exercise the real claim path
  (email-match). The dev-login shortcut can stand in for unit/integration tests but not the live
  email-match check.
- **The `/invite` round-trip through OAuth** is the fiddliest part — preserving the destination
  across the Google redirect. The sessionStorage stash + callback redirect is the plan; verify it
  survives the `#token=` callback handling.
