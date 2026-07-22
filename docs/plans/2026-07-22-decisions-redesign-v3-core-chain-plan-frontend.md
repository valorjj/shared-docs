# Decisions Redesign v3 — Spec 1 Frontend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax. This is the **frontend** half of Spec 1; the backend (branch `decisions-redesign-v3` in shared-docs-backend) is already built + reviewed and is deployed **together** with this. Work on branch `decisions-redesign-v3` in the **shared-docs** (frontend) repo.

**Goal:** Replace the React Flow decision canvas with a mobile-first **vertical decision chain (spine)**: ordered 안건 stations, each with a 후보 checklist where the left circle confirms (multi, reversible, soft) and the row opens a light detail; confirming ≥1 후보 reveals the next 안건. Delete all canvas/edge/pin/presence code. Collapse the plan-detail tabs from three (목록/캔버스/기록) to two (the spine + 기록).

**Architecture:** React 19 + TS + Vite + React Query. The spine is plain DOM/CSS (no React Flow, no dagre) — vertical scroll, thumb-friendly. Data from the existing `usePlanTree`. Confirm via the new `PATCH /api/options/{id}/confirm`; votes via existing cast/retract; "decided" and decision-date are **derived client-side** from `options[].confirmed`/`confirmedAt`.

**Tech Stack:** React Query v5, CSS Modules + design tokens, Lucide icons. Gate = `npm run build` (`tsc -b && vite build`) + `eslint` on touched folders. **No unit-test runner exists — do not add one.**

## Global Constraints

- **Mobile-first + lightweight** ([[project_app_direction_lightweight]]): vertical, scroll-native, thumb-reachable; open fast. This is the guiding bar.
- **Bear-minimal**: hairline borders, NO shadows/card-lift, calm spacing; use `--c-*`/`--sp-*`/`--r-*` tokens only (no hardcoded hex except per-user avatar colors via `collabColorForUser`). Lucide icons, never emoji. All UI text Korean. Term is **후보** (not 선택지).
- **The app guides but never constrains**: confirm is soft, any member, multi, reversible; no locks; nothing frozen.
- **Backend API is fixed** (already built): `PATCH /api/options/{id}/confirm` `{confirmed}` → OptionResponse; `OptionNode` gains `confirmed/confirmedAt/confirmedBy`; PlanTree/SubPlan/Option no longer carry lock/decision/edges/pins/canvas(option,subplan) fields. `resources` is empty in `getTree` (only populated in `getSubPlanDetail`) — but per-후보 자료 is Spec 2, so Spec 1 ignores it. Decision date is derived (earliest `confirmedAt`); there is no `decidedAt` field.
- Per task: `npm run build` green + no NEW eslint errors in touched folders. Each task self-contained and compiles (doomed files stay until FE-4 deletes them).

## File map (frontend, under `src/features/decisions/`)

- **FE-1 modify:** `types.ts`, `api.ts`, `formatPlanEvent.tsx`.
- **FE-2 create:** `PlanChain.tsx` + `PlanChain.module.css`, `OptionSheet.tsx` + `OptionSheet.module.css`, `decidedState.ts` (derive helpers).
- **FE-3 modify:** `PlanDetail.tsx` (+ `.module.css`), `DecisionList.tsx` (remove lock refs), and `src/App.tsx` (drop the `/decisions/:planId/subplans/:subPlanId` route).
- **FE-4 delete:** `PlanCanvas.tsx`(+css), `canvasLayout.ts`, `DeletableEdge.tsx`(+css), `OwnershipEdge.tsx`, `OptionCanvasNode.tsx`(+css), `SubPlanCanvasNode.tsx`(+css), `CommentPinNode.tsx`(+css), `CommentPinPanel.tsx`(+css), `PinComposer.tsx`(+css), `PresenceCursors.tsx`(+css), `PresenceHalos.tsx`(+css), `collab/usePlanPresence.tsx`, `collab/useSmoothedPresence.ts`, `collab/DecisionPresenceStack.tsx`, `OptionPanel.tsx`(+css), `SubPlanPanel.tsx`(+css), `OptionRow.tsx`(+css), `SubPlanCard.tsx`(+css), `SortableSubPlanSection.tsx`, `SubPlanDetail.tsx`(+css), `DecisionModal.tsx`(+css), `ConnectModal.tsx`(+css); remove `@xyflow/react` + `@dagrejs/dagre` from `package.json`. (Keep: `Timeline`, `StoryView`, `DeadlineChip`, `ResourceSection`, `ProConSection`, `OptionResourceSection`, `PlanModal`, `TitleDescModal`, `DecisionList`, `formatPlanEvent`, `resourceIcon`, `deadlineLabel`, `storyGrouping`, `LinkResourceModal` — some feed Spec 2/4.)

