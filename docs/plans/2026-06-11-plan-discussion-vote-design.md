# Plan Discussion Surface + Vote (Design)

> **Status:** design — approved 2026-06-11, ready for plan-writing.
> **Scope:** backend (`shared-docs-backend`) + frontend (`shared-docs`, `src/features/decisions`, `src/features/notes`).
> **Backlog item:** Decisions backlog A.4 (group collaboration) — vote mode + split-view plan↔discussion note with url/link/comment/vote (`decisions-backlog.md`).

## 1. Goal

Give a 계획 a **group discussion surface**: a split-view where the plan (list/canvas/timeline) sits on the left and a **discussion note + its comment thread** sits on the right, plus a **vote** signal on 선택지 so the group can see where it's leaning before someone runs 결정하기. The four collaboration verbs from the backlog — add a url, add a link, add a comment, add a vote — are satisfied with maximal reuse: url + link + comment come from the existing note/chip/comment infrastructure; only vote is a genuinely new entity.

## 2. Context (current state)

- **Plan module:** `Plan → SubPlan → Option → Decision`, all workspace-scoped, all `BaseEntity` (`id/createdAt/updatedAt/version`). `Plan` carries `lockedAt/lockedByUserId`; **`PlanLockGuard`** (`assertUnlocked` / `assertUnlockedByPlanId` / `assertUnlockedBySubPlanId`) freezes all content writes on a locked plan. `OptionRating` + `RatingService.upsert/delete` already model a per-user per-option signal — votes mirror this shape.
- **Notes:** `Note(workspaceId, title, body LONGTEXT, visibility ∈ {PRIVATE, WORKSPACE}, createdBy, deletedAt)`. Per-note sharing via `ResourceShare` (Phase E). No `kind` field — notes are homogeneous.
- **Comments:** `Comment(workspaceId, pageId: String, author, content, user?)` — `pageId` is a **generic client-defined thread key**; `GET/POST /api/comments?pageId=…`. Currently used only on note pages, but entity-agnostic by design.
- **Entity-link chips:** `EntityRef(fromNoteId, toKind, toId)` composite PK; `EntityKind` = `note | sheet | purchase | todo | anniversary | recipe | link`. `EntityRefIndexer` scans note bodies (`<span data-type="entity-link" data-kind="…" data-id="…">`), validates targets in-workspace, maintains rows; deleted targets render as tombstones client-side. **No decision-entity kinds; no plan↔note association anywhere.**
- **Frontend:** `PlanDetail.tsx` is a tabbed page (목록/캔버스/기록) with **no side panel**. `NoteEditor` is the reusable Tiptap editor; the notes page already renders a comment thread per note.

## 3. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Vote vs rating | **Vote is a distinct group signal**, separate from `OptionRating`. One vote per member per 안건. |
| Vote lifecycle | **Always-live** — cast/move/retract anytime; tally updates live. No open/close ceremony. Frozen by `PlanLockGuard` on a locked plan **and on an 안건 whose decision is locked** (reopen unfreezes). |
| Vote history | **No per-vote `PlanEvent`** — votes are live signal, not history. Instead, 확정 **snapshots the tally onto the Decision** (`voteSnapshot` JSON); superseded Decisions keep the tally they were made under. |
| Vote interaction | Re-casting on another 선택지 **moves** the vote (upsert); clicking your current choice again **retracts** it. |
| Anonymity | **Named votes** — tally plus voter names on expand. Small-group app; who's leaning where is the point. |
| 결과 확정하기 | A button on an 안건 with votes that **pre-fills the existing decide flow** (leading 선택지 pre-selected, overridable, reason required) → produces a **normal Decision**. All lock/supersession/audit machinery reused; nothing duplicated. On a tie, nothing is pre-selected. |
| Discussion surface | **Split-view: note + comments.** Left = existing PlanDetail tabs; right = collapsible pane with the discussion note's editor + its comment thread. |
| Note origin | **Auto-created 1:1 note** — nullable `discussionNoteId` FK on `Plan`; lazily created (race-safe) on first open. A completely **normal** WORKSPACE-visibility note: searchable, shareable, editable from the notes list too. |
| Comments | **Reuse the note's existing comment thread** (same `pageId` key the note page already uses). Same thread from either surface. Zero new comment backend. |
| Deleted discussion note | Next discussion-pane open **lazy-creates a fresh note** (same code path as null). No tombstone UI in the pane. |
| Chips | `EntityKind` gains **`plan`, `subplan`, `option`** so notes can inline-reference decision entities. `Decision` records skipped (outcomes, reachable via their 안건). |
| Lock semantics | Locking a plan freezes structure + votes + 확정. The discussion note and its comments **stay live** — lock means "the record is settled," not "stop talking." |

