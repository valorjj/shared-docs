# Decisions List View — Order-Spine, Connection Layer & Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the canvas's 안건 connections into the Decisions 목록 (list) view via a neutral order-spine + an accent connection layer (hover-highlight + a 연결 helper modal), and add drag-to-reorder backed by a transactional `sortOrder` endpoint — without turning the list into a second canvas.

**Architecture:** Frontend-first. Tasks 1–3 are pure frontend (the spine and hover derive from the already-loaded `PlanTree`; the 연결 modal reuses the existing edge mutations). Task 4–5 add reorder: one transactional batch backend endpoint plus a `@dnd-kit/sortable` interaction with React Query optimistic update. The spine means **order** (`sortOrder`); the accent layer means **dependency** (`edges`) — kept visually distinct.

**Tech Stack:** React 19 + TypeScript + CSS Modules + React Query + `@dnd-kit/sortable` (already a dependency) + lucide-react (frontend); Spring Boot + Kotlin + JPA + JUnit (backend).

**Branch:** Continue on `decisions-list-links` (the dashed `연결 →` chips this builds on already live there). No new branch.

**Test reality:** The frontend has **no test runner** (no Vitest/Jest in `package.json`). The authoritative frontend gate is `npx tsc -b --noEmit` + `npx eslint src/` + `npm run build` (run from `shared-docs/`). Do **not** add a test runner. The backend uses JUnit — Task 4 is real TDD.

---

## File Structure

**Frontend (`shared-docs/src/features/decisions/`):**
- `PlanDetail.tsx` — MODIFY: render the spine between cards; hold `hoveredSubPlanId` + derive per-card highlight variant + active-spine segments; own the 연결 modal open state and its create/disconnect handlers; (Task 5) wrap the list in dnd-kit context + optimistic reorder.
- `SubPlanSection.tsx` — MODIFY: hover handlers, `variant` prop, a `연결` action button, (Task 5) a `dragHandle` slot.
- `SubPlanSection.module.css` — MODIFY: `.source` / `.linked` / `.dim` highlight states; (Task 5) drag-handle + dragging styles.
- `PlanDetail.module.css` — MODIFY: `.list` gap → 0; add `.spine` / `.spine.active` / `.addRow`.
- `ConnectModal.tsx` — CREATE: the 연결 helper modal (checkbox list of the other 안건).
- `ConnectModal.module.css` — CREATE.
- `SortableSubPlanSection.tsx` — CREATE (Task 5): dnd-kit sortable wrapper that owns the row ref/transform, renders the preceding spine, and passes a drag handle into `SubPlanSection`.
- `api.ts` — MODIFY: add scope invalidation to `useCreateEdge`/`useDeleteEdge`; add `useReorderSubPlans` (Task 5).
- `types.ts` — MODIFY: add `ReorderSubPlansPayload` (Task 5).

**Backend (`shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/`, Task 4 only):**
- `DecisionDto.kt` — MODIFY: add `ReorderSubPlansRequest`.
- `DecisionExceptions.kt` — MODIFY: add `SubPlanReorderMismatchException`.
- `PlanService.kt` — MODIFY: add `reorderSubPlans(...)`.
- `PlanController.kt` — MODIFY: add `PATCH /api/plans/{planId}/subplans/order`.
- `src/test/kotlin/com/shareddocs/backend/decision/SubPlanServiceTest.kt` — MODIFY: add reorder tests.

No Flyway migration — `sub_plans.sort_order` already exists.

---

## Task 1: Order-spine in the list

A quiet neutral dashed vertical connector between each consecutive 안건 card. Continuous regardless of links or status; absent when fewer than 2 cards.

**Files:**
- Modify: `src/features/decisions/PlanDetail.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx` (the `view === 'list'` card map, around lines 113–141)

- [ ] **Step 1: Spine CSS + gap change**

In `src/features/decisions/PlanDetail.module.css`, replace the `.list` rule and append spine rules. The spine replaces the inter-card flex gap (so spacing stays even and the connector sits centered in it):

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 0;                 /* spine + .addRow now provide vertical rhythm */
}

/* Order-spine: neutral dashed connector between consecutive 안건 (it represents
   sortOrder, NOT connections — connections are the accent layer in Task 2/3). */
.spine {
  align-self: center;     /* centers when a direct flex child of .list (Task 1) */
  margin-inline: auto;    /* centers when nested in the block-flow sortable wrapper (Task 5) */
  width: 0;
  height: var(--sp-5);
  border-left: 2px dashed var(--c-border-strong);
}

