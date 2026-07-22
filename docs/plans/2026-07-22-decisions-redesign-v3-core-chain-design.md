# Decisions Redesign v3 — Spec 1: The Core Vertical Chain (design)

**Status:** approved in brainstorm 2026-07-22. First of a sequence of specs (see Decomposition).

**Goal:** Replace the React Flow decision canvas with a mobile-first **vertical decision chain** — a calm, scroll-native record of a group's long-term decisions. An ordered sequence of 안건 (agenda items), each with 후보 (candidates); confirming one or more 후보 records the decision (with a date) and reveals the next 안건. Nothing locks; everything is reversible.

**Why:** The current canvas reads as a "boring admin page" and depends on desktop free-form dragging. Real users are friends/family on **phones**, recording **long-term decisions** as a living history ([[project_app_direction_lightweight]], purpose per [[project_decisions_redesign_v3]]). The app should **guide but never constrain**.

---

## 1. Product model (settled in brainstorm)

- **Linear gated chain.** 안건 form an ordered sequence. Each 안건 has 후보 candidates.
- **Progressive reveal (creation-gated, not display-hidden).** All existing 안건 are always shown in order. The affordance to **add the next 안건** appears only once the current frontier 안건 has ≥1 confirmed 후보. The everyday add action is **+ 후보** on the current 안건; creating the next 안건 is the reward for confirming.
- **Confirm = per-후보, multi, soft, reversible.** Any workspace member may confirm/revoke any 후보 at any time. An 안건 is **decided** when ≥1 of its 후보 is confirmed. Multiple confirmations are always allowed (no single/multi mode). No turnout gate — voting is advisory.
- **Vote ≠ confirm (kept separate).** A **vote** is a soft preference signal (shown as member avatar pips on a 후보). A **confirm** is the actual decision (a checkable circle + a decision date). Keeping them separate preserves "where everyone stood" as history.
- **No lock, ever.** The plan freeze feature is removed. Revoking a confirmation simply reopens that 안건 for reconsideration; it never cascade-wipes downstream 안건.
- **It's a record.** Each decided 안건 shows its decision date; the accumulated chain feeds the timeline view (Spec 4).

## 2. Layout & interaction (validated via mockup)

Mobile-first vertical spine (mockups persisted in `shared-docs/.superpowers/brainstorm/`):

- A vertical rail runs top→down. Each **안건** is a station: a dot on the rail + a title, an optional decision-date meta line, and a "N개 확정" badge when decided.
- Beneath each 안건, its **후보** render as a checklist of cards:
  - **Left circle** — tap to **confirm/revoke** (filled + card highlighted purple when confirmed; multi-select; reversible).
  - **Card body tap** — opens the 후보 **detail** (Spec 2 modal; out of scope here beyond wiring the tap target).
  - **Right avatar pips** — members who **voted** for this 후보.
- **+ 후보 추가** row closes each 안건's list (the one everyday add action).
- The rail segment through a **decided** 안건 is emphasized (purple = "the path taken"); pending 안건 dots are hollow/dashed.
- The **next 안건** create-affordance appears under the frontier 안건 only when it is decided.
- No pan, no zoom, no drag. Pure vertical scroll.

## 3. Data model changes

Reshape the existing Decisions schema (Flyway forward migration; no data preservation — see §5).

**Keep:** `Plan` (the decision plan; keep `status` ACTIVE/COMPLETED, `deadline`, `completedAt` — these are soft markers, not locks), `SubPlan` (안건; `sortOrder` **is** the chain order; keep `parent_sub_plan_id` for 서브안건 in Spec 3), `Option` (후보; keep `title`, `option_pro_cons`, `option_resources`/`option_attachments`), `OptionVote`, `Comment` threads (`plan:`/`subplan:`/`option:`).

**Add to `Option` (후보):** `confirmed BOOLEAN NOT NULL DEFAULT false`, `confirmed_at DATETIME(6) NULL`, `confirmed_by BIGINT NULL` (FK users, ON DELETE SET NULL). An 안건's decision date is derived (earliest `confirmed_at` among its confirmed 후보).