---

### Task FE-1: Add confirm to types + api (ADDITIVE ONLY — build stays green)

**Files:** Modify `types.ts`, `api.ts`, `formatPlanEvent.tsx`.

**Interfaces produced:** `OptionNode.confirmed: boolean`, `confirmedAt: string | null`, `confirmedBy: number | null`; `SetOptionConfirmedPayload`; `useSetOptionConfirmed()` mutation `{ id: number; confirmed: boolean }`.

**Rule for this task: add only, remove NOTHING.** Removing the dead hooks/types now would break the still-present canvas/panel consumers. All removals are deferred to FE-4 (after FE-3 stops using them), so this task's `npm run build` is cleanly green.

- [ ] **types.ts** — in `OptionNode`: ADD `confirmed: boolean`, `confirmedAt: string | null`, `confirmedBy: number | null` (leave `canvasX`/`canvasY` in place for now — they're just unused). Add `export type SetOptionConfirmedPayload = { confirmed: boolean }`. In `PlanEventType`: ADD `'OPTION_CONFIRMED' | 'OPTION_REVOKED'`. Do not touch `DecisionInfo`, `SubPlanEdge`, `FlowEdge`, `CommentPin`, lock fields, etc. yet.
- [ ] **api.ts** — ADD the hook (delete nothing):
```ts
export function useSetOptionConfirmed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, confirmed }: { id: number; confirmed: boolean }) =>
      apiClient.patch(`/api/options/${id}/confirm`, { confirmed }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.all }),
  })
}
```
Match the exact query-key invalidation the sibling write hooks use (read `useCastVote`/`useAddOption` and mirror their `onSuccess`).
- [ ] **formatPlanEvent.tsx** — add Korean labels for `OPTION_CONFIRMED` ("후보 확정") and `OPTION_REVOKED` ("확정 취소").
- [ ] `npm run build` GREEN (purely additive) + eslint clean on touched files. Commit: `feat(decisions): add per-후보 confirm to FE types+api`.

---

### Task FE-2: Build the spine components (net-new, compiles clean)

**Files:** Create `decidedState.ts`, `PlanChain.tsx` + `.module.css`, `OptionSheet.tsx` + `.module.css`.

**Interfaces produced:** `<PlanChain tree={tree} planId={planId} />`; `<OptionSheet option={OptionNode} onClose={() => void} />`; helpers `isDecided(sp)`, `decidedAt(sp)`.

- [ ] **decidedState.ts** — pure derive helpers:
```ts
import type { SubPlanNode } from './types'
export const isDecided = (sp: SubPlanNode): boolean => sp.options.some((o) => o.confirmed)
/** earliest confirmedAt among confirmed 후보, or null */
export const decidedAt = (sp: SubPlanNode): string | null =>
  sp.options.filter((o) => o.confirmed && o.confirmedAt).map((o) => o.confirmedAt!).sort()[0] ?? null
```
- [ ] **PlanChain.tsx** — the vertical spine. Renders `tree.subPlans` (already sortOrder) as stations. Each station: rail dot (filled/purple when decided), 안건 title, a decided-date meta line (`decidedAt` → localized) + "N개 확정" badge, a checklist of 후보 rows, and a `+ 후보 추가` row. The `+ 다음 안건` affordance renders once (after the last station) ONLY when the last station is decided (or when there are no stations yet). Confirm toggle → `useSetOptionConfirmed`; vote pips from `voterUserIds` (avatars via `collabColorForUser` + member names from `useMembers(activeId)`); tapping a row (not the circle) opens `OptionSheet`. Add 후보 via `useAddOption` (read its exact signature in api.ts); add 안건 via `useAddSubPlan(planId)`. Reference structure (adapt hook signatures/import paths to what api.ts actually exports; use `components/ui` primitives + tokens; match the approved mockup in `.superpowers/brainstorm/`):
```tsx
// key logic — full component to be fleshed out against real hook signatures
const confirm = useSetOptionConfirmed()
const toggleConfirm = (o: OptionNode) => confirm.mutate({ id: o.id, confirmed: !o.confirmed })
const lastDecided = tree.subPlans.length === 0 || isDecided(tree.subPlans[tree.subPlans.length - 1])
// station: rail + body; body: header (title, badge, decidedAt), <ul> of CandidateRow, add-후보 button
// CandidateRow: <button class=chk aria-pressed=confirmed onClick=toggleConfirm> + name + vote pips + chevron(onClick=open sheet)
```
Empty state (no 안건): a calm prompt + `첫 안건 추가` button (via `useAddSubPlan`). No pan/zoom/drag.
- [ ] **OptionSheet.tsx** — the light per-후보 detail for Spec 1 (the rich 장점·단점 + 자료 editor is Spec 2). A slide-up sheet/modal (reuse an existing `Modal`/`Panel` primitive from `components/ui` if one fits mobile; else a simple bottom-sheet) showing: the 후보 title, a **vote** toggle (`useCastVote`/`useRetractVote` — current user in/out of `voterUserIds`) with voter avatars, and the per-후보 **comments** via the existing `<Comments pageId={`option:${option.id}`} />`. No 장점/단점 editing here (Spec 2).
- [ ] **PlanChain.module.css / OptionSheet.module.css** — mobile-first, from the approved mockup: vertical rail (`--c-border` hairline; decided segment `--c-primary`), station dot, candidate cards (hairline, no shadow; confirmed → `--c-primary` ring + tint), circular confirm check, avatar pips, dashed `+ 후보` row. Use `--c-*`/`--sp-*`/`--r-*`.
- [ ] `npm run build` — these are new, unimported files; build stays whatever FE-1 left it (compile of new files clean). eslint clean on the new files. Commit: `feat(decisions): vertical decision chain (spine) components`.

---

### Task FE-3: Rewrite PlanDetail to the spine; trim DecisionList; drop 안건-detail route  ⚠️ integration — opus

**Files:** Modify `PlanDetail.tsx` (+ `.module.css`), `DecisionList.tsx`, `src/App.tsx`.

- [ ] **PlanDetail.tsx** — rewrite the body:
  - Remove the `PlanPresenceProvider` wrapper + `FocusBroadcaster` + `DecisionPresenceStack`, all canvas/panel imports (`PlanCanvas`, `OptionPanel`, `SubPlanPanel`, presence, `ConnectModal`, `DecisionModal`), the `selectedNode`/panel state, the `?focus` search-param wiring, and the list-view (`DndContext`/`SortableSubPlanSection`/`SubPlanCard`) block.
  - Tabs collapse to two: `view: 'chain' | 'timeline'` (default `'chain'`). `'chain'` renders `<PlanChain tree={tree} planId={planId} />` then `<ResourceSection planId={planId} />` (plan 자료) then `<Comments pageId={`plan:${planId}`} />`. `'timeline'` renders the existing `<Timeline …>`.
  - Header keeps title, deadline chip, complete/reopen (`useCompletePlan`/`useUncompletePlan`) — **remove the lock/unlock `IconButton`** (lock is gone). Remove the locked/completed lock-banner (keep an optional completed banner if desired, but no lock).
  - Keep the keyed `key={planId}` remount.
- [ ] **DecisionList.tsx** — remove any references to `lockedAt`/`lockedByUserId`/lock icons on plan cards; `decidedCount`/`subPlanCount` still exist. Otherwise unchanged (the /decisions board stays).
- [ ] **src/App.tsx** — remove the route `/decisions/:planId/subplans/:subPlanId` (the SubPlanDetail page; 서브안건 is Spec 3) and its lazy import. Keep `/decisions` and `/decisions/:planId`.
- [ ] `npm run build` **MUST be green now** (nothing should import the removed hooks/types/components any longer — if the build still references a doomed file, fix the consumer). `eslint src/features/decisions` + `src/App.tsx` clean of new errors. Commit: `feat(decisions): plan detail = vertical spine + timeline`.

---

### Task FE-4: Delete orphaned files + dead types/hooks + deps

**Files:** `types.ts`, `api.ts` (dead-code removal); delete the FE-4 file list from the File Map; edit `package.json`.

- [ ] **types.ts** — now remove the dead declarations FE-1 left in place: from `OptionNode` remove `canvasX`/`canvasY`; from `SubPlanNode` remove `canvasX`/`canvasY` + `decision`; from `PlanTree` remove `lockedAt`/`lockedByUserId`/`edges`/`optionFlowEdges`/`commentPins` (keep `canvasX`/`canvasY`/`groupLabel`); from `SubPlanDetail` remove `decision`/`locked`; from `PlanSummary` remove `lockedAt`/`lockedByUserId`; delete types `DecisionInfo`/`SubPlanEdge`/`FlowEdge`/`CommentPin` and payloads `LockDecisionPayload`/`CanvasPositionPayload`/`CreateEdgePayload`/`CreateFlowEdgePayload`.
- [ ] **api.ts** — delete the now-unused hooks: `useLockPlan`, `useUnlockPlan`, `useLockDecision`, `useReopenDecision`, `useMoveSubPlan`, `useMoveOption`, `useCreateEdge`, `useDeleteEdge`, `useAddFlowEdge`, `useDeleteFlowEdge`, `useAddSubPlanOnCanvas`, `useCreateCommentPin`, `useMoveCommentPin`, `useSetCommentPinResolved`, `useDeleteCommentPin`.
- [ ] Delete all files listed under "FE-4 delete" in the File Map (canvas, edges, canvas nodes, comment pins, presence + collab, panels, OptionRow, SubPlanCard, SortableSubPlanSection, SubPlanDetail, DecisionModal, ConnectModal, canvasLayout).
- [ ] Grep to confirm nothing imports them: `grep -rn -E "PlanCanvas|canvasLayout|DeletableEdge|OwnershipEdge|OptionCanvasNode|SubPlanCanvasNode|CommentPin|PinComposer|PresenceCursors|PresenceHalos|usePlanPresence|useSmoothedPresence|DecisionPresenceStack|OptionPanel|SubPlanPanel|OptionRow|SubPlanCard|SortableSubPlanSection|SubPlanDetail|DecisionModal|ConnectModal" src` → only the definitions being deleted (zero after deletion). Fix any straggler import.
- [ ] Remove `@xyflow/react` and `@dagrejs/dagre` from `package.json` dependencies; run `npm install` to update the lockfile. Grep `grep -rn "@xyflow/react\|@dagrejs/dagre" src` → zero hits.
- [ ] `npm run build` green; `eslint src/features/decisions` clean. Commit: `chore(decisions): delete dead canvas/edge/pin/presence code + deps`.

---

## Manual smoke (after coordinated deploy; owed by user)

Create a plan → add an 안건 → add 후보 → tap a 후보 circle to confirm (multi: confirm two) → next 안건 reveals → revoke a confirm (it reopens, downstream stays) → vote on a 후보 (avatar appears) → tap a 후보 row → OptionSheet with vote + comments → add a plan comment → 기록 tab shows OPTION_CONFIRMED events. Realtime co-edit is NOT expected in Spec 1 (deferred). Mobile: everything one-handed, vertical scroll, no horizontal overflow.

## Self-review notes

- Every removed backend field/endpoint has a matching FE removal (FE-1) and no surviving consumer (FE-3 rewrites, FE-4 deletes). ✅
- New surface: `useSetOptionConfirmed` + `PlanChain`/`OptionSheet` + derive helpers. Confirm/vote/reveal all covered; rich 장점·단점 editor + 자료 + 서브안건 + realtime are explicitly deferred to Specs 2–4. ✅
- Build-green gate is honestly placed at end of FE-3 and FE-4 (FE-1 alone can't be green — noted for the controller). ✅