.addRow {
  margin-top: var(--sp-4);
}
```

- [ ] **Step 2: Render the spine between cards**

In `src/features/decisions/PlanDetail.tsx`, add `Fragment` to the React import at the top:

```tsx
import { Fragment, useMemo, useState } from 'react'
```

Then replace the card-map block (the `<div className={styles.list}>` that maps `tree.subPlans` and ends with the 안건 추가 `<Button>`) with this — a spine before every card except the first, and the trailing add button wrapped in `.addRow`:

```tsx
                <div className={styles.list}>
                  {tree.subPlans.map((sp, i) => (
                    <Fragment key={sp.id}>
                      {i > 0 && <div className={styles.spine} />}
                      <SubPlanSection
                        subPlan={sp}
                        links={linksBySubPlan.get(sp.id)}
                        onJumpToSubPlan={jumpToSubPlan}
                        myUserId={myUserId}
                        nameOf={nameOf}
                        busy={rate.isPending || lock.isPending || reopen.isPending || deleteSubPlan.isPending || deleteOption.isPending}
                        onEdit={() => setEditingSubPlan(sp)}
                        onDelete={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteSubPlan.mutate(sp.id) }}
                        onAddOption={() => setAddingOptionFor(sp.id)}
                        onEditOption={(o) => setEditingOption(o)}
                        onDeleteOption={(o) => {
                          if (!window.confirm('삭제할까요? 되돌릴 수 없어요.')) return
                          deleteOption.mutate(o.id, {
                            onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '삭제할 수 없어요.'),
                          })
                        }}
                        onRate={(optionId, score, comment) => rate.mutate({ optionId, payload: { score, comment } })}
                        onClearRating={(optionId) => clearRating.mutate(optionId)}
                        onDecide={() => setDecidingFor(sp)}
                        onReopen={() => { if (window.confirm('이 결정을 다시 열까요? 기록은 남아요.')) reopen.mutate(sp.id) }}
                      />
                    </Fragment>
                  ))}
                  <div className={styles.addRow}>
                    <Button variant="outline" full leading={<Plus size={16} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>
                  </div>
                </div>
```

- [ ] **Step 3: Verify the frontend gate**

Run from `shared-docs/`:
```bash
npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build
```
Expected: all three exit 0, no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open a plan with ≥2 안건 in 목록 view. Expected: a centered dashed vertical line sits between each pair of cards; a plan with one 안건 shows no spine; a `대기`/unlinked 안건 is still threaded (spine above and below it).

- [ ] **Step 5: Commit**

```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions): order-spine connector between 안건 in the list view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Hover-highlight (connection accent layer)

Hovering a card outlines it (source), lights its directly-linked 안건 (accent border), dims the rest, and accents the spine segment between a hovered source and an *adjacent* linked card.

**Files:**
- Modify: `src/features/decisions/SubPlanSection.tsx`
- Modify: `src/features/decisions/SubPlanSection.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

- [ ] **Step 1: Highlight state CSS**

Append to `src/features/decisions/SubPlanSection.module.css`:

```css
/* Hover-highlight: source card hovered → accent ring; its linked 안건 → soft
   accent border; everything else dims. Matches the no-lift/hairline discipline. */
.section { transition: opacity .15s, border-color .15s, box-shadow .15s; }
.section.source { border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); }
.section.linked { border-color: var(--c-accent); }
.section.dim { opacity: .4; }
```

Append to `src/features/decisions/PlanDetail.module.css`:

```css
.spine.active { border-left-color: var(--c-accent); }
```

- [ ] **Step 2: Accept a variant + hover handlers in SubPlanSection**

In `src/features/decisions/SubPlanSection.tsx`, add the variant type and two props, and apply them to the `<section>`. Change the `Props` type and the function signature:

```tsx
export type SubPlanHighlight = 'normal' | 'source' | 'linked' | 'dim'

type Props = {
  subPlan: SubPlanNode
  links?: { outgoing: SubPlanLink[]; incoming: SubPlanLink[] }
  onJumpToSubPlan?: (id: number) => void
  highlight?: SubPlanHighlight
  onHoverChange?: (hovered: boolean) => void
  myUserId: number
  nameOf: (userId: number) => string
  busy?: boolean
  onEdit: () => void
  onDelete: () => void
  onAddOption: () => void
  onEditOption: (o: OptionNode) => void
  onDeleteOption: (o: OptionNode) => void
  onRate: (optionId: number, score: number, comment: string | undefined) => void
  onClearRating: (optionId: number) => void
  onDecide: () => void
  onReopen: () => void
}

