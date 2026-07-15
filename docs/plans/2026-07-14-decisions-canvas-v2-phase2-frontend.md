# Decisions Canvas v2 — Phase 2 (Canvas Graph) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the new decision-flow graph on the 캔버스 tab — every 안건 **and** every 선택지 is a draggable node, with auto dashed ownership links (안건→its options) and user-drawn solid flow edges (option→downstream 안건, a DAG). Grid-snap + minimap. Positions persist. Canvas stays a tab (default view unchanged; that flip is Phase 4).

**Architecture:** Rework `PlanCanvas` (@xyflow/react v12) to build two node kinds + three edge kinds from the `PlanTree`. Node ids are **namespaced** (`sp:{id}` / `opt:{id}`) to avoid 안건/option id collisions; drag-persist and connections dispatch by prefix. Consumes the Phase 1 backend (`optionFlowEdges` in the tree; `POST /api/plans/{planId}/option-flow-edges`, `DELETE /api/option-flow-edges/{edgeId}`, `PATCH /api/options/{id}` for position).

**Tech Stack:** React 19, TypeScript (strict), `@xyflow/react ^12.11.0`, `@tanstack/react-query ^5`, CSS Modules, `apiClient` (axios).

**Design spec:** `docs/plans/2026-07-14-decisions-canvas-v2-design.md`. This is **Phase 2 of 4**; Phase 3 (slide-in detail panel) and Phase 4 (glow/dim + canvas-as-default) follow.

## Global Constraints

- **Verification gate is `npm run build`** (tsc strict + Vite). ESLint is pre-existing-RED on `main`; lint only the touched folder, do not gate on a clean full-tree lint. There is no unit-test harness for the canvas — each task is build-gated; a manual 2-browser smoke checklist (end of plan) is the behavioral gate, owed to the user.
- **Node ids MUST be namespaced:** `sp:{subPlanId}` and `opt:{optionId}`. Never emit a bare numeric id — 안건 and option ids share no namespace and will collide. All edge `source`/`target` use these prefixed ids.
- **Handles:** both node kinds expose exactly one `target` (Left) and one `source` (Right) handle. Ownership = 안건.source→option.target; flow = option.source→안건.target; 관련(legacy) = 안건.source→안건.target. No handle ids.
- **`isValidConnection` permits ONLY 선택지→안건** (flow). 안건→안건 (관련) is NOT drawable on the canvas in v2 (managed in 목록); ownership is auto-only.
- **Tolerate dangling edges:** a flow edge whose source option or target 안건 is not on the canvas (e.g. a nested 안건 — see design carry-forward) is **skipped**, not rendered. Same for legacy 관련 edges.
- **Bear-minimal styling** (memory: no shadows/lift, hairlines, `--c-*`/`--sp-*`/`--r-*` tokens, Lucide never emoji, Korean copy). Reuse existing token conventions.
- **Fire-and-forget position persistence** (no query invalidation), mirroring `useMoveSubPlan`. Flow-edge create/delete invalidate `decisionKeys.scope` (mirroring `useCreateEdge`/`useDeleteEdge`).
- **Seed-once behavior preserved:** the canvas seeds controlled state from the tree at mount and ignores later refetches while mounted (existing pattern). New flow edges are appended to local state on create.

---

### Task 1: Types + API hooks

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`

**Interfaces:**
- Produces: `OptionNode.canvasX/canvasY: number | null`; `FlowEdge` type; `PlanTree.optionFlowEdges: FlowEdge[]`; `CreateFlowEdgePayload`; hooks `useAddFlowEdge(planId)`, `useDeleteFlowEdge()`, `useMoveOption()`.

- [ ] **Step 1: Extend `OptionNode` and `PlanTree`, add `FlowEdge`**

In `types.ts`, add `canvasX`/`canvasY` to `OptionNode`:
```ts
export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  proCons: ProCon[]
  voterUserIds: number[]
  resources: OptionResource[]
  canvasX: number | null
  canvasY: number | null
}
```

Add a `FlowEdge` type next to `SubPlanEdge`:
```ts
/** An option-sourced flow edge: 선택지 → downstream 안건 ("choosing this leads there"). */
export type FlowEdge = {
  id: number
  sourceOptionId: number
  targetSubPlanId: number
}
```

Add `optionFlowEdges` to `PlanTree` (right after `edges`):
```ts
  subPlans: SubPlanNode[]
  edges: SubPlanEdge[]
  optionFlowEdges: FlowEdge[]
}
```

Add the create payload next to `CreateEdgePayload`:
```ts
export type CreateFlowEdgePayload = { sourceOptionId: number; targetSubPlanId: number }
```

- [ ] **Step 2: Add the three hooks in `api.ts`**

Add near `useCreateEdge`/`useDeleteEdge` (mirror their shape exactly). Import `FlowEdge`/`CreateFlowEdgePayload`/`CanvasPositionPayload` from `./types` if not already imported.

```ts
/** Create a flow edge (선택지 → 안건). Invalidates the decisions scope so the 목록
 *  view reflects it; the mounted canvas appends the returned edge to its own state. */
