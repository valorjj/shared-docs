# Decisions — Infinite-Canvas Group Roadmap (Design Spec)

> Status: **DESIGN — approved in brainstorming 2026-06-08, not yet implemented.**
> This is the design spec (the "what" and "why"). Per-sub-phase **implementation plans** are written separately, one at a time, when each sub-phase starts (repo convention). The first to write is **D1**.
> Pillar 3 ("Decisions — the wedge") from `docs/VISION.md`. Built **after** Phase D; Phases E/F are deliberately skipped for now by user direction.

## 1. Goal

A place where a workspace's members (the invited "group") **decide things together and can read the audit trail of how they got there** — rendered as an **infinite canvas roadmap**, not a document. The timeline/flow is the thing people screenshot ("왜 우리가 마포로 정했더라?").

This is a **large, multi-session feature built cautiously in steps** (§8). Nothing is rushed; each sub-phase ships with tests green before the next begins.

## 2. Locked decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Hierarchy depth | **4-level: 계획 → 안건 → 선택지 → 결정.** SubPlan (안건) is mandatory — the "bridge" from the umbrella plan to concrete options; it is the decidable question. |
| 2 | Rating mechanic | **Numeric 1–5 + optional comment**, one per member per 선택지. Aggregate = average, computed on read. Every rating row persists (denormalized cache deferred). |
| 3 | Decision authority | **Any member, soft lock.** Locking records who/when/why. Any member can reopen; reopening is a logged event. |
| 4 | Timeline scope | **Per-계획 timeline + a workspace-wide feed.** Events are the meaningful moments only; ratings/comments are live state, not timeline entries. |
| 5 | Comment model | **One comment per member per 선택지** (a field on the rating row). No threaded discussion in v1. |
| 6 | Canvas surface | **Nested infinite canvas (option A).** Workspace **roadmap** of 계획 nodes (groupable into lanes) → double-click → that plan's **안건 canvas**. Free-form drag; positions persist. |
| 7 | Group semantics | "Group" = **workspace members** (the people you invited). The roadmap is workspace-scoped; no new sharing primitive. |
| 8 | Engine | **React Flow / @xyflow/react** for both canvases (pan/zoom/drag/custom nodes/edges). |

## 3. Korean vocabulary (UI labels)

| Code term | UI label |
|---|---|
| Plan | 계획 |
| SubPlan | 안건 |
| Option | 선택지 |
| OptionRating | 평가 |
| Decision | 결정 |
| (reopen) | 다시 열기 |
| status: ACTIVE / DECIDED / ARCHIVED / 대기(not-started) | 진행 중 / 결정됨 / 보관됨 / 대기 |

All UI text Korean. **Lucide icons only in chrome — never emoji** (users may type emoji inside their own option/plan text; chrome may not). Bear-calm dark (Dracula-leaning), hairlines, no card lift, single accent.

## 4. Data model

All entities extend `BaseEntity` (id / createdAt / updatedAt / `@Version`) and carry `workspace_id NOT NULL`. FKs `ON DELETE RESTRICT`, reference-by-id (no `@ManyToOne`), per the repo's portfolio-grade conventions. One Flyway migration introduces the tables (Vnn, additive).

### Entities

- **Plan** — `workspaceId, title, description?, status (ACTIVE|ARCHIVED), createdByUserId, canvasX?, canvasY?, groupLabel?`
  - `canvasX/Y` = position on the **workspace roadmap**. Nullable → auto-layout fallback.
  - `groupLabel?` = optional lane/group name (e.g. "집/살림"). Free-text in v1 (a first-class Group entity is deferred — §10).
- **SubPlan (안건)** — `workspaceId, planId, title, description?, sortOrder, createdByUserId, canvasX?, canvasY?`
  - `canvasX/Y` = position within its plan's **안건 canvas**. Nullable → auto-layout fallback.