export default function SubPlanSection({
  subPlan, links, onJumpToSubPlan, highlight = 'normal', onHoverChange,
  myUserId, nameOf, busy, onEdit, onDelete, onAddOption,
  onEditOption, onDeleteOption, onRate, onClearRating, onDecide, onReopen,
}: Props) {
```

Then change the opening `<section>` tag (currently `<section id={`subplan-${subPlan.id}`} className={styles.section}>`) to apply the variant class and hover handlers:

```tsx
    <section
      id={`subplan-${subPlan.id}`}
      className={[styles.section, highlight !== 'normal' && styles[highlight]].filter(Boolean).join(' ')}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
```

- [ ] **Step 3: Derive highlight + active-spine in PlanDetail**

In `src/features/decisions/PlanDetail.tsx`, add hover state and a neighbor-set derivation just after the existing `jumpToSubPlan` definition (around line 76):

```tsx
  const [hoveredSubPlanId, setHoveredSubPlanId] = useState<number | null>(null)

  // Neighbor ids (both directions) of the hovered 안건 — drives the accent layer.
  const hoveredNeighbors = useMemo(() => {
    if (hoveredSubPlanId == null) return null
    const links = linksBySubPlan.get(hoveredSubPlanId)
    if (!links) return new Set<number>()
    return new Set<number>([...links.outgoing.map((l) => l.id), ...links.incoming.map((l) => l.id)])
  }, [hoveredSubPlanId, linksBySubPlan])

  const highlightOf = (id: number): 'normal' | 'source' | 'linked' | 'dim' => {
    if (hoveredSubPlanId == null) return 'normal'
    if (id === hoveredSubPlanId) return 'source'
    if (hoveredNeighbors?.has(id)) return 'linked'
    return 'dim'
  }

  // The spine segment between card[i-1] and card[i] is accented when the hovered
  // source links directly to its adjacent neighbour across that segment.
  const spineActive = (prevId: number, nextId: number): boolean => {
    if (hoveredSubPlanId == null || !hoveredNeighbors) return false
    return (
      (prevId === hoveredSubPlanId && hoveredNeighbors.has(nextId)) ||
      (nextId === hoveredSubPlanId && hoveredNeighbors.has(prevId))
    )
  }
```

Then wire them into the card map from Task 1 — the spine gets the active class and each `SubPlanSection` gets `highlight` + `onHoverChange`:

```tsx
                  {tree.subPlans.map((sp, i) => (
                    <Fragment key={sp.id}>
                      {i > 0 && (
                        <div className={[styles.spine, spineActive(tree.subPlans[i - 1].id, sp.id) && styles.active].filter(Boolean).join(' ')} />
                      )}
                      <SubPlanSection
                        subPlan={sp}
                        links={linksBySubPlan.get(sp.id)}
                        onJumpToSubPlan={jumpToSubPlan}
                        highlight={highlightOf(sp.id)}
                        onHoverChange={(hovered) => setHoveredSubPlanId(hovered ? sp.id : null)}
                        myUserId={myUserId}
                        nameOf={nameOf}
                        busy={rate.isPending || lock.isPending || reopen.isPending || deleteSubPlan.isPending || deleteOption.isPending}
                        onEdit={() => setEditingSubPlan(sp)}
                        onDelete={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteSubPlan.mutate(sp.id) }}
                        onAddOption={() => setAddingOptionFor(sp.id)}
                        onEditOption={(o) => setEditingOption(o)}
                        onDeleteOption={(o) => {
                          if (!window.confirm('삭제할까요? 되돌릴 수 없어요.')) return
                          deleteOption.mutate(o.id, {
                            onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '삭제할 수 없어요.'),
                          })
                        }}
                        onRate={(optionId, score, comment) => rate.mutate({ optionId, payload: { score, comment } })}
                        onClearRating={(optionId) => clearRating.mutate(optionId)}
                        onDecide={() => setDecidingFor(sp)}
                        onReopen={() => { if (window.confirm('이 결정을 다시 열까요? 기록은 남아요.')) reopen.mutate(sp.id) }}
                      />
                    </Fragment>
                  ))}