**Remove:**
- **`Plan.locked_at`** and the entire lock layer — `PlanLockGuard`, `assertUnlockedBy*`, lock/unlock endpoints, and every `!locked`/lock-gate check across the Decisions services and UI.
- **`Decision`** entity/table (single-winner `chosenOptionId` + frozen vote tally) — superseded by per-후보 `confirmed`. `결정하기`/`확정` single-choice endpoints replaced by per-후보 confirm/revoke.
- **`option_flow_edges`** (the hand-drawn DAG) — table, entity, repository, service, endpoints. Order is now purely `SubPlan.sortOrder`.
- **`sub_plan_edges`** (legacy 관련 edges) — no edges exist in the new model.
- **`comment_pins`** (V29) and all `CommentPin*` code + endpoints — canvas-pinned comments were tied to the free canvas, which no longer exists.
- **Canvas coordinates:** `Option.canvas_x/canvas_y` and `SubPlan` canvas positions — no free canvas.

**New endpoints:** `POST /api/options/{id}/confirm` and `DELETE /api/options/{id}/confirm` (or a single `PATCH …/confirm {confirmed}`) — set/clear a 후보's confirmed state, workspace-scoped, **not** lock-gated (no locks exist), realtime via the existing decisions change-signal, recording a timeline event (`OPTION_CONFIRMED`/`OPTION_REVOKED`) so the history/timeline captures revisions.

## 4. Views

The plan detail collapses **three tabs → two**:
- **The spine** becomes the single main view, replacing both today's 목록 (list) and 캔버스 (React Flow) tabs.
- **기록 (timeline)** stays as the second view; its redesign (alternating vertical axis per the sketch) is **Spec 4**. For Spec 1 it can keep the current timeline component.

Frontend deletions that follow: `PlanCanvas`, all React Flow node/edge components (`SubPlanCanvasNode`, `OptionCanvasNode`, `OwnershipEdge`, `DeletableEdge`), `canvasLayout.ts`/dagre, the slide-in `Panel` canvas wiring, `CommentPin*` components, `PresenceCursors`/`PresenceHalos`/`useSmoothedPresence` (realtime re-attaches later — §6), and `@xyflow/react` + `@dagrejs/dagre` dependencies once nothing imports them.

## 5. Existing data

This is a from-scratch redesign and the project's standing norm is **no backwards-compat / no data migration** (portfolio app). The Flyway migration **drops the removed tables/columns**; existing decisions rows that don't fit the new shape are discarded. Scope of the wipe is **Decisions tables only** — notes, sheets, calendar, calc, workspaces are untouched. (User confirmed 2026-07-22: they've only been test-driving Decisions.)

## 6. Deferred to later specs (explicitly out of scope for Spec 1)

- **Spec 2 — 후보/안건 detail modal + rich 장점·단점 editor** (HTML editor with image/link attach, replacing the plain `option_pro_cons` lists). Card-tap wiring is stubbed in Spec 1.
- **Spec 3 — 서브안건 zoom-in** nested chain with a zoom-into-the-안건 animation.
- **Spec 4 — timeline view redesign** (alternating vertical time axis).
- **Realtime presence/co-edit re-attach** to the new spine (the P5a awareness channel survives on the backend; the FE overlay is rebuilt for the spine surface later).

## 7. Testing

Backend: JUnit for the new confirm/revoke endpoints (set, clear, multi-confirm, workspace scoping, event emission) + regression that removed lock/flow-edge/pin/decision code is fully excised (compile + suite green, `ddl-auto: validate` passes the new schema). Frontend gate = `npm run build` + `eslint` on touched folders (no unit runner exists).

## 8. Non-goals

No pan/zoom/drag canvas. No hand-drawn edges or branching DAG. No lock/freeze. No data migration. No single-choice enforcement. Timeline redesign, detail modal, and 서브안건 zoom are separate specs.