export function useAddFlowEdge(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: CreateFlowEdgePayload) =>
      (await apiClient.post<FlowEdge>(`/api/plans/${planId}/option-flow-edges`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

export function useDeleteFlowEdge() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/option-flow-edges/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

/** Persist an option node's dragged position. Fire-and-forget, no invalidation
 *  (mirrors useMoveSubPlan — the mounted canvas owns node state; next mount re-reads). */
export function useMoveOption() {
  return useMutation({
    mutationFn: async (v: { id: number; payload: CanvasPositionPayload }) => {
      await apiClient.patch(`/api/options/${v.id}`, v.payload)
    },
  })
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds (tsc has no errors; the new tree field flows through — any component reading `tree` still compiles because the field is additive).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions-canvas): FE types + flow-edge/move-option hooks"
```

---

### Task 2: OptionCanvasNode component

**Files:**
- Create: `src/features/decisions/OptionCanvasNode.tsx`
- Create: `src/features/decisions/OptionCanvasNode.module.css`

**Interfaces:**
- Consumes: `OptionNode` (Task 1).
- Produces: `OptionCanvasNode` (default export), `OptionCanvasNodeType`, `OptionCanvasNodeData = { option: OptionNode; chosen: boolean }`.

- [ ] **Step 1: Write the component**

`src/features/decisions/OptionCanvasNode.tsx`:
```tsx
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Check, Vote, ListChecks, Paperclip } from 'lucide-react'
import styles from './OptionCanvasNode.module.css'
import type { OptionNode } from './types'

export type OptionCanvasNodeData = { option: OptionNode; chosen: boolean }
export type OptionCanvasNodeType = Node<OptionCanvasNodeData, 'option'>

export default function OptionCanvasNode({ data }: NodeProps<OptionCanvasNodeType>) {
  const { option, chosen } = data
  return (
    <div className={chosen ? `${styles.node} ${styles.chosen}` : styles.node}>
      {/* ownership in (from its 안건) on the left; flow out (to a downstream 안건) on the right */}
      <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <div className={styles.head}>
        {chosen && <Check size={13} className={styles.check} aria-label="결정됨" />}
        <span className={styles.title}>{option.title}</span>
      </div>
      {(option.voterUserIds.length > 0 || option.proCons.length > 0 || option.resources.length > 0) && (
        <div className={styles.meta}>
          {option.voterUserIds.length > 0 && (
            <span className={styles.metaItem}><Vote size={12} /> {option.voterUserIds.length}</span>
          )}
          {option.proCons.length > 0 && (
            <span className={styles.metaItem}><ListChecks size={12} /> {option.proCons.length}</span>
          )}
          {option.resources.length > 0 && (
            <span className={styles.metaItem}><Paperclip size={12} /> {option.resources.length}</span>
          )}
        </div>
      )}
    </div>
  )
}
```

> Note: the Left (ownership-in) handle is `isConnectable={false}` — the user never wires ownership by hand; only the Right source (flow-out) is draggable.

- [ ] **Step 2: Write the CSS module**

`src/features/decisions/OptionCanvasNode.module.css`:
```css
.node {
  width: 200px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3);
  font-family: var(--font-sans);
}
.chosen {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
.head {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.check { color: var(--c-primary); flex: none; }
.title {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.metaItem { display: inline-flex; align-items: center; gap: 2px; }
.handle {
  width: 10px;
  height: 10px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  opacity: 0.45;
  transition: opacity 0.12s ease, border-color 0.12s ease;
}
.node:hover .handle { opacity: 1; }
.handle:hover { opacity: 1; border-color: var(--c-accent); }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds (component compiles; not yet referenced — registration is Task 5).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/OptionCanvasNode.tsx src/features/decisions/OptionCanvasNode.module.css
git commit -m "feat(decisions-canvas): OptionCanvasNode (선택지 as a graph node)"
```

---

### Task 3: Rework SubPlanCanvasNode (options are now their own nodes)

**Files:**
- Modify: `src/features/decisions/SubPlanCanvasNode.tsx` (strip inline options; add accent color + icon + deadline)
- Modify: `src/features/decisions/SubPlanCanvasNode.module.css` (remove dead option styles; add `.accented`/`.icon`/`.deadline`)

**Interfaces:**
- Consumes: `SubPlanNode`, `AccentIcon` (existing).
- Produces: unchanged exports (`SubPlanCanvasNode`, `SubPlanCanvasNodeType`, `SubPlanCanvasNodeData`). Handles stay target=Left, source=Right.

- [ ] **Step 1: Rewrite the component (drop the expand/options block, add accent/icon/deadline)**

Replace the entire body of `src/features/decisions/SubPlanCanvasNode.tsx` with:
```tsx
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock, type LucideIcon } from 'lucide-react'
import styles from './SubPlanCanvasNode.module.css'
import type { SubPlanNode, SubPlanStatus, AccentIcon } from './types'

export type SubPlanCanvasNodeData = { subPlan: SubPlanNode }
export type SubPlanCanvasNodeType = Node<SubPlanCanvasNodeData, 'subplan'>

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}
const ICON_MAP: Record<AccentIcon, LucideIcon> = {
  Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock,
}

export default function SubPlanCanvasNode({ data }: NodeProps<SubPlanCanvasNodeType>) {
  const { subPlan } = data
  const statusClass =
    subPlan.status === 'EMPTY' ? styles.statusEmpty
    : subPlan.status === 'DECIDED' ? styles.statusDecided
    : styles.statusProgress
  const AccentIconCmp = subPlan.icon && subPlan.icon in ICON_MAP ? ICON_MAP[subPlan.icon as AccentIcon] : null
  const accentStyle = subPlan.accentColor
    ? ({ ['--card-accent' as string]: `var(--c-tag-${subPlan.accentColor})` } as React.CSSProperties)
    : undefined

  return (
    <div
      className={`${styles.node} ${statusClass}${subPlan.accentColor ? ` ${styles.accented}` : ''}`}
      style={accentStyle}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <div className={styles.head}>
        {AccentIconCmp && <AccentIconCmp size={14} className={styles.icon} />}
        <span className={styles.title}>{subPlan.title}</span>
        <span className={styles.status}>{STATUS_LABEL[subPlan.status]}</span>
      </div>
      <div className={styles.meta}>
        <span>선택지 {subPlan.options.length}</span>
        {subPlan.deadline && <span className={styles.deadline}>기한 {subPlan.deadline}</span>}
      </div>
    </div>
  )
}
```
(Requires `import type React from 'react'` OR use the `as React.CSSProperties` cast with React types already in scope — Vite/TSX has `React` types globally; if tsc complains about `React` namespace, add `import type { CSSProperties } from 'react'` and use `as CSSProperties`.)

> **Implementer note:** if the `React.CSSProperties` reference fails tsc (no React import), switch to `import type { CSSProperties } from 'react'` and `as CSSProperties`. This mirrors how `SubPlanCard.tsx` types its `--card-accent` inline style — read that file's import + cast and match it exactly.

- [ ] **Step 2: Update the CSS module — remove dead option styles, add accent/icon/deadline**

In `SubPlanCanvasNode.module.css`: delete the now-unused rules `.options`, `.option`, `.optionChosen`, `.check`, `.optionTitle`, `.optionVotes`, `.empty`. Add:
```css
.icon { color: var(--c-text-muted); flex: none; }
.deadline { color: var(--c-text-subtle); }
/* Soft full-card accent wash + border tint (ported from SubPlanCard). */
.accented { position: relative; border-color: color-mix(in srgb, var(--card-accent) 30%, var(--c-border)); }
.accented::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--card-accent);
  opacity: 0.07;
  border-radius: inherit;
  pointer-events: none;
}
```
Keep `.node`, `.head`, `.title`, `.status`, `.meta`, the `.statusEmpty/Progress/Decided` variants, and `.handle` rules as-is. If `.head` was styled as a `button` reset, it's now a `div` — the existing rules apply to the class regardless; leave them.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds. Confirm no lingering reference to the removed `useState`/`ChevronDown`/`ChevronRight`/`Check` imports (remove them — the rewrite already drops them).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/SubPlanCanvasNode.tsx src/features/decisions/SubPlanCanvasNode.module.css
git commit -m "feat(decisions-canvas): 안건 node drops inline options, gains accent/icon/deadline"
```