```

- [ ] **Step 4: Verify the frontend gate**

```bash
npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build
```
Expected: exit 0.

- [ ] **Step 5: Manual check**

`npm run dev`, open a plan with a connection (e.g. test1 → test2) plus an unconnected 안건. Hover test1: it gets the accent ring, test2 gets an accent border, the unconnected card dims, and the spine segment between test1 and test2 (if adjacent) turns accent. Move the mouse away: everything returns to normal.

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/SubPlanSection.tsx src/features/decisions/SubPlanSection.module.css src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions): hover-highlight links + accent spine segment in list view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 연결 helper modal

A per-card `연결` action opens a modal listing the other 안건 with a checkbox each; checking creates an edge (`source = this card → target = checked 안건`), unchecking removes the existing edge (either direction). Edge mutations now invalidate the decisions scope so the list and canvas stay in sync.

**Files:**
- Modify: `src/features/decisions/api.ts` (`useCreateEdge`, `useDeleteEdge`)
- Create: `src/features/decisions/ConnectModal.tsx`
- Create: `src/features/decisions/ConnectModal.module.css`
- Modify: `src/features/decisions/SubPlanSection.tsx` (add 연결 action button)
- Modify: `src/features/decisions/PlanDetail.tsx` (modal state + handlers)

- [ ] **Step 1: Invalidate scope on edge create/delete**

In `src/features/decisions/api.ts`, replace the `useCreateEdge` and `useDeleteEdge` functions (lines ~178–191) with versions that invalidate the decisions scope. The canvas seeds its React Flow state once and ignores prop refetches, so the added invalidation does not disrupt it:

```tsx
/** Create an edge. Invalidates the decisions scope so the 목록 view (chips, spine
 *  accents, 연결 modal) reflects it; the mounted canvas seeds once and appends the
 *  returned edge to its own local state, so it is unaffected by the refetch. */