- **SubPlanEdge** — `workspaceId, planId, sourceSubPlanId, targetSubPlanId` — the directed arrows ("decide 동네 before 예산") on the 안건 canvas. Unique(source, target).
- **Option (선택지)** — `workspaceId, subPlanId, title, description?, sortOrder, createdByUserId`
- **OptionRating (평가)** — `workspaceId, optionId, userId, score (1–5), comment?` — **Unique(optionId, userId)**; upserted (a member edits their own rating in place).
- **Decision (결정)** — `workspaceId, subPlanId, chosenOptionId, reason, decidedByUserId, supersededAt?`
  - Re-deciding inserts a **new** row; the current decision for an 안건 = the latest row where `supersededAt IS NULL`. Reopening sets `supersededAt` on the current row (and writes a PlanEvent). Full "we changed our mind" history is preserved.
- **PlanEvent** — `workspaceId, planId, subPlanId?, type, actorUserId, payload(JSON), createdAt` — **append-only** audit log; the single source for both the per-계획 timeline and the workspace feed.
  - `type ∈ {PLAN_CREATED, SUBPLAN_ADDED, OPTION_ADDED, DECISION_LOCKED, DECISION_REOPENED, DECISION_CHANGED}`. Written in the **same transaction** as the mutation that caused it.

### Derived / not stored

- **Aggregate score** per 선택지 = `avg(rating.score)` + count, computed on read.
- **안건 status** = `대기` (no options yet) / `진행 중` (options, no active decision) / `결정됨` (has active decision).
- **계획 roll-up** (안건 count, 결정 count) computed on read for the roadmap node.
- **Workspace-level plan→plan edges**: **not** in v1 (the roadmap arrows between 계획s are deferred — §10). Lanes group plans for v1.

## 5. API surface (workspace-scoped via `@CurrentWorkspace`; membership enforced by `WorkspaceContextFilter`; errors RFC 7807)

```
# Plans / roadmap
GET    /api/plans                     # roadmap: plans + positions + group + roll-up counts
POST   /api/plans
GET    /api/plans/{id}                # full tree: subplans(+pos) + edges + options + ratings + current decision
PATCH  /api/plans/{id}                # title/desc/status/canvasX/canvasY/groupLabel
DELETE /api/plans/{id}

# SubPlans (안건) + canvas edges
POST   /api/plans/{id}/subplans
PATCH  /api/subplans/{id}             # title/desc/sortOrder/canvasX/canvasY
DELETE /api/subplans/{id}
POST   /api/plans/{id}/edges          # {sourceSubPlanId, targetSubPlanId}
DELETE /api/edges/{id}

# Options (선택지)
POST   /api/subplans/{id}/options
PATCH  /api/options/{id}
DELETE /api/options/{id}

# Ratings (평가) — current user is implicit
PUT    /api/options/{id}/rating       # upsert {score, comment?}
DELETE /api/options/{id}/rating

# Decision (결정)
POST   /api/subplans/{id}/decision    # lock {chosenOptionId, reason}  (re-lock supersedes)
POST   /api/subplans/{id}/decision/reopen

# History
GET    /api/plans/{id}/timeline       # this plan's PlanEvents, newest-first
GET    /api/decision-feed             # workspace-wide recent PlanEvents
```

Batch position saves (drag): `PATCH /api/plans/{id}` / `PATCH /api/subplans/{id}` are debounced client-side; a future bulk endpoint is deferred (§10).

## 6. The two canvases (UX)

**Workspace roadmap** (`/decisions`): infinite canvas of **계획 nodes** showing title + roll-up (안건 N · 결정 M) + status color (결정됨 green / 진행 중 accent / 대기 dashed-dim). Optional lanes by `groupLabel`. Double-click a 계획 → its 안건 canvas.

**안건 canvas** (`/decisions/:planId`): infinite canvas of **안건 nodes** wired by SubPlanEdges (the order decided in). A node is **collapsed by default** (title + status + "선택지 N"); expanding reveals the **선택지 sub-stack** (each option: avg score; expand an option → each member's score + comment + the current user's inline 1–5 widget + comment). A decided 안건 shows a **결정 banner** (chosen 선택지 + reason + who/when + quiet 다시 열기). Actions per node: + 선택지, 결정하기.