---

### Task 4: Edge components — flow/related (deletable) + ownership (auto)

**Files:**
- Modify: `src/features/decisions/DeletableEdge.tsx` (carry an edge `kind` for flow vs related styling)
- Create: `src/features/decisions/OwnershipEdge.tsx`

**Interfaces:**
- Produces: `DeletableEdgeType = Edge<{ kind: 'flow' | 'related' }, 'deletable'>`; `OwnershipEdge` (default export), `OwnershipEdgeType`.

- [ ] **Step 1: Give `DeletableEdge` a `kind` for styling**

Replace `src/features/decisions/DeletableEdge.tsx` with:
```tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import styles from './DeletableEdge.module.css'

export type DeletableEdgeData = { kind: 'flow' | 'related' }
export type DeletableEdgeType = Edge<DeletableEdgeData, 'deletable'>

export default function DeletableEdge(
  { id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }: EdgeProps<DeletableEdgeType>,
) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  // 관련 (legacy 안건→안건) edges render muted + dashed; flow edges are solid.
  const edgeStyle = data?.kind === 'related' ? { strokeDasharray: '6 4', opacity: 0.5 } : undefined

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={edgeStyle} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`${styles.delete} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={() => deleteElements({ edges: [{ id }] })}
            aria-label="연결 삭제"
          >
            <X size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
