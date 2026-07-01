# Roadmap

> Last revised: 2026-06-19 — **v2 build complete and deployed (Phases A–F)**, and the entire post-v2 Decisions backlog plus the multi-calendar overlay are **also shipped**. This section is now history; the phase descriptions below are kept as a build log.

**STATUS (2026-06-19):** The multi-tenant v2 rebuild shipped. `main` is the live v2 codebase; the DB was wiped and re-seeded at cutover. All phases A–F plus the Decisions pillar (including its full post-v2 backlog) and the multi-calendar overlay are in production. **Open Google sign-up is already live** — the rebuild removed the email allowlist (there is no `APP_AUTH_ALLOWLIST_ENABLED` gate in the code), so going public just means sharing the URL. Next direction is open — see [`docs/plans/decisions-backlog.md`](plans/decisions-backlog.md) (closed) and the "Post-v2 directions" section below for what's left. Architecture spec: [`plans/2026-05-29-multi-tenant-v2.md`](plans/2026-05-29-multi-tenant-v2.md).

**Post-v2 shipped:**
- **2026-06-11 — Decisions list-view connections + drag-reorder** — order-spine, hover-highlight, 연결 modal, `@dnd-kit` reorder + batch `sortOrder` endpoint. Design/plan: [`plans/2026-06-10-decisions-list-spine-design.md`](plans/2026-06-10-decisions-list-spine-design.md) / `-plan.md`.
- **2026-06-11 — Rate-limiting & abuse protection** — per-user write-throttle (Bucket4j), per-user upload quota, global upload-dir disk guard. Design/plan: [`plans/2026-06-11-rate-limiting-abuse-design.md`](plans/2026-06-11-rate-limiting-abuse-design.md) / `-plan.md`. Deferred: Cloudflare edge rules, signup/workspace caps.
- **2026-06-11 — Plan lock (Decisions backlog A.1)** — freeze a 계획 to read-only: orthogonal `lockedAt`/`lockedByUserId` flag (Flyway V18), `PlanLockGuard` enforcing 409 across all 14 content writes, `PLAN_LOCKED`/`PLAN_UNLOCKED` timeline events, frontend toggle + banner + read-only gating (list/canvas/roadmap). Design/plan: [`plans/2026-06-11-plan-lock-design.md`](plans/2026-06-11-plan-lock-design.md) / `-plan.md`.
- **2026-06-11 — Plan complete + discard (Decisions backlog A.2/A.3)** — `PlanStatus ACTIVE|COMPLETED` (retired the dead ARCHIVED) + soft-delete 휴지통 mirroring Note (Flyway V19: `deleted_at` + index + ARCHIVED→ACTIVE backfill). Dedicated complete/uncomplete (+`PLAN_COMPLETED`/`PLAN_UNCOMPLETED` events) and discard/restore/`deleteForever`; reads split into board/완료/휴지통; `getTree`+timeline 404 for discarded. **Lock is now content-only** — deletion is no longer guarded (trash is the destruction gate). Frontend: 4-tab DecisionList + complete toggle + trash UX. Design/plan: [`plans/2026-06-11-plan-complete-discard-design.md`](plans/2026-06-11-plan-complete-discard-design.md) / `-plan.md`.
- **2026-06-12 — Vote mode + discussion pane (Decisions backlog B.5/B.6)** — `OptionVote` tally (Flyway V20; cast/move/retract with lock + decided guards; snapshot frozen onto `Decision` at 확정); lazy 1:1 plan discussion note (Flyway V21) as a slim discussion rail; entity-link chip kinds for 계획/안건/선택지 + deep-link landing. Design/plan: `plans/2026-06-11-plan-discussion-vote-design.md` / `-plan.md`.
- **2026-06-15 — Deadlines (Decisions backlog A.4)** — date-only `deadline` on 계획/안건 + `Plan.completedAt` (Flyway V22), live D-day `DeadlineChip` + frozen 기한 내/지나 annotation, lock-guarded set/clear endpoints with timeline events. **This closed the Decisions backlog.** Design/plan: [`plans/2026-06-15-decisions-deadlines-design.md`](plans/2026-06-15-decisions-deadlines-design.md) / `-plan.md`.
- **2026-06-15 — PlanDetail redesign** — document-column layout, sticky control strip with condensed title on scroll, mobile FAB/top-pinned-strip shape. Design/plan: [`plans/2026-06-15-plan-page-redesign-design.md`](plans/2026-06-15-plan-page-redesign-design.md) / `-plan.md`.
- **2026-06-19 — Cross-workspace calendar overlay** — the "sweet spot" post-v2 direction (see below), built ahead of schedule. 전체 워크스페이스 toggle, per-workspace filter chips, `GET /api/calendar/events/all`. Design/plan: [`plans/2026-06-19-cross-workspace-calendar-design.md`](plans/2026-06-19-cross-workspace-calendar-design.md) / `-plan.md`.

## Where we are (build log)

| Surface | State |
|---|---|
| v2 codebase on `main` | **Live.** All four pillars + workspaces, invitations, cross-workspace note sharing. |
| v1 production data | **Wiped at cutover** (mysqldump backup kept). |
| v2 spec | `plans/2026-05-29-multi-tenant-v2.md` — the architecture source of truth. |
| v2 implementation | **Phases A–F shipped + deployed (2026-06).** |
| Public sign-up | **Already open** — no allowlist gate in code (removed in the rebuild). |

## v2 phases (build log — all shipped)

