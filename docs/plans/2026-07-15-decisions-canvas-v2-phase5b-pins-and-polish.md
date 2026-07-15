# Decisions Canvas v2 — Phase 5b: Canvas-Pinned Comments (+ Canvas Polish)

**Date:** 2026-07-15
**Status:** Design (approved for planning)
**Scope:** Backend (Flyway V29) + Frontend. Repos: `shared-docs-backend` (BE, git `valorjj`, this machine = CD runner) + `shared-docs` (FE, Vercel auto-deploy).
**Depends on:** Phases 1–5a (shipped). Builds on the P5a canvas overlay + live-drag machinery.

---

## 1. Goal

Two bundled things (user chose to fold them into one cycle):

**(A) Canvas polish / fixes** surfaced by the P5a smoke test:
1. **Always land on canvas** — opening a plan always shows 캔버스 (drop the P4 per-plan landing memory).
2. **Right-click works on the canvas** — currently no context-menu handler is wired; this is also the create entry point for pinned comments.
3. **Non-overlapping auto-layout** — the index-based layout (`i * 520`) drops downstream 안건 on top of upstream option columns; replace with a dagre layered layout for un-positioned nodes + a 정렬 button.
4. **캔버스로 이동 button** on the 안건 detail page.

**(B) Canvas-pinned comments** — free-floating comment pins dropped anywhere on the canvas (including empty space), each hosting a comment thread. Annotates the *flow/region* itself — the thing node-panel comments (Phase 3) can't do. Figma/n8n-style: create, reply, drag, resolve/reopen, delete.

**Out of scope (deferred):** node focus/viewing halo; pins attached to nodes (free-floating only); cross-instance realtime.

## 2. Locked design decisions

- **Pin = free-floating canvas point** (not attached to a node).
- **Create via right-click** empty pane → `여기에 댓글` (reuse V26 `ContextMenu`/`useContextMenu`).
- **Lifecycle:** delete + drag-to-reposition + resolve/reopen, all in v1.
- **Thread reuses the existing comment system**, keyed `pageId = pin:{pinId}` — the whole thread UI, realtime, author/edit/delete come for free.
- **Created only on first-comment submit** (atomic create-with-content) — no orphan empty pins.
- **Not lock-gated** (pins are discussion): create / reply / resolve / delete allowed on a locked plan. Only pin **dragging** follows canvas interactivity (disabled when locked, like nodes).
- **Landing view:** always canvas (drop per-plan view memory).
- **Auto-layout:** `@dagrejs/dagre` layered layout for nodes without a saved `canvasX/Y`; saved/dragged positions always win; a **정렬** button re-tidies + persists all.

## 3. Backend (V29) — canvas-pinned comments

### 3.1 Migration `V29__comment_pins.sql`
New table `comment_pins`:
- `id BIGINT AUTO_INCREMENT PK`
- `workspace_id BIGINT NOT NULL` → FK `workspaces(id)` ON DELETE RESTRICT
- `plan_id BIGINT NOT NULL` → FK `plans(id)` ON DELETE RESTRICT
- `canvas_x DOUBLE NOT NULL`, `canvas_y DOUBLE NOT NULL`
- `resolved BOOLEAN NOT NULL DEFAULT FALSE`
- `created_by BIGINT NULL` → FK `users(id)` ON DELETE SET NULL
- `version BIGINT NOT NULL DEFAULT 0` (optimistic lock)
- `created_at`, `updated_at` (timestamps, match existing entities)
- Index `idx_comment_pins_plan (plan_id)`

FKs `ON DELETE RESTRICT` + **app-level cascade cleanup** — mirrors V28 `option_flow_edges` exactly (`ddl-auto: validate`).

### 3.2 Entity / Repository / Service / Controller (mirror `OptionFlowEdge`, V28)
- `CommentPin` entity (`@Version` on `version`, `FetchType.LAZY` relations).
- `CommentPinRepository`: `findAllByPlanId`, `findByIdAndWorkspaceId`, `deleteAllByPlanId` (or find+delete for cascade).
- `CommentPinService`:
  - `create(planId, x, y, content)` — validate plan-in-workspace; create pin; create the first `Comment` with `pageId = "pin:{pinId}"` via the existing comment service/repo, in ONE transaction; publish change. **Not lock-gated.**
  - `move(id, x, y)` — workspace-scoped; **lock-gated** (canvas position mutation, like `updateSubPlan`/`updateOption`); publish.
  - `setResolved(id, resolved)` — workspace-scoped; **not lock-gated**; publish.
  - `delete(id)` — workspace-scoped; **not lock-gated**; delete pin + its `pin:{id}` comments (app cascade); publish.
