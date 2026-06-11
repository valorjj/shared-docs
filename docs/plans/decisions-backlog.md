# Decisions — Backlog (later work)

> Captured 2026-06-10. Ideas for the **Decisions** pillar, not yet designed or started. Each item gets the normal brainstorm → plan → build cycle when picked up. Builds on the shipped list-view work (order-spine, connection layer, 연결 modal, drag-to-reorder — see `2026-06-10-decisions-list-spine-design.md`).

## A. Plan lifecycle / status

1. ~~**Lock the plan** — freeze a 계획 to read-only once it's settled (no further edits to 안건 / 선택지 / decisions).~~ ✅ **Shipped 2026-06-11** — orthogonal `lockedAt`/`lockedByUserId` flag, `PlanLockGuard` (409 across all 14 content writes), `PLAN_LOCKED`/`PLAN_UNLOCKED` timeline events, frontend toggle + banner + read-only gating. Design/plan: `2026-06-11-plan-lock-{design,plan}.md`.
2. ~~**Mark complete**~~ ✅ **Shipped 2026-06-11** — `PlanStatus ACTIVE|COMPLETED` (retired the dead ARCHIVED); complete/uncomplete actions + `PLAN_COMPLETED`/`PLAN_UNCOMPLETED` events; completed plans drop off the board into a 완료 view. Design/plan: `2026-06-11-plan-complete-discard-{design,plan}.md`.
3. ~~**Discard + manage discarded plans**~~ ✅ **Shipped 2026-06-11** — soft-delete via `deletedAt` mirroring Note: discard→휴지통, 복원, 영구 삭제; reads split board/완료/휴지통; `getTree`+timeline 404 for discarded. Lock became content-only (trash is the destruction gate). Same design/plan as A.2.
4. **Deadlines integrated with the timeline (기록) view** — set a deadline on a plan/안건 and surface it in the 기록 timeline. Touches the existing timeline / PlanEvent feed.

## B. Group collaboration (the core vision)

The framing: **planning with a small group means they need to discuss.** A plan should aggregate — add-a-plan, add-a-url, add-a-link, add-a-comment, add-a-vote.

5. **Vote mode** — group voting on 선택지. Relates to / may extend the existing per-user **ratings** (`OptionRating`, 1–5 score + comment) and the **decision lock** mechanic. Open question: is "vote" a new lighter primitive (thumbs / pick-one tally) or a re-skin of ratings?
6. **Split-view plan ↔ discussion note (Notion/Obsidian style)** — click a plan → side panel with a discussion surface attached to that plan: attach a **url**, a **link** (likely an entity-link to a note / other resource, reusing the existing entity-chip mechanics), a **comment** thread, and a **vote**. The biggest item and the heart of the request. Likely reuses the notes editor + entity chips + the vote primitive from #5. **Comments are net-new** — there is no comment concept anywhere in the app yet.

## Sequencing notes

- 1–4 are small-ish backend status + UI work; deadlines hook the timeline.
- **5 and 6 should be brainstormed together** — vote is a building block of the discussion surface. Comments are the one genuinely new domain concept and the main design risk.
