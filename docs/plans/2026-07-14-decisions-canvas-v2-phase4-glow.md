# Decisions Canvas v2 — Phase 4 (Decision Glow/Dim + Canvas Default) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once an 안건 is decided, the canvas collapses its contingency map into the **trail actually taken** — the chosen 선택지 node + its outgoing flow edge stay emphasized, while the unchosen options and their flow edges **dim**. And the 캔버스 becomes the **default view** for a plan (remembering the user's last choice).

**Architecture:** Purely additive to Phase 2/3. A single `optionStates(tree)` helper classifies every option as `'chosen' | 'dimmed' | 'normal'` (dimmed = belongs to a decided 안건 but wasn't chosen). `buildNodes`/`buildEdges` thread that state into option-node data and flow-edge data; `OptionCanvasNode` + `DeletableEdge` render dim/emphasis via CSS (opacity + primary accent — no shadows, Bear-minimal). `PlanDetail` defaults `view` to `'canvas'` with localStorage persistence (mirrors the existing `discussion-open-*` pattern).

**Tech Stack:** React 19, TypeScript (strict), `@xyflow/react ^12`, CSS Modules.

**Design spec:** `docs/plans/2026-07-14-decisions-canvas-v2-design.md` (§3: "the decided branch glows and the rest dim"). This is **Phase 4 of 4** — the final FE phase. (P5 = live presence/cursors, deferred.)

## Global Constraints

- **Verification gate is `npm run build`** (tsc strict + Vite). ESLint pre-existing-red — lint only touched files. Behavioral gate = the manual smoke checklist at the end.
- **Bear-minimal:** emphasis/dim use **opacity + existing accent tokens only** — NO drop-shadows or literal glow (memory: no shadows/lift, hairlines). "Glow" = full-opacity + primary accent against dimmed (reduced-opacity) siblings.
- **Additive only:** the new option-node/edge data fields are optional/defaulted; undecided 안건 render exactly as today. Reopening a decision returns everything to normal (driven by `tree` refetch — no local state).
- **Tokens:** only defined ones (`--c-primary`, `--c-primary-soft`, `--c-border`, `--c-text*`, etc.). Do NOT introduce `--c-text-secondary` (undefined).

---

### Task 1: Decision glow/dim (option nodes + flow edges)

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx` (add `optionStates`; thread into `buildNodes`/`buildEdges`)
- Modify: `src/features/decisions/OptionCanvasNode.tsx` (+ `dimmed` in data)
- Modify: `src/features/decisions/OptionCanvasNode.module.css` (+ `.dimmed`)
- Modify: `src/features/decisions/DeletableEdge.tsx` (flow edge dim/chosen styling)

**Interfaces:**
- Produces: `OptionCanvasNodeData = { option; chosen; dimmed }`; `DeletableEdgeData = { kind; dimmed?; chosen? }`.

- [ ] **Step 1: Add the `optionStates` helper to PlanCanvas**

In `PlanCanvas.tsx`, add above `buildNodes` (after the `parseNodeId` helper / type aliases):
```ts
/** Per-option decision state for the canvas. A decided 안건's chosen option is
 *  'chosen' (emphasized); its other options are 'dimmed'; anything under an
 *  undecided 안건 is 'normal'. Drives the glow/dim collapse-to-trail visual. */
function optionStates(tree: PlanTree): Map<number, 'chosen' | 'dimmed' | 'normal'> {
  const states = new Map<number, 'chosen' | 'dimmed' | 'normal'>()
  for (const sp of tree.subPlans) {
    const decided = sp.decision != null
    const chosenId = sp.decision?.chosenOptionId ?? null
    for (const o of sp.options) {
      states.set(o.id, !decided ? 'normal' : o.id === chosenId ? 'chosen' : 'dimmed')
    }
  }
  return states
}
```

- [ ] **Step 2: Thread state into `buildNodes`**

Replace the `buildNodes` body's option loop so it uses `optionStates`. The full updated function:
```ts
function buildNodes(tree: PlanTree): CanvasNode[] {
  const states = optionStates(tree)
  const nodes: CanvasNode[] = []
  tree.subPlans.forEach((sp, i) => {
    const baseX = sp.canvasX ?? i * CLUSTER_GAP_X
    const baseY = sp.canvasY ?? 0
    nodes.push({ id: spId(sp.id), type: 'subplan', position: { x: baseX, y: baseY }, data: { subPlan: sp } })
    sp.options.forEach((o, j) => {
      const ox = o.canvasX ?? baseX + OPT_OFFSET_X
      const oy = o.canvasY ?? baseY + (j - (sp.options.length - 1) / 2) * OPT_GAP_Y
      const st = states.get(o.id)
      nodes.push({
        id: optId(o.id), type: 'option', position: { x: ox, y: oy },
        data: { option: o, chosen: st === 'chosen', dimmed: st === 'dimmed' },
      })
    })
  })
  return nodes
}
```
(This replaces the previous `const chosenId = ...` + `chosen: o.id === chosenId` logic — `optionStates` is now the single source.)

- [ ] **Step 3: Thread state into `buildEdges` (flow edges only)**

In `buildEdges`, compute states once at the top and set flow-edge data. The updated flow-edge block:
```ts
function buildEdges(tree: PlanTree): CanvasEdge[] {
  const states = optionStates(tree)
  const spSet = new Set(tree.subPlans.map((s) => s.id))
  const optSet = new Set(tree.subPlans.flatMap((s) => s.options.map((o) => o.id)))
  const edges: CanvasEdge[] = []
  tree.subPlans.forEach((sp) => {
    sp.options.forEach((o) => {
      edges.push({
        id: `own:${sp.id}-${o.id}`, source: spId(sp.id), target: optId(o.id),
        type: 'ownership', selectable: false, deletable: false, focusable: false,
      })
    })
  })
  tree.optionFlowEdges.forEach((e) => {
    if (!optSet.has(e.sourceOptionId) || !spSet.has(e.targetSubPlanId)) return
    const st = states.get(e.sourceOptionId)
    edges.push({
      id: `flow:${e.id}`, source: optId(e.sourceOptionId), target: spId(e.targetSubPlanId),
      type: 'deletable', data: { kind: 'flow', dimmed: st === 'dimmed', chosen: st === 'chosen' },
      markerEnd: { type: MarkerType.ArrowClosed },
    })
  })
  tree.edges.forEach((e) => {
    if (!spSet.has(e.sourceSubPlanId) || !spSet.has(e.targetSubPlanId)) return
    edges.push({
      id: `rel:${e.id}`, source: spId(e.sourceSubPlanId), target: spId(e.targetSubPlanId),
      type: 'deletable', data: { kind: 'related' }, markerEnd: { type: MarkerType.ArrowClosed },
    })
  })
  return edges
}
```

- [ ] **Step 4: OptionCanvasNode — add `dimmed`**

In `OptionCanvasNode.tsx`, update the data type + className (keep everything else):
```tsx
export type OptionCanvasNodeData = { option: OptionNode; chosen: boolean; dimmed: boolean }
export type OptionCanvasNodeType = Node<OptionCanvasNodeData, 'option'>

export default function OptionCanvasNode({ data }: NodeProps<OptionCanvasNodeType>) {
  const { option, chosen, dimmed } = data
  const cls = [styles.node, chosen ? styles.chosen : '', dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      {/* ...unchanged handles + head + meta... */}
```
(Only the type, the destructure, and the `className` construction change; the JSX body — handles, head, meta — stays exactly as-is.)

- [ ] **Step 5: OptionCanvasNode CSS — `.dimmed`**

Append to `OptionCanvasNode.module.css`:
```css
.dimmed { opacity: 0.4; }
```
(Chosen already reads as emphasized via `.chosen` — `--c-primary` border + `--c-primary-soft` bg — which now stands out against dimmed siblings. No shadow.)

- [ ] **Step 6: DeletableEdge — flow dim/chosen styling**

In `DeletableEdge.tsx`, widen the data type and the `edgeStyle` computation:
```tsx
export type DeletableEdgeData = { kind: 'flow' | 'related'; dimmed?: boolean; chosen?: boolean }
export type DeletableEdgeType = Edge<DeletableEdgeData, 'deletable'>
```
Replace the `edgeStyle` line with:
```tsx
  // 관련 edges: muted dashed. Flow edges collapse to the taken trail once decided:
  // the chosen option's edge is emphasized (primary), unchosen ones dim.
  const edgeStyle: React.CSSProperties | undefined =
    data?.kind === 'related' ? { strokeDasharray: '6 4', opacity: 0.5 }
    : data?.dimmed ? { opacity: 0.28 }
    : data?.chosen ? { stroke: 'var(--c-primary)' }
    : undefined
```
> **Implementer note:** if `React.CSSProperties` needs an import here, add `import { type CSSProperties } from 'react'` and type it `CSSProperties | undefined` — match however the repo types inline styles elsewhere (grep `CSSProperties` in `src`). The rest of the component (BaseEdge, the ✕ delete button) is unchanged.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: succeeds. Then lint touched files: `npx eslint src/features/decisions/PlanCanvas.tsx src/features/decisions/OptionCanvasNode.tsx src/features/decisions/DeletableEdge.tsx`.

- [ ] **Step 8: Commit**
```bash
git add src/features/decisions/PlanCanvas.tsx src/features/decisions/OptionCanvasNode.tsx src/features/decisions/OptionCanvasNode.module.css src/features/decisions/DeletableEdge.tsx
git commit -m "feat(decisions-canvas): decided 안건 glows chosen 선택지, dims the rest"
```

---

### Task 2: Canvas as the default view (with remembered choice)

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`

**Interfaces:** none (internal view-state change).

- [ ] **Step 1: Default `view` to canvas + persist**

In `PlanDetail.tsx`, replace the `view` state (currently `useState<'list' | 'canvas' | 'timeline'>('list')`, ~line 78) with a localStorage-backed initializer defaulting to `'canvas'`:
```tsx
  const [view, setView] = useState<'list' | 'canvas' | 'timeline'>(() => {
    const saved = localStorage.getItem(`plan-view-${planId}`)
    return saved === 'list' || saved === 'canvas' || saved === 'timeline' ? saved : 'canvas'
  })
```
Then persist any change (add near the other effects — `useEffect` is already imported):
```tsx
  useEffect(() => { localStorage.setItem(`plan-view-${planId}`, view) }, [view, planId])
```
This defaults new plans to the canvas, remembers the user's choice per plan, and requires no change to the `<Tabs onChange={setView}>` wiring (every `setView` caller persists via the effect).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. Lint: `npx eslint src/features/decisions/PlanDetail.tsx`.

- [ ] **Step 3: Commit**
```bash
git add src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions-canvas): canvas is the default plan view (remembered per plan)"
```

---

## Manual Smoke Checklist (behavioral gate — owed to the user)

1. **Default view:** open a plan → it lands on the **캔버스** tab (not 목록). Switch to 목록, reload the plan → it remembers 목록. Switch back to 캔버스, reload → remembers 캔버스.
2. **Glow/dim on decide:** on an 안건 with ≥2 options and a flow edge from each, **결정하기** (choose one). The chosen 선택지 node stays full/emphasized (primary border + soft bg + ✓); the unchosen option nodes **dim** (~0.4 opacity). The chosen option's outgoing flow edge is emphasized (primary stroke); unchosen options' flow edges go faint.
3. **Trail across steps:** in a chain (A→choose X→B→choose Y→C), the chosen path reads as a continuous emphasized trail while the abandoned branches recede.
4. **Reopen:** 다시 열기 on a decided 안건 → all its options + edges return to normal (no dim, no emphasis).
5. **Undecided untouched:** 안건 with no decision render exactly as before (no dimming).
6. **Realtime:** decide in one browser → the other browser's canvas reflects the glow/dim on refetch (tab switch / remount).

## Not in Phase 4 (deferred — P5)
- Live presence/cursors on the canvas + comments pinned to canvas coordinates.
- On-canvas 서브안건 nesting; surfacing flow edges outside the canvas (목록).