**Timeline**: per-계획 chronological list of PlanEvents (the "story"), reachable from the 안건 canvas; the workspace feed is a lightweight roll-up of the same events on the roadmap screen.

Frontend: lazy-loaded routes; React Query with workspace-scoped keys `['plans', wsId, …]` / `['plan', wsId, planId]` / `['decision-feed', wsId]`; nav entry "결정"/"로드맵". No setState-in-effect; React-Compiler-clean.

## 7. Error handling & testing

- **Errors**: typed domain exceptions → RFC 7807 ProblemDetail via the existing `ApiExceptionHandler` / `ApiException` base. New types: `PlanNotFound` (404), `SubPlanNotFound` (404), `OptionNotFound` (404), `RatingOutOfRange` (400, score∉1..5), `OptionNotInSubPlan` (400, decision references foreign option), `DecisionAlreadyOpen`/`NoActiveDecision` (409 on reopen edge cases). All carry Korean `detail`.
- **Optimistic locking**: `@Version` on all entities (concurrent rating/decision edits by two members → 409, surfaced as a "다시 불러오기" retry).
- **Tests** (backend, `shared_docs_test` profile): rating upsert + range; decision lock → supersede → reopen history; PlanEvent written per mutation; workspace isolation (member of ws-A can't read ws-B's plan → 403/404); aggregate computation. Frontend: tsc + build clean; canvas interaction smoke as it lands.

## 8. Phased build order (cautious, one session each)

Positions/edges are nullable, so early phases work without the canvas and later phases layer it in **without a data migration**.

- **D1 — Backend foundation + plain CRUD UI.** Entities, migration, repos/services/controllers, RFC 7807 exceptions, tests. A plain (non-canvas) list/document UI to create 계획/안건/선택지, rate, lock/reopen decisions. **Proves the model and logic end-to-end before any canvas risk.**
- **D2 — Read-only 안건 canvas.** React Flow renders one plan's 안건 nodes (auto-layout from data, positions ignored), expand → 선택지 sub-stack, status styling. View only.
- **D3 — Free-form drag + persistence.** Drag nodes, draw/delete edges, persist canvasX/Y + SubPlanEdges (debounced). Create 안건 on the canvas.
- **D4 — Workspace roadmap level.** The second canvas: 계획 nodes, lanes by groupLabel, drill-in, roll-up counts.
- **D5 — Timeline + feed + polish.** Per-계획 timeline, workspace decision feed, transitions, empty states, mobile read.

Each sub-phase gets its own implementation plan (writing-plans) when it starts. **D1 is next.**

## 9. Branch / deploy

New branch (e.g. `decisions` or per-sub-phase `decisions-d1`) off `main`. Does **not** merge to `main` until the user says. Same deploy path as prior phases (push `main` → Backend CD on the Mac Mini self-hosted runner + Vercel; migrations additive). Never hand-restart the prod container.

## 10. Deferred (explicit YAGNI)

- First-class **Group/Lane entity** (v1 uses free-text `groupLabel`).
- **Plan→plan edges** on the workspace roadmap (v1 groups plans into lanes only).
- **Threaded discussion** per 안건 (overlaps the shared-notes pillar).
- **Cached/denormalized aggregate score** (computed on read in v1).
- **Bulk position-save endpoint** (per-node debounced PATCH in v1).
- **Notifications** of decisions (out of product scope per VISION §6).
- **Cross-workspace sharing** of a 계획 (that's Phase E's ShareGrant, still skipped).

## 11. Open questions to confirm at D-each-phase start

- D2/D3: exact React Flow custom-node component boundaries (one node component per type vs a polymorphic node).
- D4: do lanes need explicit ordering, or is free placement enough?
- D5: timeline visual — vertical list vs a mini-map overlay on the canvas.
