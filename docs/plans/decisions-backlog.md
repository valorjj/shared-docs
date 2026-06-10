# Decisions — Backlog (later work)

> Captured 2026-06-10. Ideas for the **Decisions** pillar, not yet designed or started. Each item gets the normal brainstorm → plan → build cycle when picked up. Builds on the shipped list-view work (order-spine, connection layer, 연결 modal, drag-to-reorder — see `2026-06-10-decisions-list-spine-design.md`).

## A. Plan lifecycle / status

1. **Lock the plan** — freeze a 계획 to read-only once it's settled (no further edits to 안건 / 선택지 / decisions).
2. **Mark complete** — a "completed" status for a plan, distinct from lock. Likely extends `PlanStatus` (today: `ACTIVE | ARCHIVED`).
3. **Discard + manage discarded plans** — soft-delete a plan plus a view to see / restore / purge discarded ones. Mirrors the soft-delete + restore/forever pattern used elsewhere in the app.
4. **Deadlines integrated with the timeline (기록) view** — set a deadline on a plan/안건 and surface it in the 기록 timeline. Touches the existing timeline / PlanEvent feed.

## B. Group collaboration (the core vision)

The framing: **planning with a small group means they need to discuss.** A plan should aggregate — add-a-plan, add-a-url, add-a-link, add-a-comment, add-a-vote.

5. **Vote mode** — group voting on 선택지. Relates to / may extend the existing per-user **ratings** (`OptionRating`, 1–5 score + comment) and the **decision lock** mechanic. Open question: is "vote" a new lighter primitive (thumbs / pick-one tally) or a re-skin of ratings?
6. **Split-view plan ↔ discussion note (Notion/Obsidian style)** — click a plan → side panel with a discussion surface attached to that plan: attach a **url**, a **link** (likely an entity-link to a note / other resource, reusing the existing entity-chip mechanics), a **comment** thread, and a **vote**. The biggest item and the heart of the request. Likely reuses the notes editor + entity chips + the vote primitive from #5. **Comments are net-new** — there is no comment concept anywhere in the app yet.

## Sequencing notes

- 1–4 are small-ish backend status + UI work; deadlines hook the timeline.
- **5 and 6 should be brainstormed together** — vote is a building block of the discussion surface. Comments are the one genuinely new domain concept and the main design risk.