```

- [ ] **Step 2: Write the ownership edge (auto, dashed, non-interactive)**

`src/features/decisions/OwnershipEdge.tsx`:
```tsx
import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'

export type OwnershipEdgeType = Edge<Record<string, never>, 'ownership'>

/** 안건 → its 선택지: automatic ownership link. Muted dashed, no arrowhead,
 *  never selectable/deletable (handled by the edge's selectable/deletable flags). */
export default function OwnershipEdge(
  { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps<OwnershipEdgeType>,
) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <BaseEdge id={id} path={path} style={{ stroke: 'var(--c-border-strong)', strokeDasharray: '4 4', opacity: 0.55 }} />
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds (edge components compile; registration is Task 5).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/DeletableEdge.tsx src/features/decisions/OwnershipEdge.tsx
git commit -m "feat(decisions-canvas): flow/related deletable edge + auto ownership edge"
```

---

### Task 5: PlanCanvas rework — build the graph, wire flow, snap + minimap

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–4 (`useAddFlowEdge`, `useDeleteFlowEdge`, `useMoveOption`, `OptionCanvasNode`, reworked `SubPlanCanvasNode`, `DeletableEdge`, `OwnershipEdge`, `PlanTree.optionFlowEdges`).

- [ ] **Step 1: Rewrite node/edge construction + id namespacing**

At the top of `PlanCanvas.tsx`, replace the type registration + constants + `nodePosition`/`toNode`/`toEdge` block with the following. Add imports: `MiniMap` from `@xyflow/react`; `OptionCanvasNode` + `OptionCanvasNodeType`; `OwnershipEdge` + `OwnershipEdgeType`; the `useAddFlowEdge`/`useDeleteFlowEdge`/`useMoveOption` hooks; and `DeletableEdgeType` (already imported).

```ts
const nodeTypes = { subplan: SubPlanCanvasNode, option: OptionCanvasNode }
const edgeTypes = { deletable: DeletableEdge, ownership: OwnershipEdge }

const CLUSTER_GAP_X = 520   // horizontal gap between 안건 clusters (auto-layout)
const OPT_OFFSET_X = 320    // options placed to the right of their 안건
const OPT_GAP_Y = 84        // vertical gap between sibling option nodes
const SNAP = 16
const DRAG_SAVE_MS = 400

const spId = (id: number) => `sp:${id}`
const optId = (id: number) => `opt:${id}`
const parseNodeId = (nid: string): { kind: 'sp' | 'opt'; id: number } => {
  const [k, n] = nid.split(':')
  return { kind: k as 'sp' | 'opt', id: Number(n) }
}

type CanvasNode = SubPlanCanvasNodeType | OptionCanvasNodeType
type CanvasEdge = DeletableEdgeType | OwnershipEdgeType

/** 안건 nodes + their option nodes. Saved canvasX/Y win; nulls fall back to a
 *  left→right cluster fan-out (안건, then its options stacked to the right). */
function buildNodes(tree: PlanTree): CanvasNode[] {
  const nodes: CanvasNode[] = []
  tree.subPlans.forEach((sp, i) => {
    const baseX = sp.canvasX ?? i * CLUSTER_GAP_X
    const baseY = sp.canvasY ?? 0
    nodes.push({ id: spId(sp.id), type: 'subplan', position: { x: baseX, y: baseY }, data: { subPlan: sp } })
    const chosenId = sp.decision?.chosenOptionId ?? null
    sp.options.forEach((o, j) => {
      const ox = o.canvasX ?? baseX + OPT_OFFSET_X
      const oy = o.canvasY ?? baseY + (j - (sp.options.length - 1) / 2) * OPT_GAP_Y
      nodes.push({ id: optId(o.id), type: 'option', position: { x: ox, y: oy }, data: { option: o, chosen: o.id === chosenId } })
    })
  })
  return nodes
}

/** Ownership (안건→option, auto), flow (option→안건, from tree.optionFlowEdges),
 *  and legacy 관련 (안건→안건, from tree.edges). Dangling edges — any endpoint not
 *  rendered as a node — are skipped. */
function buildEdges(tree: PlanTree): CanvasEdge[] {
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
    edges.push({
      id: `flow:${e.id}`, source: optId(e.sourceOptionId), target: spId(e.targetSubPlanId),
      type: 'deletable', data: { kind: 'flow' }, markerEnd: { type: MarkerType.ArrowClosed },
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

- [ ] **Step 2: Rework `Flow` — seed, mutations, dispatch, connect, delete**

In the `Flow` component, replace the seed lines and mutation wiring:
```ts
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(buildNodes(tree))
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(buildEdges(tree))
  const { theme } = useSettings()
  const colorMode = theme === 'light' ? 'light' : 'dark'
  const { screenToFlowPosition } = useReactFlow()

  const moveSubPlan = useMoveSubPlan()
  const moveOption = useMoveOption()
  const addFlowEdge = useAddFlowEdge(tree.id)
  const deleteFlowEdge = useDeleteFlowEdge()
  const deleteRelatedEdge = useDeleteEdge()
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)
```

Replace `onNodeDragStop` to dispatch by id prefix:
```ts
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const onNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
    const { kind, id } = parseNodeId(node.id)
    const timers = saveTimers.current
    const existing = timers.get(node.id)
    if (existing) clearTimeout(existing)
    timers.set(node.id, setTimeout(() => {
      const payload = { canvasX: node.position.x, canvasY: node.position.y }
      if (kind === 'sp') moveSubPlan.mutate({ id, payload })
      else moveOption.mutate({ id, payload })
      timers.delete(node.id)
    }, DRAG_SAVE_MS))
  }, [moveSubPlan, moveOption])
```

Replace `onConnect` (flow-only) and add `isValidConnection`:
```ts
  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false
    return parseNodeId(c.source).kind === 'opt' && parseNodeId(c.target).kind === 'sp'
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return
    const s = parseNodeId(c.source)
    const t = parseNodeId(c.target)
    if (s.kind !== 'opt' || t.kind !== 'sp') return
    addFlowEdge.mutate(
      { sourceOptionId: s.id, targetSubPlanId: t.id },
      {
        onSuccess: (edge) => setEdges((es) => addEdge({
          id: `flow:${edge.id}`, source: optId(edge.sourceOptionId), target: spId(edge.targetSubPlanId),
          type: 'deletable', data: { kind: 'flow' }, markerEnd: { type: MarkerType.ArrowClosed },
        }, es)),
        onError: (err) => window.alert((err as { body?: { detail?: string } }).body?.detail ?? '연결할 수 없어요.'),
      },
    )
  }, [addFlowEdge, setEdges])
```

Replace `onEdgesDelete` to dispatch by edge kind (ownership edges are `deletable:false`, so they never appear here):
```ts
  const onEdgesDelete = useCallback((deleted: CanvasEdge[]) => {
    deleted.forEach((e) => {
      const kind = (e.data as { kind?: string } | undefined)?.kind
      const dbId = Number(e.id.split(':')[1])
      if (kind === 'flow') deleteFlowEdge.mutate(dbId)
      else if (kind === 'related') deleteRelatedEdge.mutate(dbId)
    })
  }, [deleteFlowEdge, deleteRelatedEdge])
```

Update `addAtCenter` to namespace the new 안건 node id and use `moveSubPlan`:
```ts
  const addAtCenter = useCallback((payload: { title: string; description?: string }, done: () => void) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 }
    addSubPlanM.mutate(payload, {
      onSuccess: (sp) => {
        moveSubPlan.mutate({ id: sp.id, payload: { canvasX: center.x, canvasY: center.y } })
        setNodes((ns) => ns.concat({ id: spId(sp.id), type: 'subplan', position: center, data: { subPlan: sp } }))
        done()
      },
    })
  }, [addSubPlanM, moveSubPlan, screenToFlowPosition, setNodes])
```

> Also update `CanvasEmpty` (the zero-안건 branch) if it references `move`/`toNode` — it uses `useAddSubPlanOnCanvas` with no position, so no change is needed beyond confirming it still compiles.

- [ ] **Step 3: Add `isValidConnection`, `snapToGrid`, `MiniMap` to the render**

In the `<ReactFlow>` element, add these props (alongside the existing ones):
```tsx
      isValidConnection={isValidConnection}
      snapToGrid
      snapGrid={[SNAP, SNAP]}
```
And inside `<ReactFlow>`, add the minimap between `<Background />` and `<Controls />`:
```tsx
      <Background />
      <MiniMap pannable zoomable ariaLabel="미니맵" />
      <Controls showInteractive={false} />
```
Keep all existing lock-gating props (`nodesDraggable={!locked}`, etc.) and `onConnect`/`onEdgesDelete`/`onNodeDragStop` bindings unchanged.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds. Then lint only the touched folder: `npx eslint src/features/decisions/PlanCanvas.tsx src/features/decisions/OptionCanvasNode.tsx src/features/decisions/SubPlanCanvasNode.tsx src/features/decisions/DeletableEdge.tsx src/features/decisions/OwnershipEdge.tsx` — fix any NEW errors in these files (ignore pre-existing repo-wide debt).

- [ ] **Step 5: Commit**
```bash
git add src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions-canvas): render 안건+선택지 nodes, flow edges, snap + minimap"
```

---

## Manual Smoke Checklist (behavioral gate — owed to the user)

`npm run build` is the automated gate; the canvas has no unit harness, so verify these by hand on the running app (a plan with ≥2 안건, each with options):

1. **Nodes render:** 캔버스 tab shows each 안건 as a node with its options as separate nodes to the right, joined by dashed ownership links. Chosen option shows a ✓; vote/장단점/자료 counts show. The MiniMap renders (bottom-right).
1b. **안건 node decorations:** an 안건 with a **color + icon tag** and a **deadline** shows the accent wash (soft `--c-tag-*` tint), the Lucide glyph before the title, and a `기한 …` chip — these are the new render paths (accent/icon/deadline) most likely to silently break.
2. **Drag persists:** drag a 안건 and an option; reload the plan → positions retained (both `sub_plans` and `options` persisted). Nodes snap to the 16px grid.
3. **Draw flow:** drag from an option's right handle to a downstream 안건's left handle → a solid arrow appears; reload → it persists. Verify you CANNOT draw 안건→안건, 안건→option, or option→option (invalid connections are refused).
4. **Cycle rejected:** attempt to draw a flow that would loop back (e.g. B's option → A when A already flows to B) → alerted with the backend's Korean message, no edge created.
5. **Delete flow:** select a flow edge → ✕ → removed; reload → gone.
6. **Legacy 관련 edges** (if any exist from before) render muted/dashed and are deletable; new ones are NOT drawable on the canvas (by design).
7. **Lock:** lock the plan → dragging, connecting, and deleting are all disabled; nodes still render.
8. **Realtime:** in a second browser, add an option / draw a flow edge → the 목록 view updates; the canvas updates on remount (switch tab away and back). (Live in-place canvas update is a later polish, not Phase 2.)
9. **Dangling tolerance:** (only if a nested-안건 flow edge exists via API) the canvas does not crash — such edges are silently skipped.

## Not in Phase 2 (later plans)
- Click a node → slide-in detail panel (Phase 3).
- Decision glow/dim of chosen/unchosen branches; making the canvas the default view (Phase 4).
- Creating options directly on the canvas (options are added in 목록/detail; they appear on the canvas on remount).
- Live in-place canvas refresh while mounted; live presence/cursors (deferred).
