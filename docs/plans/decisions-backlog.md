# Decisions — Backlog (later work)

> Captured 2026-06-10. **Backlog complete as of 2026-06-19** — all items (A.1–A.4, B.5, B.6) shipped. Kept here as a record; see each item for its design/plan doc. Builds on the shipped list-view work (order-spine, connection layer, 연결 모달, drag-to-reorder — see `2026-06-10-decisions-list-spine-design.md`).

## A. Plan lifecycle / status

1. ~~**Lock the plan** — freeze a 계획 to read-only once it's settled (no further edits to 안건 / 선택지 / decisions).~~ ✅ **Shipped 2026-06-11** — orthogonal `lockedAt`/`lockedByUserId` flag, `PlanLockGuard` (409 across all 14 content writes), `PLAN_LOCKED`/`PLAN_UNLOCKED` timeline events, frontend toggle + banner + read-only gating. Design/plan: `2026-06-11-plan-lock-{design,plan}.md`.
2. ~~**Mark complete**~~ ✅ **Shipped 2026-06-11** — `PlanStatus ACTIVE|COMPLETED` (retired the dead ARCHIVED); complete/uncomplete actions + `PLAN_COMPLETED`/`PLAN_UNCOMPLETED` events; completed plans drop off the board into a 완료 view. Design/plan: `2026-06-11-plan-complete-discard-{design,plan}.md`.
3. ~~**Discard + manage discarded plans**~~ ✅ **Shipped 2026-06-11** — soft-delete via `deletedAt` mirroring Note: discard→휴지통, 복원, 영구 삭제; reads split board/완료/휴지통; `getTree`+timeline 404 for discarded. Lock became content-only (trash is the destruction gate). Same design/plan as A.2.
4. ~~**Deadlines integrated with the timeline (기록) view**~~ ✅ **Shipped 2026-06-15, deployed** — date-only `deadline` on 계획/안건 + `Plan.completedAt` (Flyway V22); `DeadlineChip` (live D-day + frozen 기한 내/지나 annotation) on plan/안건/board + timeline lines; lock-guarded set/clear endpoints recording `DEADLINE_SET`/`DEADLINE_CLEARED` events. Design/plan: `2026-06-15-decisions-deadlines-{design,plan}.md`.

## B. Group collaboration (the core vision)

The framing: **planning with a small group means they need to discuss.** A plan should aggregate — add-a-plan, add-a-url, add-a-link, add-a-comment, add-a-vote.

5. ~~**Vote mode**~~ ✅ **Shipped 2026-06-12** — `OptionVote` entity (Flyway V20), cast/move/retract with lock + decided guards, vote tally snapshot frozen onto `Decision` at 확정, vote UI + decide pre-fill. Ended up as a new lighter primitive (tally), separate from the existing per-user ratings. Design/plan: `2026-06-11-plan-discussion-vote-{design,plan}.md`.
6. ~~**Split-view plan ↔ discussion note**~~ ✅ **Shipped 2026-06-12** — lazy 1:1 plan discussion note (Flyway V21) rendered as a slim discussion rail/pane; entity-link chip kinds for 계획/안건/선택지 + deep-link landing; comments flow through the discussion note itself rather than a separate comment-thread primitive. Same design/plan as #5.

## Since this backlog was drained

- **PlanDetail redesign** (2026-06-15) — document-column layout, sticky control strip, mobile FAB/top-strip shape, discussion rail placement. Not originally on this backlog; came out of using the shipped B.5/B.6 features. Design/plan: `2026-06-15-plan-page-redesign-{design,plan}.md`.
- **Cross-workspace calendar overlay** (2026-06-19) — the VISION.md "sweet spot" post-v2 direction, built ahead of schedule. See `2026-06-19-cross-workspace-calendar-{design,plan}.md`.

No open items remain on this backlog. Next direction should be picked fresh rather than pulled from here.