The phases below all shipped with tests green. (Historical note: during the build, work happened on per-phase branches and merged to `main` at/after cutover, not on a long-lived `v2-multi-tenant` branch as originally planned.)

### Phase A — workspaces + memberships + scoped reads (~7–10 days)

- New tables: `workspaces`, `workspace_members`.
- Add `workspace_id` column to every resource table (notes, sheets, calc entries, purchases, settlements, todos, anniversaries, links, recipes, categories, attachments).
- `WorkspaceContextFilter` backend + `@CurrentWorkspace` resolver.
- Every existing repository/service filters by workspace.
- On first Google sign-in: auto-create personal workspace + OWNER membership.
- Frontend: axios interceptor injects `X-Workspace-Id` header from localStorage.
- No new UI yet — the existing app should keep working with a single auto-created workspace.

### Phase B — workspace switcher + create-workspace (~3–5 days)

- `WorkspaceSwitcher` chrome (top-left desktop dropdown; mobile lives in sidebar/settings).
- `POST /api/workspaces` to create new (caller becomes OWNER).
- 워크스페이스 설정 page (rename, delete).
- localStorage active-workspace + React Query cache clear on switch.

### Phase C — per-workspace categories + onboarding seed (~2–3 days)

- Seed default categories on workspace creation (구매 / 할 일 / 기념일 / 링크 / 레시피 category bootstrap).
- Category services become workspace-scoped (no global categories anymore).

### Phase D — invitations (~7–10 days)

- `workspace_invitations` table + endpoints.
- Resend integration for email send (Korean templates).
- 멤버 관리 page per workspace.
- `/invite/:token` claim flow.
- Leave-workspace + remove-member actions.

### Phase E — per-doc ShareGrant + "공유받은 항목" (~10–14 days)

- `resource_shares` table + endpoints (resurrected from the share/ package deleted in commit `122e489`, adapted to the workspace model).
- ShareDialog per resource kind (probably a single generic dialog).
- New `/shared` route — workspace-independent surface for cross-workspace grants.
- Permission resolution in every read endpoint (`effectivePermission: VIEW | EDIT` in responses).
- Frontend hides edit affordances when `effectivePermission === 'VIEW'`.

### Phase F — polish + remove kill-switch + launch (~3–5 days)

- Empty-state UI for fresh workspaces.
- User profile page.
- Disable `APP_AUTH_ALLOWLIST_ENABLED` in prod → open sign-up.
- Minimal Privacy/Terms placeholder pages.
- Basic landing page improvements for `/login`.

### v2 cutover (~1 day, separate from the phases)

1. Tag `main` as `v1-final`.
2. Pause Cloudflare Tunnel.
3. `mysqldump shared_docs > pre-v2-backup.sql` on the Mac Mini.
4. `DROP DATABASE shared_docs; CREATE DATABASE shared_docs;`
5. `rm -rf /app/uploads/*`.
6. Merge `v2-multi-tenant` → `main`.
7. Redeploy frontend + backend.
8. Sign in to seed the first personal workspace.
9. Resume traffic.

See spec §10 for the rollback procedure.

## Post-v2 directions

### Decisions feature (Phase 3 from the old roadmap) — ✅ shipped

The original wedge of the product. `Plan → SubPlan → Option (with per-member ratings) → Decision` with a timeline view. Shipped 2026-06, backlog (lock, complete/discard, vote, discussion, deadlines) fully drained by 2026-06-19 — see [`plans/decisions-backlog.md`](plans/decisions-backlog.md).

### Multi-calendar overlay (the "sweet spot") — ✅ shipped 2026-06-19

A unified 전체 워크스페이스 view that overlays the calendars of every workspace a user belongs to (work + family + hobby), each color-coded, each toggleable. Design/plan: [`plans/2026-06-19-cross-workspace-calendar-design.md`](plans/2026-06-19-cross-workspace-calendar-design.md).

### Presence on shared notes — not started

Tiptap "awareness" — partner's avatar + cursor color when both viewing the same note. No real-time editing (last-write-wins remains). Uses Y.js awareness over WebSocket, no CRDT sync. This is the only post-v2 direction from VISION.md still unbuilt.

## Deferred indefinitely

| Item | Why |
|---|---|
| iMessage / SMS / email expense ingestion | Impossible from web; off the table for good |
| Open Banking 마이데이터 integration | Requires FSC license, multi-억원 capital — not happening |
| Real-time collaborative editing (CRDT sync) | Couples and small groups don't race paragraphs; awareness is enough |
| Sheets enhancements (formulas, sorting, filtering) | Use a real spreadsheet |
| Mobile native apps | Responsive web + PWA install is sufficient |
| Billing / pricing / paid tiers | No commercial intent — may revisit if storage costs become real |
| Notion-scale workspaces (50+ members, org charts, @everyone) | Out of design scope — workspaces are small by design |
| Document publishing (open-web URLs) | Cross-workspace ShareGrant covers the "share with specific people" need; we don't want to host public web pages |

## Roadmap principles

1. **One phase at a time on the v2 branch.** Each phase is a reviewable PR or commit cluster against `v2-multi-tenant`, not against `main`.
2. **No code starts without a per-phase plan.** Phase A's plan (`plans/2026-05-29-phase-a-workspaces.md`) gets written first, reviewed, then executed.
3. **The "deferred" list is sticky.** Adding back requires explicit reasoning, not "while we're here."
4. **No feature flags inside v2.** Ship to `v2-multi-tenant` or don't ship. (Allowlist kill-switch in Phase F is the only exception.)
5. **Tests + type-check green before merging each phase to the v2 branch.**