## 4. Architecture

### 4.1 Data model + migration (one Flyway migration, next `V` number)

**`option_votes` table** — new entity `OptionVote : BaseEntity`:

- `workspaceId: Long`, `subPlanId: Long`, `optionId: Long`, `userId: Long` (reference-by-id, mirroring `option_ratings`' FK treatment).
- **Unique `(sub_plan_id, user_id)`** — one vote per member per 안건; the DB enforces "move, don't accumulate."
- No new `PlanEventType` for votes — a live signal, not history. The eventual Decision emits `DECISION_LOCKED` through the existing flow.

**`decisions.vote_snapshot`** — nullable `TEXT` holding JSON `[{optionId, title, count, voters: [name]}]`, written by `DecisionService.lock` when the 안건 has votes at 확정 time (null otherwise). Entity field `voteSnapshot: String?` on `Decision`. The Decision is the audit record — superseded rows keep the tally they were decided under; a re-decide after reopen snapshots the new tally.

**`plans.discussion_note_id`** — nullable `BIGINT`, FK → `notes(id)` **`ON DELETE SET NULL`** (a hard-deleted note must not strand the plan). Entity field `discussionNoteId: Long?` on `Plan`; columns match exactly so `ddl-auto: validate` passes.

### 4.2 Vote endpoints (`VoteService`, path shape mirrors the rating endpoints)

- `PUT /api/options/{optionId}/vote` — upsert: `requireOption` → `PlanLockGuard.assertUnlockedBySubPlanId(option.subPlanId)` → **decided-안건 guard** → delete any existing vote by this user on the same 안건, insert the new one. Idempotent re-cast on the same option is a no-op.
- `DELETE /api/options/{optionId}/vote` — retract: same guards; deleting a nonexistent vote is a no-op (204 either way).
- **Decided-안건 guard:** if the 안건 has an active (non-superseded) Decision, both writes throw a new `SubPlanDecidedException : ApiException(409, "subplan-decided", …, "이미 결정이 확정된 안건이에요. 다시 열면 투표할 수 있어요.")`. `DecisionService.reopen` unfreezes by superseding the Decision, as today.
- **Snapshot at 확정:** `DecisionService.lock` serializes the 안건's current tally into `Decision.voteSnapshot` (null when no votes) in the same transaction.
- **Read:** the plan tree response gains, per 선택지: `voteCount: Int`, `voters: [{userId, name}]`, and per-tree `myVote` derivable client-side from `voters` + current user. No separate vote-read endpoint.

### 4.3 Discussion note (lazy 1:1)

- `POST /api/plans/{planId}/discussion-note` → `{ noteId }`. Idempotent:
  - `requirePlan`; if `discussionNoteId` points to a **live** note → return it.
  - If null **or the linked note is soft-deleted** → create `Note(title = "{plan.title} 논의", visibility = WORKSPACE, createdBy = actor, workspaceId = ws.id)`, set the FK, save.
  - **Race safety via the plan's existing optimistic `version`:** a concurrent creator's save throws `OptimisticLockException` → reload and return the winner's note (the loser's orphan note is deleted in the same handler).
