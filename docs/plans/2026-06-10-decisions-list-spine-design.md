# Decisions List View — Order-Spine, Connection Layer & Reorder (Design)

> **Status:** design — approved for plan-writing 2026-06-10.
> **Builds on:** the `decisions-list-links` branch (shipped-but-unmerged dashed `연결 →` chips + click-to-jump). This design extends that branch; it does **not** start from `main`.

## 1. Goal

Make the Decisions **목록 (list)** view express the same connections the **캔버스 (canvas)** view shows, in a way that fits a calm, full-width reading list — *without* turning the list into a second canvas.

The driving realization: the list carries **two distinct relationships**, and they must not be conflated into one visual.

- **Order / sequence** (`subPlan.sortOrder`) — inherently linear, always continuous. Represented by a **neutral order-spine** (a quiet dashed vertical line threading every card top-to-bottom).
- **Dependency / connection** (`edges`, a directed graph that can branch, skip, or be absent) — represented by a distinct **accent connection layer** (chips + hover-highlight + click-to-jump), never by the spine.

The spine answers "what order are these in?"; the accent layer answers "which depend on which?". Different visual weight, different meaning.

## 2. Scope

In scope (four pieces, in build order):

1. **Order-spine** — a continuous neutral dashed vertical connector rendered between consecutive 안건 cards in the list. Pure layout/CSS; no data change. Pending/unlinked items (e.g. `대기`) stay threaded — the spine never breaks.
2. **Connection accent layer** — keep the shipped dashed `연결 →` / `← 연결` chips and click-to-jump; **add hover-highlight**: hovering a card outlines it (source), lights its directly-linked 안건 in accent, dims the rest, and accents the spine segment(s) between adjacent linked cards.
3. **`연결` helper modal** — a per-card `연결` action opens a small modal listing the *other* 안건 in the plan with a checkbox each; checking creates an edge, unchecking removes it. Reuses `useCreateEdge` / `useDeleteEdge`; both now invalidate the decisions scope so the list and canvas stay in sync.
4. **Drag-to-reorder** (last) — sortable drag of the list cards rewrites `sortOrder` via a new **batch** backend endpoint. Frontend-light interaction (low-frequency action); one transactional endpoint, not N patches.

Explicitly **out of scope** (honest cuts):

- **Horizontal list mode / orientation toggle.** The canvas already *is* the spatial/horizontal view. A horizontal list would duplicate it. The three tabs stay distinct: 목록 = read·edit·decide (vertical), 캔버스 = arrange structure (spatial), 기록 = historical record (chronological). "Sync" means the views share the *same mutations* (and React Query cache), not that we build a second canvas.
- Rendering the full dependency graph (branching/non-adjacent edges) *as lines* in the list. Branching links live on the canvas; in the list they remain accent chips. The spine only ever draws between consecutive cards because it represents order, not edges.
- Any change to the canvas view itself, beyond the shared mutation invalidation in piece 3.

## 3. Architecture

### 3.1 Where the pieces live

```
src/features/decisions/
  PlanDetail.tsx            ← already computes linksBySubPlan + jumpToSubPlan (from the branch)
                              ADD: hoveredSubPlanId state + derived highlight sets;
                                   render the spine between SubPlanSection items;
                                   wire the 연결 modal open/close + reorder DnD container.
  SubPlanSection.tsx        ← ADD: hover handlers (onMouseEnter/Leave), highlight props
                              (variant: 'source' | 'linked' | 'dim' | 'normal'),
                              a 연결 action button, a drag handle (piece 4).
  SubPlanSection.module.css ← ADD: .source / .linked / .dim states (piece 2),
                              drag-handle + dragging styles (piece 4).
  ListSpine.module.css      ← NEW (or a .spine block in PlanDetail.module.css): the
                              neutral dashed connector + .active accent variant.
  ConnectModal.tsx          ← NEW: the 연결 helper modal (checkbox list of other 안건).
  ConnectModal.module.css   ← NEW.
  api.ts                    ← MODIFY useCreateEdge/useDeleteEdge to invalidate scope;
                              ADD useReorderSubPlans (piece 4).
  types.ts                  ← ADD ReorderSubPlansPayload (piece 4).
```

Backend (`shared-docs-backend/`, piece 4 only):

```
decision/ (existing package)
  SubPlanController.kt   ← ADD PATCH /api/plans/{planId}/subplans/order
  SubPlanService.kt      ← ADD reorder(planId, orderedIds): transactional sortOrder rewrite
  dto/...                ← ADD ReorderSubPlansRequest(orderedSubPlanIds: List<Long>)
```
No migration: `sub_plans.sort_order` already exists.

### 3.2 Data flow