export function useCreateEdge(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: CreateEdgePayload) =>
      (await apiClient.post<SubPlanEdge>(`/api/plans/${planId}/edges`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

export function useDeleteEdge() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/edges/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 2: ConnectModal CSS**

Create `src/features/decisions/ConnectModal.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.empty {
  font-size: var(--fs-sm);
  color: var(--c-text-subtle);
  margin: var(--sp-2) 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
}

.row[data-connected='true'] {
  border-color: var(--c-accent);
}

.dir {
  margin-left: auto;
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}
```

- [ ] **Step 3: ConnectModal component**

Create `src/features/decisions/ConnectModal.tsx`. It is presentational: the parent passes the source, the candidate list (each with whether/how it's connected), and toggle callbacks.

```tsx
import { Modal, Button, Checkbox } from '../../components/ui'
import styles from './ConnectModal.module.css'

export type ConnectCandidate = {
  id: number
  title: string
  edgeId: number | null        // non-null when already connected (either direction)
  outgoing: boolean            // true if the existing edge is source→this
}

type Props = {
  open: boolean
  onClose: () => void
  sourceTitle: string
  candidates: ConnectCandidate[]
  busy?: boolean
  onConnect: (targetId: number) => void
  onDisconnect: (edgeId: number) => void
}

export default function ConnectModal({ open, onClose, sourceTitle, candidates, busy, onConnect, onDisconnect }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${sourceTitle} — 연결`}
      footer={<Button variant="ghost" onClick={onClose}>닫기</Button>}
    >
      <p className={styles.empty} hidden={candidates.length > 0}>연결할 다른 안건이 없어요.</p>
      <div className={styles.list}>
        {candidates.map((c) => {
          const connected = c.edgeId != null
          return (
            <div key={c.id} className={styles.row} data-connected={connected ? 'true' : 'false'}>
              <Checkbox
                label={c.title}
                checked={connected}
                disabled={busy}
                onChange={() => (connected ? onDisconnect(c.edgeId!) : onConnect(c.id))}
              />
              {connected && <span className={styles.dir}>{c.outgoing ? '연결됨 →' : '← 연결됨'}</span>}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: 연결 action button in SubPlanSection**

In `src/features/decisions/SubPlanSection.tsx`, add `Link2` to the lucide import and an `onOpenConnect` prop, and render a `연결` IconButton in the actions row before 수정.

Change the import line:
```tsx
import { Plus, Pencil, Trash2, Link2 } from 'lucide-react'
```

Add to `Props` (next to the other callbacks):
```tsx
  onOpenConnect?: () => void
```

Add it to the destructured params:
```tsx
  onEditOption, onDeleteOption, onRate, onClearRating, onDecide, onReopen, onOpenConnect,
```

Replace the `.actions` block:
```tsx
        <div className={styles.actions}>
          {onOpenConnect && (
            <IconButton variant="ghost" size="sm" label="안건 연결" onClick={onOpenConnect}><Link2 size={14} /></IconButton>
          )}
          <IconButton variant="ghost" size="sm" label="안건 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="안건 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </div>
```

- [ ] **Step 5: Wire the modal in PlanDetail**

In `src/features/decisions/PlanDetail.tsx`:

Add the imports (near the other decisions imports):
```tsx
import ConnectModal, { type ConnectCandidate } from './ConnectModal'
import { useCreateEdge, useDeleteEdge } from './api'
```
(Extend the existing `./api` import instead of adding a duplicate line if your editor flags it — `useCreateEdge`/`useDeleteEdge` can be appended to the existing `from './api'` import block.)

Add the mutations next to the other mutation hooks (after `const reopen = useReopenDecision()`):
```tsx
  const createEdge = useCreateEdge(planId)
  const deleteEdge = useDeleteEdge()
```

Add modal state next to the other modal state (after the `view` state):
```tsx
  const [connectingFor, setConnectingFor] = useState<SubPlanNode | null>(null)
```

Add a derivation of the candidate list for the open source, after `hoveredNeighbors`/`highlightOf`:
```tsx
  // Candidates for the 연결 modal: every other 안건, annotated with the existing
  // edge (either direction) so the checkbox reflects current connections.
  const connectCandidates = useMemo<ConnectCandidate[]>(() => {
    if (!tree || !connectingFor) return []
    const src = connectingFor.id
    return tree.subPlans
      .filter((sp) => sp.id !== src)
      .map((sp) => {
        const out = tree.edges.find((e) => e.sourceSubPlanId === src && e.targetSubPlanId === sp.id)
        const inc = tree.edges.find((e) => e.sourceSubPlanId === sp.id && e.targetSubPlanId === src)
        const edge = out ?? inc ?? null
        return { id: sp.id, title: sp.title, edgeId: edge ? edge.id : null, outgoing: out != null }
      })
  }, [tree, connectingFor])
```

Pass `onOpenConnect` into `SubPlanSection` in the card map (add this prop alongside the others):
```tsx
                        onOpenConnect={() => setConnectingFor(sp)}
```

Render the modal next to the other modals (e.g. after the `DecisionModal`):
```tsx
      <ConnectModal
        open={connectingFor != null}
        onClose={() => setConnectingFor(null)}
        sourceTitle={connectingFor?.title ?? ''}
        candidates={connectCandidates}
        busy={createEdge.isPending || deleteEdge.isPending}
        onConnect={(targetId) => {
          if (!connectingFor) return
          createEdge.mutate(
            { sourceSubPlanId: connectingFor.id, targetSubPlanId: targetId },
            { onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '연결할 수 없어요.') },
          )
        }}
        onDisconnect={(edgeId) => deleteEdge.mutate(edgeId)}
      />
```

- [ ] **Step 6: Verify the frontend gate**

```bash
npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build
```
Expected: exit 0.

- [ ] **Step 7: Manual check**

`npm run dev`. On a 안건 card, click the 연결 (link) icon → modal lists the other 안건; already-connected ones are checked and show `연결됨 →` / `← 연결됨`. Check an unconnected one → its chip + spine accent appear in the list behind the modal. Uncheck a connected one → it disappears. Switch to 캔버스 → the same edges are present. A plan with one 안건 shows "연결할 다른 안건이 없어요."

- [ ] **Step 8: Commit**

```bash
git add src/features/decisions/api.ts src/features/decisions/ConnectModal.tsx src/features/decisions/ConnectModal.module.css src/features/decisions/SubPlanSection.tsx src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): 연결 modal to wire 안건 from the list; sync edges to canvas

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backend — batch reorder endpoint (TDD)

`PATCH /api/plans/{planId}/subplans/order` with `{ orderedSubPlanIds: [...] }` rewrites every 안건's `sortOrder` to its index, in one transaction. The id list must be exactly the plan's 안건 set (no extras, no missing, no duplicates) or it 400s.

**Files:**
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/SubPlanServiceTest.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt`

- [ ] **Step 1: Write the failing tests**

Append three tests to `SubPlanServiceTest.kt` (inside the class):

```kotlin
    @Test
    fun `reorderSubPlans rewrites sortOrder to match the given order`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "A"))
        val b = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "B"))
        val c = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "C"))

        service.reorderSubPlans(ws.id!!, plan.id, listOf(c.id, a.id, b.id))

        val ordered = service.getTree(ws.id!!, plan.id).subPlans
        assertEquals(listOf(c.id, a.id, b.id), ordered.map { it.id })
        assertEquals(listOf(0, 1, 2), ordered.map { it.sortOrder })
    }

    @Test
    fun `reorderSubPlans rejects an id set that doesn't match the plan`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "A"))
        val b = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "B"))

        // missing one id
        assertThrows(SubPlanReorderMismatchException::class.java) {
            service.reorderSubPlans(ws.id!!, plan.id, listOf(a.id))
        }
        // duplicate id
        assertThrows(SubPlanReorderMismatchException::class.java) {
            service.reorderSubPlans(ws.id!!, plan.id, listOf(a.id, a.id))
        }
        // foreign id
        assertThrows(SubPlanReorderMismatchException::class.java) {
            service.reorderSubPlans(ws.id!!, plan.id, listOf(a.id, b.id, 999_999L))
        }
    }

    @Test
    fun `reorderSubPlans 404s for a plan in another workspace`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        val plan = service.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = service.addSubPlan(wsA.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "A"))

        assertThrows(PlanNotFoundException::class.java) {
            service.reorderSubPlans(wsB.id!!, plan.id, listOf(a.id))
        }
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

From `shared-docs-backend/`:
```bash
./gradlew test --tests "com.shareddocs.backend.decision.SubPlanServiceTest"
```
Expected: FAIL — `reorderSubPlans` and `SubPlanReorderMismatchException` are unresolved references (compilation error).

- [ ] **Step 3: Add the exception**

Append to `DecisionExceptions.kt`:

```kotlin
/** The reorder id list must equal the plan's 안건 set exactly (no extras, missing, or duplicates). */
class SubPlanReorderMismatchException :
    ApiException(HttpStatus.BAD_REQUEST, "subplan-reorder-mismatch", "Reorder ids must match the plan's sub-plans exactly", "안건 순서 목록이 계획의 안건과 일치하지 않아요.")
```

- [ ] **Step 4: Add the request DTO**

In `DecisionDto.kt`, add the `NotEmpty` import to the validation imports at the top:

```kotlin
import jakarta.validation.constraints.NotEmpty
```

Add the request near the other request data classes (e.g. after `CreateEdgeRequest`):

```kotlin
/** Reorder a 계획's 안건. The list must be exactly the plan's 안건 ids. */
data class ReorderSubPlansRequest(
    @field:NotEmpty val orderedSubPlanIds: List<Long>,
)
```

- [ ] **Step 5: Implement the service method**

In `PlanService.kt`, add this method (e.g. after `deleteSubPlan`). Dirty checking inside the `@Transactional` class persists the `sortOrder` changes — consistent with `updateSubPlan`:

```kotlin
    fun reorderSubPlans(workspaceId: Long, planId: Long, orderedSubPlanIds: List<Long>) {
        requirePlan(workspaceId, planId) // 404 if plan absent / wrong workspace
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        val existingIds = subPlans.mapNotNull { it.id }.toSet()
        val givenIds = orderedSubPlanIds.toSet()
        if (givenIds != existingIds || givenIds.size != orderedSubPlanIds.size) {
            throw SubPlanReorderMismatchException()
        }
        val byId = subPlans.associateBy { it.id }
        orderedSubPlanIds.forEachIndexed { index, id -> byId.getValue(id).sortOrder = index }
    }
```

- [ ] **Step 6: Add the controller route**

In `PlanController.kt`, add the endpoint (after `addSubPlan`):

```kotlin
    @PatchMapping("/{planId}/subplans/order")
    fun reorderSubPlans(
        @CurrentWorkspace ws: Workspace,
        @PathVariable planId: Long,
        @Valid @RequestBody request: ReorderSubPlansRequest,
    ): ResponseEntity<Void> {
        service.reorderSubPlans(ws.id!!, planId, request.orderedSubPlanIds)
        return ResponseEntity.noContent().build()
    }
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
./gradlew test --tests "com.shareddocs.backend.decision.SubPlanServiceTest"
```
Expected: PASS (all tests in the class green).

- [ ] **Step 8: Full backend build**

```bash
./gradlew build -x test && ./gradlew test
```
Expected: BUILD SUCCESSFUL; full suite green (Hibernate `ddl-auto: validate` passes — no schema change).

- [ ] **Step 9: Commit (backend repo)**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt \
        src/test/kotlin/com/shareddocs/backend/decision/SubPlanServiceTest.kt
git commit -m "feat(decisions): batch reorder endpoint for 안건 sortOrder

PATCH /api/plans/{planId}/subplans/order rewrites sortOrder transactionally;
rejects an id list that doesn't match the plan's 안건 set (RFC 7807 400).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — drag-to-reorder

`@dnd-kit/sortable` over the list cards, with a drag handle, persisting via the Task 4 endpoint with a React Query optimistic update (no `setState`-in-effect — the rendered order is the optimistically-patched query data).

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`
- Create: `src/features/decisions/SortableSubPlanSection.tsx`
- Modify: `src/features/decisions/SubPlanSection.tsx` (drag-handle slot)
- Modify: `src/features/decisions/SubPlanSection.module.css` (handle styles)
- Modify: `src/features/decisions/PlanDetail.tsx` (dnd context + dragEnd)

- [ ] **Step 1: Payload type**

Append to `src/features/decisions/types.ts`:

```tsx
export type ReorderSubPlansPayload = { orderedSubPlanIds: number[] }
```

- [ ] **Step 2: Reorder hook with optimistic update**

In `src/features/decisions/api.ts`, add `PlanTree` and `ReorderSubPlansPayload` to the type import block, then add the hook (after the edge hooks). The optimistic patch reorders the cached tree's `subPlans`; on error it rolls back:

```tsx
/** Reorder a plan's 안건. Optimistically reorders the cached tree, rolls back on
 *  error, and reconciles via a scope invalidation on settle. */
export function useReorderSubPlans(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: ReorderSubPlansPayload) => {
      await apiClient.patch(`/api/plans/${planId}/subplans/order`, payload)
    },
    onMutate: async (payload: ReorderSubPlansPayload) => {
      const key = decisionKeys.tree(activeId, planId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PlanTree>(key)
      if (prev) {
        const byId = new Map(prev.subPlans.map((sp) => [sp.id, sp] as const))
        const reordered = payload.orderedSubPlanIds.map((id) => byId.get(id)).filter((sp): sp is NonNullable<typeof sp> => sp != null)
        qc.setQueryData<PlanTree>(key, { ...prev, subPlans: reordered })
      }
      return { prev, key }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: Drag-handle slot in SubPlanSection**

In `src/features/decisions/SubPlanSection.tsx`, add a `dragHandle?: ReactNode` prop and render it at the start of the actions row. Add the `ReactNode` type import:

```tsx
import type { ReactNode } from 'react'
```

Add to `Props`:
```tsx
  dragHandle?: ReactNode
```
Add to the destructured params:
```tsx
  ..., onOpenConnect, dragHandle,
```
Render it first in `.actions`:
```tsx
        <div className={styles.actions}>
          {dragHandle}
          {onOpenConnect && (
            <IconButton variant="ghost" size="sm" label="안건 연결" onClick={onOpenConnect}><Link2 size={14} /></IconButton>
          )}
          <IconButton variant="ghost" size="sm" label="안건 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="안건 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </div>
```

- [ ] **Step 4: Handle styles**

Append to `src/features/decisions/SubPlanSection.module.css`:

```css
.dragHandle {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  color: var(--c-text-subtle);
  background: none;
  border: none;
  cursor: grab;
  border-radius: var(--r-sm);
}
.dragHandle:hover { color: var(--c-text-muted); background: var(--c-surface-tint); }
.dragHandle:focus-visible { outline: none; box-shadow: var(--ring-focus); }
.dragging { opacity: .6; }
```

- [ ] **Step 5: Sortable wrapper**

Create `src/features/decisions/SortableSubPlanSection.tsx`. It owns the dnd-kit row ref/transform, renders the preceding spine inside the sortable item (so it travels with the card), and feeds a grip drag handle into `SubPlanSection`. It forwards every `SubPlanSection` prop through.

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { type ComponentProps } from 'react'
import SubPlanSection from './SubPlanSection'
import sectionStyles from './SubPlanSection.module.css'
import styles from './PlanDetail.module.css'

type Props = ComponentProps<typeof SubPlanSection> & {
  showSpine: boolean
  spineActive: boolean
}

export default function SortableSubPlanSection({ showSpine, spineActive, ...sectionProps }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionProps.subPlan.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const handle = (
    <button
      type="button"
      className={`${sectionStyles.dragHandle}${isDragging ? ` ${sectionStyles.dragging}` : ''}`}
      aria-label="안건 순서 변경"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={14} />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style}>
      {showSpine && <div className={[styles.spine, spineActive && styles.active].filter(Boolean).join(' ')} />}
      <SubPlanSection {...sectionProps} dragHandle={handle} />
    </div>
  )
}
```

- [ ] **Step 6: Wire dnd-kit context in PlanDetail**

In `src/features/decisions/PlanDetail.tsx`:

Add imports:
```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableSubPlanSection from './SortableSubPlanSection'
import { useReorderSubPlans } from './api'
```
(Append `useReorderSubPlans` to the existing `./api` import rather than duplicating.)

Add the hook + sensors + dragEnd handler near the other mutations:
```tsx
  const reorder = useReorderSubPlans(planId)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent) => {
    if (!tree) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = tree.subPlans.map((sp) => sp.id)
    const from = ids.indexOf(Number(active.id))
    const to = ids.indexOf(Number(over.id))
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0])
    reorder.mutate({ orderedSubPlanIds: next })
  }