- **Not guarded by `PlanLockGuard`** — opening the discussion (and the lazy create) works on a locked plan, by design.
- Plan soft-delete leaves the note untouched (it's a normal note). The pane is unreachable anyway once the plan is gone from the list.

### 4.4 Chips → decision entities

- `EntityKind` += `"plan"`, `"subplan"`, `"option"`. `EntityRefIndexer` validation extends to the three new kinds (target exists, same workspace — soft-deleted plans excluded like other kinds).
- The existing chip **suggestion/lookup endpoints** extend to the new kinds. Lookups for `subplan`/`option` include the **owning `planId`** in the payload so the client can navigate without a second round-trip.
- **Chip click navigation:** `plan` → `/decisions/{id}`; `subplan`/`option` → `/decisions/{planId}?subplan=N` (and `&option=M`), which scrolls to + transiently highlights the target in the active tab. Tombstone fallback for deleted targets, as today.
- Labels in suggestions/chips use the entity's `title` (선택지 label for options).

### 4.5 Frontend split-view

- **`PlanDetail.tsx`:** a 논의 toggle (Lucide `MessagesSquare`, outline — the screen's primary stays 결정하기) opens a right pane beside the existing tabs. Hairline divider, no shadow, pane width ~`minmax(320px, 38%)`. On narrow screens the pane renders as a full-width drawer instead of squeezing the canvas. Pane open/closed state persists per plan in `localStorage`.
- **Pane content:** on first open, call the lazy-create endpoint, then render the reused `NoteEditor` (full editing: chips, urls, formatting) with the existing comment-thread component below it, keyed by the note's `pageId`. Editing here is identical to editing the note from the notes list.
- **Vote UI:** on each 선택지 — `OptionRow` (목록 tab) and the canvas node's option display — a vote affordance showing the tally; click casts/moves, click-again retracts; voter names on hover/expand. `useCastVote`/`useRetractVote` hooks in `api.ts`, both invalidating `decisionKeys.scope`. Vote affordances go read-only when the plan is locked (existing `locked` threading) **or the 안건's decision is locked** — frozen tally still shown.
- **Tally in history:** the decision display and the timeline's `DECISION_LOCKED` entry render the snapshot when present ("선택지 B · 3표 중 2표"); superseded decisions show theirs unchanged.
- **결과 확정하기:** on an 안건 with ≥1 vote, the existing decide modal opens with the leading 선택지 pre-selected (none on tie) and a hint line showing the tally; everything downstream is the existing decide flow.

## 5. Error handling

- Vote on a locked plan → existing `PlanLockedException` (409 problem+json, Korean detail).
- Vote on a decided 안건 → `SubPlanDecidedException` (409 problem+json, `type: …/subplan-decided`).
- Vote on a deleted/foreign-workspace option → existing 404 via `requireOption`.
- Discussion-note create on a deleted plan → 404 via `requirePlan`.
- Chip targeting a deleted decision entity → indexer drops the ref; client renders the existing tombstone.

## 6. Testing

Backend (`@SpringBootTest @ActiveProfiles("test") @Transactional`):

- **Vote:** cast creates; re-cast same option is a no-op; cast on a sibling option **moves** (old row gone, unique constraint never violated); retract deletes; retract-when-absent is a no-op; vote on a locked plan → 409 and no mutation; vote on a decided 안건 → 409; reopen → the same vote succeeds; tree response carries correct `voteCount`/`voters`.
- **Snapshot:** 확정 with votes stores the tally JSON on the Decision; 확정 without votes stores null; reopen + re-decide stores a fresh snapshot while the superseded Decision keeps its original.
- **Discussion note:** first call creates + links (title/visibility/workspace correct); second call returns the same id, no second note; linked-note-soft-deleted → fresh note created and FK overwritten; works on a locked plan; concurrent create resolves to a single linked note (optimistic-retry path, orphan cleaned).
- **Chips:** indexer extracts/validates/persists the three new kinds; cross-workspace and soft-deleted targets rejected; lookup payload for `subplan`/`option` carries `planId`.
- **Migration:** `validate` passes; FK `ON DELETE SET NULL` behavior covered by a hard-delete test.

Frontend: `npx tsc -b --noEmit` + `npm run build` (authoritative gate; lint only touched folders). Manual: open 논의 pane → note created once; edit from both surfaces; comment from the pane; cast/move/retract a vote from list and canvas; lock the plan → votes frozen, note still editable; 결과 확정하기 pre-fills the decide modal.

## 7. Build order (informs the plan)

1. **Vote backend:** `OptionVote` + migration (votes half, incl. `decisions.vote_snapshot`) + `VoteService`/controller + both guards + snapshot in `DecisionService.lock` + tree DTO fields; tests.
2. **Discussion-note backend:** `discussion_note_id` (same migration) + lazy-create endpoint + race handling; tests.
3. **Chips backend:** three new `EntityKind`s + indexer + lookup extensions; tests.
4. **Frontend vote:** hooks, `OptionRow` + canvas vote UI, 결과 확정하기 pre-fill.
5. **Frontend split-view:** 논의 toggle + pane (NoteEditor + comments reuse), drawer breakpoint, chip rendering/suggestions/navigation for the new kinds.

1–3 share one migration but are otherwise independent; 4 depends on 1; 5 depends on 2–3. Vote (1+4) and discussion surface (2+3+5) are independently shippable slices if the plan wants two passes.