- `CommentPinController` — four endpoints (two narrow PATCHes so lock enforcement is unambiguous):
  - `POST /api/plans/{planId}/comment-pins` `{ x, y, content }` → 201 `CommentPinResponse` (not lock-gated)
  - `PATCH /api/comment-pins/{id}/position` `{ x, y }` → 200 (**lock-gated** via `PlanLockGuard`)
  - `PATCH /api/comment-pins/{id}/resolved` `{ resolved }` → 200 (not lock-gated)
  - `DELETE /api/comment-pins/{id}` → 204 (not lock-gated)

### 3.3 PlanTree
Add `commentPins: CommentPinResponse[]` to the tree DTO, loaded in `getTree`. `CommentPinResponse = { id, x, y, resolved, commentCount, createdBy }` (`commentCount` = count of `pin:{id}` comments, for the node badge).

### 3.4 Realtime
Each mutation → `DecisionChangePublisher.changes.publish(workspaceId, planId)` AFTER_COMMIT. **No PlanEvent** (live canvas state). The existing change-signal fans out to `decisionKeys` + `commentKeys` on every client.

### 3.5 Tests
BE has a test suite (`./gradlew test`). Cover: create-with-first-comment atomicity; move lock-gated (locked plan → 409/403 per `PlanLockGuard` convention); resolve NOT lock-gated; delete cascades `pin:{id}` comments; cross-workspace access rejected; plan purge removes pins + their comments; optimistic-lock 409 on stale version.

## 4. Frontend — canvas fixes

### 4.1 Always land on canvas
`PlanDetail.tsx`: view initializer returns `'canvas'` unconditionally; **remove** the `localStorage.getItem('plan-view-…')` read AND the persist `useEffect`. Tab switches are ephemeral (reset to canvas on the per-plan `PlanDetailRoute` remount).

### 4.2 Right-click infra (`PlanCanvas`)
- `onPaneContextMenu(e)` → `e.preventDefault()`; `screenToFlowPosition` the point; open `ContextMenu` (reuse `components/ui` `useContextMenu`) at the cursor with a single item **여기에 댓글** → opens the pin composer (§5.3).
- `onNodeContextMenu(e, node)` → `e.preventDefault()`; open the existing V26 안건/선택지 context menu with the actions that apply on canvas (열기 → open panel; appearance color/icon for 안건; 삭제). Reuse the existing menu component; do not rebuild it.
- Both suppress the browser default menu.

### 4.3 dagre auto-layout (`PlanCanvas`)
- Add dep `@dagrejs/dagre` (layout-only).
- `buildNodes`: for nodes **without** a saved `canvasX/Y`, compute positions via a dagre graph (rankdir `LR`; ranks driven by flow edges so downstream 안건 land in the next rank; each 안건's option nodes grouped as its immediate successors so they stay in-column and don't collide with the next 안건). Saved positions win verbatim.
- **정렬 button** in the toolbar (next to 안건 추가; lock-gated): recompute the full dagre layout for all nodes and persist each via the existing `useMoveSubPlan`/`useMoveOption` (fire-and-forget), then let the change-signal reconcile. Confirm-free (positions are non-destructive/reversible by dragging).

### 4.4 캔버스로 이동 button (`SubPlanDetail`)
Add a `PageHeader` action button **캔버스에서 보기** → navigate to `/decisions/{planId}?focus=sp:{subPlanId}`. `PlanDetail`/`PlanCanvas` read `?focus`: if that node exists on-canvas, select + center (`fitView`/`setCenter`) it and open its panel; if not (nested 안건 not rendered on canvas), just land on canvas. Best-effort, non-blocking.

## 5. Frontend — pinned comments

### 5.1 Types & API (`features/decisions`)
- `types.ts`: `CommentPin = { id: number; x: number; y: number; resolved: boolean; commentCount: number; createdBy: number | null }`; `PlanTree.commentPins: CommentPin[]`.
- `api.ts`: `useCreateCommentPin(planId)` (invalidate `decisionKeys.scope` + `commentKeys.scope`), `useMoveCommentPin()` (fire-and-forget, no invalidation — mirrors `useMoveOption`), `useSetCommentPinResolved()`, `useDeleteCommentPin()`.

