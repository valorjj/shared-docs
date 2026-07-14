# Decisions Canvas v2 — Design Spec

> **Status:** design, awaiting user review → then `writing-plans`.
> **Date:** 2026-07-14
> **Pillar:** Decisions (계획→안건→선택지→결정)
> **Inspiration:** n8n — an infinite, grid-anchored canvas where a group traces a decision *flow* spatially, with nodes that merge and diverge freely.

## 1. Goal

Turn the Decisions surface from a **list of 안건 cards** into an **n8n-style node graph** where every 안건 and every 선택지(option) is a draggable node, and the **choices themselves are the edges of the flow**: choosing an option branches to the next 안건. The canvas becomes the *primary* way a group reads and builds a decision, collapsing — once decisions are made — from a full contingency map into the highlighted trail actually taken.

One sentence: **the graph IS the reasoning trail.**

## 2. What already exists (do not rebuild)

- `@xyflow/react` v12 canvas as a secondary **캔버스** tab (`PlanCanvas.tsx`, `SubPlanCanvasNode.tsx`, `DeletableEdge.tsx`).
- One node type: `subplan` (안건) — title + status + expandable 선택지 list. **No option/decision nodes.**
- Edges = freeform 안건→안건 links (`sub_plan_edges`, V16), drawn as deletable bezier arrows.
- 안건 positions **already persist** to backend (`sub_plans.canvas_x/y`, debounced `PATCH /api/subplans/{id}`); null → auto-laid-out left→right row.
- The **목록(list)** view is today's mature, primary editing surface; **기록(timeline)** is a separate read view. All three tabs consume the same `PlanTree`.
- Options belong to exactly one 안건 (`OptionNode` nested in `SubPlanNode`); options have **no** canvas position today.
- Realtime = AFTER_COMMIT change-signal (`DecisionChangePublisher.changes.publish(wsId, planId)` → clients invalidate/refetch). **Not** Yjs-on-data.

## 3. Core model (decided with user)

A **DAG** (directed, merge+diverge allowed), two edge kinds:

```
   ┌─────────────────┐
   │ ● 새 차 vs 중고?   │   안건 node (question). left input handle.
   │   🏠  진행 중       │
   └──┬──────────┬────┘
      ┊(auto)    ┊(auto)          ┊ dashed = OWNERSHIP (안건 owns option), auto-drawn
   ┌──┴──┐    ┌──┴──┐             ─ solid  = FLOW (option → downstream 안건), user-drawn
   │□ 새차│    │□ 중고│   option nodes
   │ 3표 ✓│    │ 1표  │
   └──┬──┘    └──┬──┘
      │          │
      └─→[금융 안건] └─→[상태점검 안건]      diverge: one 안건's options fan out
            ↑
   (another option elsewhere can also point here → merge)
```

### Decisions taken during brainstorming