```

Replace the Task-2 card map with a dnd-wrapped version using `SortableSubPlanSection` (the spine now lives inside each sortable item via `showSpine`/`spineActive`, so the `Fragment`+inline-spine is removed):

```tsx
                <div className={styles.list}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={tree.subPlans.map((sp) => sp.id)} strategy={verticalListSortingStrategy}>
                      {tree.subPlans.map((sp, i) => (
                        <SortableSubPlanSection
                          key={sp.id}
                          showSpine={i > 0}
                          spineActive={i > 0 && spineActive(tree.subPlans[i - 1].id, sp.id)}
                          subPlan={sp}
                          links={linksBySubPlan.get(sp.id)}
                          onJumpToSubPlan={jumpToSubPlan}
                          highlight={highlightOf(sp.id)}
                          onHoverChange={(hovered) => setHoveredSubPlanId(hovered ? sp.id : null)}
                          myUserId={myUserId}
                          nameOf={nameOf}
                          busy={rate.isPending || lock.isPending || reopen.isPending || deleteSubPlan.isPending || deleteOption.isPending}
                          onEdit={() => setEditingSubPlan(sp)}
                          onDelete={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteSubPlan.mutate(sp.id) }}
                          onAddOption={() => setAddingOptionFor(sp.id)}
                          onEditOption={(o) => setEditingOption(o)}
                          onDeleteOption={(o) => {
                            if (!window.confirm('삭제할까요? 되돌릴 수 없어요.')) return
                            deleteOption.mutate(o.id, {
                              onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '삭제할 수 없어요.'),
                            })
                          }}
                          onRate={(optionId, score, comment) => rate.mutate({ optionId, payload: { score, comment } })}
                          onClearRating={(optionId) => clearRating.mutate(optionId)}
                          onDecide={() => setDecidingFor(sp)}
                          onReopen={() => { if (window.confirm('이 결정을 다시 열까요? 기록은 남아요.')) reopen.mutate(sp.id) }}
                          onOpenConnect={() => setConnectingFor(sp)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <div className={styles.addRow}>
                    <Button variant="outline" full leading={<Plus size={16} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>
                  </div>
                </div>
```

The now-unused `Fragment` import (added in Task 1) can be removed if eslint flags it.

- [ ] **Step 7: Verify the frontend gate**

```bash
npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build
```
Expected: exit 0.

- [ ] **Step 8: Manual check**

`npm run dev` (with the backend running so the PATCH succeeds). Grab a card's grip handle and drag it to a new position: cards reorder, the spine stays threaded between them, and the new order persists across a refresh (and reflects in the 캔버스 node default layout order). The hover-highlight and 연결 modal still work. Reordering a single-item plan is a no-op.

- [ ] **Step 9: Commit (frontend repo)**

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts src/features/decisions/SortableSubPlanSection.tsx src/features/decisions/SubPlanSection.tsx src/features/decisions/SubPlanSection.module.css src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): drag-to-reorder 안건 in the list view (optimistic, batch persist)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done-when

- Spine renders between consecutive 안건 (n≥2), continuous through unlinked/pending items, none for n<2.
- Hovering a 안건 accents it + its linked 안건, dims the rest, and accents the adjacent linked spine segment.
- The 연결 modal creates/removes edges from the list; changes appear in both 목록 and 캔버스.
- Dragging a 안건 reorders it and persists via the batch endpoint; order survives refresh.
- `npx tsc -b --noEmit`, `npx eslint src/`, `npm run build` all clean (frontend); `./gradlew test` green (backend).
- Horizontal list mode was NOT added (canvas remains the spatial view).