### 5.2 `CommentPinNode` (+ `.module.css`)
Custom node, data `{ pin, resolved }`: Lucide `MessageCircle` (line icon, never emoji) inside a hairline circle + comment count; `resolved` → dimmed (opacity, reuse the P4 dimmed treatment). Bear-minimal — no shadow/lift. Non-connectable (`isValidConnection` already rejects non-opt→sp). Registered in `nodeTypes` as `pin`; id namespaced `pin:{id}`; `parseNodeId` extended to recognize `pin`.

### 5.3 Create flow
V26 menu 여기에 댓글 → a small composer popover anchored at the flow point (via `flowToScreenPosition`, matching the P5a overlay technique). Submit → `useCreateCommentPin({ x, y, content })`; on success the change-signal refetch brings the pin in via the sync effect. Cancel/empty → nothing persisted.

### 5.4 Live sync effect (`Flow`)
Mirror P5a's peer-drag effect: an effect keyed on `tree.commentPins` that reconciles `pin:` nodes into the seeded nodes array — add new, remove deleted, reflect `resolved` — WITHOUT touching 안건/선택지 nodes, and skipping the pin the local user is currently dragging (reuse the P5a `localDragId` guard) and no-op position writes. Gives live peer pins on a seed-once canvas.

### 5.5 Open / resolve / delete
Click a pin → reuse the Phase-3 slide-in `Panel` (right): header shows 해결/다시 열기 (→ `useSetCommentPinResolved`) + 삭제 (→ `useDeleteCommentPin`, closes panel); body renders `Comments pageId={\`pin:${id}\`}` (the whole existing thread, already realtime). Pin drag persists via `useMoveCommentPin` on `onNodeDragStop` (routed by the `pin:` prefix), rides P5a live-drag.

### 5.6 해결된 댓글 표시 toggle
A single toggle in the canvas toolbar (off by default). Off → resolved pins hidden (filtered out of the pin nodes); on → shown dimmed. Local UI state (not persisted); Bear-minimal control.

## 6. Edge cases & guardrails

- **No orphan pins** — create only on first-comment submit; cancel writes nothing. Deleting the last comment leaves the pin (an intentional anchor); removal is explicit via 삭제.
- **dagre fills nulls only** — never clobbers a saved/dragged position; 정렬 is the explicit re-tidy.
- **Sync-effect vs local drag** — P5a `localDragId` guard prevents a refetch from fighting an in-progress pin drag; unchanged positions skip `setNodes`.
- **Optimistic concurrency** — `version` on `comment_pins`; stale move/resolve → 409 → refetch.
- **Right-click** — `preventDefault` on both handlers so no browser menu; `ContextMenu` primitive handles Esc/backdrop close.
- **Lock** — move gated (locked → disabled drag + guarded endpoint); create/reply/resolve/delete allowed on locked plans (discussion continues).
- **Focus param** — `?focus` is best-effort; absent/off-canvas node → just land on canvas, no error.

## 7. Testing

- **BE:** `./gradlew test` green, plus the §3.5 cases.
- **FE:** no unit runner → gate is `npm run build` + `eslint` touched files.
- **Manual smoke (owed by user):** land on canvas; right-click pane → 여기에 댓글 → create (and cancel writes nothing); reply; resolve/reopen + 해결된 댓글 표시 toggle; drag pin (persists + glides on a 2nd browser); delete removes pin + thread; 정렬 tidies without clobbering a dragged node; downstream 안건 no longer overlaps options; node right-click menu works on canvas; 캔버스에서 보기 lands (and focuses when the node is on-canvas).

## 8. Implementation slices (for the plan)

1. **BE slice** — V29 migration + entity/repo/service/controller + two PATCH endpoints + PlanTree.commentPins + realtime + tests. Independently shippable/verifiable (flyway + gradlew test).
2. **FE canvas-fixes slice** — always-land-canvas, right-click infra (pane + node menu), dagre + 정렬, 캔버스에서 보기. No dependency on pins BE except right-click 여기에 댓글 item (stub → wired in slice 3).
3. **FE pins slice** — types/api, `CommentPinNode`, create composer, sync effect, Panel thread + resolve/delete, drag persist, 해결된 댓글 표시 toggle.

## 9. Conventions

Portfolio-grade BE (Flyway, FK constraints, optimistic locking, RFC-7807, `ddl-validate`). Bear-minimal FE (hairlines, no shadow/lift, Lucide icons, Korean UI, `--c-*`/`--sp-*`/`--r-*` tokens). Commit per task; push/deploy only on explicit user approval; confirm the live V29 Flyway migration before running it on prod.