- **Spine + hover (pieces 1–2):** entirely client-side, derived from the already-loaded `PlanTree` (`subPlans` ordered by `sortOrder`, `edges`). `PlanDetail` holds `hoveredSubPlanId`; from it and `linksBySubPlan` it derives, per card, a `variant`. No network.
- **연결 modal (piece 3):** opens with the source 안건; lists `tree.subPlans` minus self; initial checked state = existing edges touching the source (either direction). Checking calls `useCreateEdge`, unchecking calls `useDeleteEdge` (look up the edge id from `tree.edges`). Both mutations invalidate `decisionKeys.scope(activeId)` → list re-renders with new chips/spine accents, and the canvas (on next mount) shows the new edges. **Direction:** edges are directed (`source→target`). The modal creates `source = the card it was opened from`, `target = the checked 안건` (matches the canvas's drag-from-handle semantics). Existing edges in *either* direction count as "connected" for the checkbox state, but unchecking removes whichever edge exists.
- **Reorder (piece 4):** dragging reorders the cards locally (optimistic), then fires `useReorderSubPlans({ planId, orderedSubPlanIds })`. Backend rewrites `sortOrder` for the listed ids in one transaction (respecting `@Version` optimistic locking on each row). On success, invalidate scope; on error, roll back local order and surface the RFC 7807 detail.

## 4. Visual spec (Bear-aligned)

- **Spine:** `border-left: 2px dashed var(--c-border-strong)` on a zero-width element of fixed height (~30px) centered in the gap between cards; color is the *neutral* strong-border token, **not** accent. Continuous — rendered between every consecutive pair regardless of links or status.
- **Hover source card:** accent outline (`box-shadow: 0 0 0 1px var(--c-accent)` + `border-color: var(--c-accent)`), matching the existing focus-ring discipline (no lift, no shadow beyond the hairline ring).
- **Hover linked card:** softer accent border (a muted accent), no ring.
- **Dimmed cards:** `opacity: ~0.4`, transition `~150ms`.
- **Active spine segment** (between hovered source and an adjacent linked card): `border-left-color: var(--c-accent)`.
- **연결 modal:** standard `Modal` primitive; title `"{안건} — 연결"`, subtitle `"이 안건과 연결할 다른 안건을 선택하세요."`, a vertical checkbox list; checked rows show `연결됨 →`. Single-purpose, no extra chrome.
- **Drag handle:** a small Lucide grip icon (`GripVertical`) in the card header actions row, visible on hover/focus; dragging applies a subtle `--c-surface-tint` background, no shadow.

All Korean UI text. Lucide icons only. CSS Modules + tokens. One primary action per screen unchanged (the modal's confirm is implicit per-toggle, so no new primary button competes with `결정하기`).

## 5. Edge cases & error handling

- **Self-connection:** the modal omits the source 안건 from its own list (can't link to self), mirroring the canvas guard `c.source === c.target`.
- **Duplicate edge:** backend already rejects duplicates (canvas relies on it); the modal disables re-creating an existing edge by reflecting it as already-checked.
- **Branching / non-adjacent links:** spine does not attempt to draw them; they remain accent chips and participate in hover-highlight (linked cards light up wherever they are in the list). Only the *adjacent* linked pair gets an accent spine segment.
- **Unlinked / pending 안건:** stays threaded on the spine (order is still real); shows its `대기` badge; no chips.
- **Reorder concurrency:** batch endpoint is transactional; if any row's `@Version` is stale (someone else reordered), it 409s (RFC 7807) and the client refetches + re-applies.
- **Reorder of a single-item or empty plan:** DnD is a no-op (nothing to reorder); spine renders nothing for <2 cards.
- **연결 modal on a plan with only one 안건:** the list is empty → show a quiet "연결할 다른 안건이 없어요." line.

## 6. Testing

Frontend (Vitest / RTL where component tests exist; otherwise the `npm run build` + `npx tsc -b --noEmit` + `npx eslint src/` gate):
- `linksBySubPlan` / highlight-variant derivation is pure — unit-test it (source → {linked ids}; dim set = all − source − linked).
- ConnectModal: checked state reflects existing edges (either direction); toggling fires create/delete with correct direction; self excluded.
- Spine renders for n≥2 cards, absent for n<2.

Backend (JUnit, existing decision test suite):
- `reorder` rewrites `sortOrder` to match the given id order; idempotent; rejects ids not in the plan (RFC 7807 400); transactional (partial failure rolls back).
- Cross-tenant: reorder of a plan in another workspace 404s (workspace-scoped, per rule 9).

## 7. Build order (informs the plan)

1. **Order-spine** (frontend-only, no data) — fastest visible win.
2. **Hover-highlight** (frontend-only) — layers onto the shipped chips.
3. **연결 modal** (frontend-only; edge mutations already exist, add invalidation) — makes the list a first-class relationship editor.
4. **Drag-to-reorder** (frontend DnD + new batch backend endpoint) — last; the only schema-touching piece. Decide `@dnd-kit/sortable` vs native HTML5 DnD in the plan (lean: `@dnd-kit/sortable` for accessibility, unless avoiding the dep is preferred).

Pieces 1–3 ship as one frontend increment; piece 4 follows as a separate increment (frontend + backend) so it can be reviewed and deployed deliberately.