| # | Question | Decision |
|---|----------|----------|
| 1 | Ambition | Structural rethink — canvas becomes primary, choices become the path. |
| 2 | Edge meaning | Decision tree / **every option can branch**; chosen branch glows, unchosen dim after a decision. |
| 3 | Tree or graph | **Graph (DAG)** — merge and diverge freely. |
| 4 | 안건↔option binding | **Owned** — an 안건 auto-spawns its option nodes + the dashed ownership link; option can't exist without its 안건. |
| 5 | Node granularity | **Both 안건 and 선택지 are first-class draggable nodes.** |
| 6 | Primacy + detail | **Canvas = default surface; click node → slide-in right detail panel** (graph stays visible). 목록/기록 remain alternate tabs. |
| 7 | Freeform `sub_plan_edges` | **Kept** as a lightweight, dashed **관련(see-also)** link — de-emphasized, non-flow. Nothing migrates/breaks. |
| 8 | 서브안건 (`parentSubPlanId`) | **Off-canvas for the first cut** — stays in data + detail panel (child opens from parent's panel). On-canvas "contains" grouping deferred to a later phase. |

### Edge kinds summary

| Kind | Source → Target | Who draws | Visual | Storage |
|------|-----------------|-----------|--------|---------|
| Ownership | 안건 → its option | Auto (on option create) | Dashed, muted, no arrowhead | Implicit (option belongs to 안건) — **not a row** |
| **Flow** (new) | **option → 안건** | **User** | Solid, arrowhead; glows if chosen / dims if unchosen after decision | **`option_flow_edges`** (new table) |
| 관련 (existing) | 안건 → 안건 | User | Dashed, muted, arrowhead | `sub_plan_edges` (unchanged) |

## 4. Data model & backend

**Flyway V28** (`ddl-auto: validate`, so migration is authoritative):

1. `options` gains `canvas_x DOUBLE NULL`, `canvas_y DOUBLE NULL` (mirrors `sub_plans`).
2. New table `option_flow_edges`:
   - `id BIGINT PK AUTO_INCREMENT`
   - `plan_id BIGINT NOT NULL` FK → `plans(id)` ON DELETE CASCADE (scopes the query + realtime)
   - `source_option_id BIGINT NOT NULL` FK → `options(id)` ON DELETE CASCADE
   - `target_sub_plan_id BIGINT NOT NULL` FK → `sub_plans(id)` ON DELETE CASCADE
   - `created_at`, `created_by` (mirror existing edge/audit columns)
   - `UNIQUE(source_option_id, target_sub_plan_id)` — no duplicate flow between the same pair.
   - **No cycle enforcement in DB** (DAG-ness is a client/service guard, see §7).

**Entities / repos** (Kotlin, layered): `OptionFlowEdge` entity; `OptionFlowEdgeRepository` with `findAllByPlanId(planId)` (batch, avoid N+1) and `deleteById`. Option gains `canvasX/canvasY` fields.

**Service** — extend the decisions service seam that already owns edges:
- `addFlowEdge(sourceOptionId, targetSubPlanId)` — validates both belong to the **same plan**; rejects self/duplicate; **rejects a target that would create a cycle** (§7); publishes change-signal; emits a `FLOW_EDGE_ADDED` timeline event (mirror existing edge events).
- `deleteFlowEdge(id)` — author-or-plan-owner-or-admin (mirror existing edge delete authz); `FLOW_EDGE_REMOVED` event; change-signal.
- `moveOption(optionId, canvasX, canvasY)` — mirrors `moveSubPlan`; fire-and-forget PATCH, debounced client-side; **not lock-gated** for position (positioning is not content) — matches how `moveSubPlan` behaves.
- Flow edges + option positions are **purged with their option/plan** via FK cascade (no manual sweep).

**Endpoints** (RFC-7807 errors via `ApiException`):
- `POST /api/options/{id}/flow-edges` body `{ targetSubPlanId }` → `FlowEdgeResponse`
- `DELETE /api/flow-edges/{id}`
- `PATCH /api/options/{id}` body `{ canvasX, canvasY }` (reuse pattern of subplan move; add fields to the existing option-patch DTO or a dedicated move endpoint mirroring `moveSubPlan`)

**`PlanTree` response additions** (consumed by canvas + list, so additive/back-compat):
- `OptionResponse` gains `canvasX: Double?`, `canvasY: Double?`.
- `PlanTree` gains `flowEdges: FlowEdgeResponse[]` (`{ id, sourceOptionId, targetSubPlanId }`).

**Locking:** flow-edge create/delete **is** gated by the plan lock (structure change), consistent with how `sub_plan_edges` and 안건 structure behave when a plan is locked. Option *position* is not gated (view arrangement, not content).

## 5. Frontend

**Types** (`src/features/decisions/types.ts`): `OptionNode` gains `canvasX/canvasY: number | null`; add `FlowEdge = { id; sourceOptionId; targetSubPlanId }`; `PlanTree` gains `flowEdges: FlowEdge[]`.

**API** (`src/features/decisions/api.ts`): `useAddFlowEdge(sourceOptionId)`, `useDeleteFlowEdge()`, `useMoveOption(optionId)` (debounced, fire-and-forget like `useMoveSubPlan`).

**Canvas** (rework `PlanCanvas.tsx`):
- Register **two** node types: `subplan` (reworked) and **`option`** (new `OptionCanvasNode.tsx`).
- Register edge types: `flow` (new, solid, arrow, glow/dim) and reuse `deletable` for the 관련 dashed link (relabel visually as muted dashed).
- Build nodes from the tree: each 안건 → a `subplan` node; each of its options → an `option` node. Ownership links → auto `flow`-style dashed edges (`type: 'ownership'`, non-deletable, non-interactive).
- **Positioning:** 안건 uses existing `canvas_x/y`; options use new `canvas_x/y`. Null → auto-layout: place an 안건, fan its option nodes just below/right of it in a small cluster; then lay clusters left→right. Persist on drag-stop (both node kinds).
- **Grid-snap:** enable `snapToGrid` + `snapGrid={[16,16]}` (or the app's `--sp` rhythm) for the "grid-anchor for cleaner arrangement" ask. Keep `<Background variant="dots">` + `<Controls>` + add **`<MiniMap>`**.
- **Drawing flow:** an `option` node's right **source** handle → an `subplan` node's left **target** handle creates a flow edge (`onConnect` → `useAddFlowEdge`). Connecting anything else is rejected (React Flow `isValidConnection`).
- **Delete flow:** select edge → ✕ (existing `DeletableEdge` pattern) → `useDeleteFlowEdge`.
- **Lock-aware:** when plan locked, disable drag/connect/delete (as today); positions still render.
- Keep the "seed controlled state once at mount, ignore refetch while mounted" behavior, but ensure the change-signal refetch is reflected on remount (acceptable for v1; live in-place merge is a later polish).

**Node anatomy** (Bear-minimal: hairline border, accent tint via `--card-accent`, Lucide, no shadow):
- *안건 (`SubPlanCanvasNode`)*: status dot + `icon` + title; muted meta `선택지 N`; deadline chip if set; left target handle. Click → open panel for this 안건.
- *option (`OptionCanvasNode`)*: title; vote pill (`Vote` + count); chosen ✓ (`Check`) when `isChosen`; muted micro-counts `자료 N`/`장단점 N`; left target handle (dashed ownership in), right source handle (flow out). Click → open panel for this option.
- **Glow/dim:** after an 안건 is decided, the chosen option node + its outgoing flow edges get an emphasized class; unchosen option nodes + their flow edges get a `dimmed` class (reduced opacity). Pure CSS off the existing `decision`/`isChosen` data.

**Detail panel** (`NodeDetailPanel.tsx`, new): slides in from the right (`position: fixed`, hairline left border, theme-aware, focus-trap + Esc + backdrop-less click-out on canvas). Renders the **existing** detail content per node kind:
- 안건 → description, deadline, status, 서브안건 list (opens child in panel), 논의.
- option → description, **장점/단점** (`ProConSection`), **자료** (`OptionResourceSection`), vote, **댓글** (`Comments`).
- Reuses the components already built for the 목록/detail-page surfaces — the panel is a new *container*, not new content.

**Primacy:** `PlanDetail` default `view` becomes `'canvas'`; 목록/기록 remain switchable. Canvas mounts with `fitView`.

## 6. Phasing (each phase is independently shippable)

1. **Backend foundation** — V28 migration, `OptionFlowEdge` entity/repo, option `canvas_x/y`, service methods (add/delete flow edge, move option, cycle guard), endpoints, `PlanTree` wiring, timeline events, realtime, **tests** (TDD: cycle rejection, cross-plan rejection, duplicate rejection, authz, cascade purge). No UI yet.
2. **Canvas graph** — option nodes + ownership links + flow edges rendered; drag-persist for options; draw/delete flow edges; `isValidConnection` guard; grid-snap + minimap. Still a tab.
3. **Detail panel** — click node → slide-in panel reusing existing detail content; a11y (focus-trap/restore — carry the fix owed from the ImageLightbox follow-up).
4. **Decision glow/dim + make canvas the default view + polish** — chosen-path emphasis, unchosen dim, auto-layout cluster tuning, empty-state.
5. **(Deferred) Community layer** — live cursors/presence on canvas + comments pinned to canvas coordinates. Not in this build; noted for later.

## 7. Edge cases & error handling

- **Cycles:** flow edges must not create a cycle (would break "trail" semantics and layout). Service runs a reachability check on add (`target` must not reach `source` via existing flow edges); reject with RFC-7807 `409`-style `ApiException`. Client surfaces a toast.
- **Cross-plan / cross-workspace:** source option and target 안건 must share the same `plan_id`; reject otherwise. (Workspace scoping is already enforced by the X-Workspace-Id filter upstream.)
- **Duplicate flow:** `UNIQUE(source_option_id, target_sub_plan_id)` + service pre-check → idempotent reject.
- **Deleting an option / 안건 / plan:** FK cascade removes its flow edges and positions — no orphans, no manual sweep.
- **Locked plan:** structural edits (add/delete flow, add option) blocked; drag/position blocked; read + panel still work.
- **Null positions:** auto-layout fallback (never crash on missing coordinates).
- **Concurrency:** two users drawing edges → change-signal refetch reconciles; unique constraint prevents dup rows.

## 8. Testing strategy

- **BE (TDD, JUnit):** flow-edge add happy path + cycle/cross-plan/duplicate/authz rejections; move-option persistence; cascade purge (delete option → edges gone; delete plan → all gone); `PlanTree` serialization includes positions + flowEdges; timeline events emitted; realtime signal published. Mirror `sub_plan_edges` / `OptionResourceService` test patterns.
- **FE:** type/build gate (`npm run build`); manual 2-browser smoke (draw flow, merge, diverge, decide→glow/dim, drag-persist across reload, panel open/close, lock behavior, realtime). Component-level: `isValidConnection` rejects illegal handles; panel renders correct content per node kind.

## 9. Non-goals (this build)

- Live presence/cursors and canvas-pinned comments (Phase 5, deferred).
- On-canvas 서브안건 nesting/grouping (later phase).
- Auto-layout algorithms beyond a simple cluster fan-out (no dagre/elk yet).
- Migrating or removing existing `sub_plan_edges` (kept as-is, relabeled 관련).
- Mobile canvas gestures beyond React Flow defaults.

## 10. Open questions for user review

- **Q1 (#7):** keep `sub_plan_edges` as dashed 관련 link — OK, or retire it entirely? *(spec assumes keep)*
- **Q2 (#8):** 서브안건 off-canvas for v1 — OK, or must it be on the canvas from day one? *(spec assumes off-canvas)*
- **Phasing:** is 5-phase slicing right, or do you want canvas-primacy (currently Phase 4) pulled earlier?
