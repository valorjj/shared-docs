# Decisions D2 — Read-only 안건 Canvas (React Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.
> **Conventions reference (READ FIRST):** `/tmp/frontend-ref.md` — repo structure, UI primitives, tokens, review rules. The D1 feature already lives in `src/features/decisions/` (see `docs/plans/2026-06-08-decisions-d1-frontend.md`).

**Goal:** Add a **read-only** infinite canvas view of one 계획's 안건 nodes, reachable via a 목록/캔버스 toggle on the existing PlanDetail page. The D1 list stays the editable surface; the canvas is a visualization (React Flow / `@xyflow/react`). No editing, no edges, no position persistence yet (those are D3).

**Architecture:** New `@xyflow/react` dependency. Two new components in `src/features/decisions/`: `PlanCanvas` (the ReactFlow wrapper + auto-layout) and `SubPlanCanvasNode` (a custom read-only 안건 node). `PlanDetail` gains a `view: 'list' | 'canvas'` toggle; the canvas is conditionally rendered (mounts fresh on switch — no setState-in-effect). 안건 nodes are laid out left→right by `sortOrder`; a node expands downward to reveal its 선택지 sub-stack (read-only: title + avg score, chosen option highlighted). Uncontrolled flow (`defaultNodes`), pan/zoom only.

**Tech Stack:** `@xyflow/react` v12 (React 19 compatible), Vite, React 19, TS, CSS Modules. Verify per task: `npx tsc --noEmit`, `npx eslint src/features/decisions/`, and (final) `npm run build`.

**Scope guards (YAGNI — these are later phases):**
- No drag, no `onNodesChange`, no position save → D3.
- No edges / `sub_plan_edges` / handles → D3.
- No rating/decision input on the canvas (read-only) → it stays in the 목록 tab.
- No workspace roadmap (계획-level canvas) → D4.
- No timeline/feed → D5.

---

## Korean copy
| Context | Text |
|---|---|
| View toggle | `목록` / `캔버스` |
| Node 선택지 count | `선택지 {n}` |
| Node status chips | EMPTY→`대기` · IN_PROGRESS→`진행 중` · DECIDED→`결정됨` |
| Decided node marker | `결정됨` |
| Canvas empty (no 안건) | `안건이 없어요` · `목록에서 안건을 추가하면 여기에 나타나요.` |
| Node options empty (expanded) | `선택지 없음` |

---

## Task 1: Add the `@xyflow/react` dependency

**Files:** `package.json` / `package-lock.json` (via npm).

- [ ] **Step 1: Install** the latest v12 (React 19 compatible).
```bash
cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs
npm install @xyflow/react@^12
```

- [ ] **Step 2: Confirm it resolves** and the peer deps are happy with React 19.
```bash
npm ls @xyflow/react
```
Expected: a single `@xyflow/react@12.x` entry, no unmet-peer errors for react/react-dom. (v12 lists React 17–19 as peers; React 19.2 is fine. If npm prints an ERESOLVE peer error, re-run with `npm install @xyflow/react@^12 --legacy-peer-deps` and report it.)

- [ ] **Step 3: Build still green** (the dep is added but unused yet).
```bash
npx tsc --noEmit && npm run build
```
Expected: both pass.

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "build(decisions): add @xyflow/react for the 안건 canvas (D2)"
```

---

## Task 2: `SubPlanCanvasNode` — read-only custom node

**Files:**
- Create: `src/features/decisions/SubPlanCanvasNode.tsx`
- Create: `src/features/decisions/SubPlanCanvasNode.module.css`

The node shows, collapsed: title + status chip + `선택지 N` (+ `결정됨` marker when decided). Click the header (`.nodrag` so it never starts a drag) to expand → the 선택지 sub-stack (each: title, avg score, a check on the chosen one). Styled entirely with our tokens so it adapts to any theme.

- [ ] **Step 1: Write `SubPlanCanvasNode.tsx`**

```tsx
import { useState } from 'react'
import { type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import styles from './SubPlanCanvasNode.module.css'
import type { SubPlanNode, SubPlanStatus } from './types'

export type SubPlanCanvasNodeData = { subPlan: SubPlanNode }
export type SubPlanCanvasNodeType = Node<SubPlanCanvasNodeData, 'subplan'>

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}
const STATUS_CLASS: Record<SubPlanStatus, string> = {
  EMPTY: 'statusEmpty', IN_PROGRESS: 'statusProgress', DECIDED: 'statusDecided',
}

export default function SubPlanCanvasNode({ data }: NodeProps<SubPlanCanvasNodeType>) {
  const [open, setOpen] = useState(false)
  const { subPlan } = data
  const chosenId = subPlan.decision?.chosenOptionId ?? null

  return (
    <div className={`${styles.node} ${styles[STATUS_CLASS[subPlan.status]]}`}>
      <button type="button" className={`${styles.head} nodrag`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={styles.title}>{subPlan.title}</span>
        <span className={styles.status}>{STATUS_LABEL[subPlan.status]}</span>
      </button>

      <div className={styles.meta}>
        <span>선택지 {subPlan.options.length}</span>
        {subPlan.decision && <span className={styles.decided}>결정됨</span>}
      </div>

      {open && (
        <div className={styles.options}>
          {subPlan.options.length === 0 ? (
            <p className={styles.empty}>선택지 없음</p>
          ) : (
            subPlan.options.map((o) => (
              <div key={o.id} className={o.id === chosenId ? `${styles.option} ${styles.optionChosen}` : styles.option}>
                {o.id === chosenId && <Check size={12} className={styles.check} aria-label="결정됨" />}
                <span className={styles.optionTitle}>{o.title}</span>
                <span className={styles.optionAvg}>{o.avgScore != null ? o.avgScore.toFixed(1) : '–'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `SubPlanCanvasNode.module.css`** (tokens only; fixed width so layout is deterministic; no shadow):

- `.node`: `width: 260px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-md); display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); font-family: var(--font-sans);`
- `.statusEmpty`: `border-style: dashed; border-color: var(--c-border); opacity: 0.85;`
- `.statusProgress`: `border-color: var(--c-border-strong);`
- `.statusDecided`: `border-color: var(--c-primary); background: var(--c-primary-soft);`
- `.head`: `display: flex; align-items: center; gap: var(--sp-2); background: none; border: none; padding: 0; cursor: pointer; color: var(--c-text); text-align: left;`
- `.title`: `flex: 1; font-size: var(--fs-base); font-weight: var(--fw-semi); color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- `.status`: `font-size: var(--fs-xs); color: var(--c-text-muted); white-space: nowrap;`
- `.meta`: `display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-xs); color: var(--c-text-subtle);`
- `.decided`: `color: var(--c-primary); font-weight: var(--fw-semi);`
- `.options`: `display: flex; flex-direction: column; gap: var(--sp-1); border-top: 1px solid var(--c-border); padding-top: var(--sp-2);`
- `.option`: `display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text);`
- `.optionChosen`: `font-weight: var(--fw-semi); color: var(--c-primary);`
- `.check`: `color: var(--c-primary); flex-shrink: 0;`
- `.optionTitle`: `flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- `.optionAvg`: `font-size: var(--fs-xs); color: var(--c-text-muted); white-space: nowrap;`
- `.empty`: `font-size: var(--fs-sm); color: var(--c-text-subtle); margin: 0;`

- [ ] **Step 3: Verify** `npx tsc --noEmit` && `npx eslint src/features/decisions/` → clean.

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/SubPlanCanvasNode.tsx src/features/decisions/SubPlanCanvasNode.module.css
git commit -m "feat(decisions-fe): read-only 안건 canvas node (D2)"
```

---

## Task 3: `PlanCanvas` — the ReactFlow wrapper + auto-layout

**Files:**
- Create: `src/features/decisions/PlanCanvas.tsx`
- Create: `src/features/decisions/PlanCanvas.module.css`

Lays 안건 nodes left→right by `sortOrder` (the tree arrives already ordered). Uncontrolled (`defaultNodes`), read-only, pan/zoom + `fitView`. Imports the React Flow stylesheet.

- [ ] **Step 1: Write `PlanCanvas.tsx`**

```tsx
import { useMemo } from 'react'
import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EmptyState } from '../../components/ui'
import SubPlanCanvasNode, { type SubPlanCanvasNodeType } from './SubPlanCanvasNode'
import styles from './PlanCanvas.module.css'
import type { SubPlanNode } from './types'

const nodeTypes = { subplan: SubPlanCanvasNode }
const NODE_W = 260
const GAP_X = 64

type Props = { subPlans: SubPlanNode[] }

export default function PlanCanvas({ subPlans }: Props) {
  // Left→right row by arrival order (tree is sortOrder-sorted). Uncontrolled:
  // computed once at mount; the canvas remounts on tab-switch so data stays fresh.
  const nodes = useMemo<SubPlanCanvasNodeType[]>(
    () =>
      subPlans.map((sp, i) => ({
        id: String(sp.id),
        type: 'subplan',
        position: { x: i * (NODE_W + GAP_X), y: 0 },
        data: { subPlan: sp },
        draggable: false,
      })),
    [subPlans],
  )

  if (subPlans.length === 0) {
    return <EmptyState title="안건이 없어요" description="목록에서 안건을 추가하면 여기에 나타나요." />
  }

  return (
    <div className={styles.canvas}>
      <ReactFlow
        defaultNodes={nodes}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 2: Write `PlanCanvas.module.css`** (sized container + theme-adaptive RF chrome via token overrides on global RF classes — these are intentionally NOT module-scoped because React Flow renders its own classnames; use `:global(...)`):

```css
.canvas {
  width: 100%;
  height: 68dvh;
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  overflow: hidden;
}

/* Make the pane background follow the app theme (RF's dark mode bg is fixed). */
.canvas :global(.react-flow__pane) { background: var(--c-bg); }
.canvas :global(.react-flow__attribution) {
  background: transparent;
  font-size: var(--fs-xs);
}
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit` && `npx eslint src/features/decisions/` → clean.
  - If `colorMode` is rejected as an unknown prop by the installed types, the version is older than 12.2 — report it; fallback is to drop the prop (the `:global` pane override + token-styled nodes still render acceptably).
  - If `EmptyState` import is unused after your edits, remove it (it is used in the empty branch — keep).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/PlanCanvas.tsx src/features/decisions/PlanCanvas.module.css
git commit -m "feat(decisions-fe): PlanCanvas ReactFlow wrapper + row layout (D2)"
```

---

## Task 4: 목록/캔버스 toggle in `PlanDetail`

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

Add a `view` state + a `Tabs` switch under the header. The existing list body renders only when `view === 'list'`; the canvas renders only when `view === 'canvas'` (conditional mount → fresh data, no effect). The 결정 modals etc. stay as-is (inert on the canvas).

- [ ] **Step 1: Imports + state.** In `PlanDetail.tsx`, add to the `'../../components/ui'` import the `Tabs` primitive (extend the existing import line). Add the canvas import:
```tsx
import PlanCanvas from './PlanCanvas'
```
Add near the other `useState` modal-state declarations:
```tsx
  const [view, setView] = useState<'list' | 'canvas'>('list')
```

- [ ] **Step 2: Render the toggle + branch the body.** Locate the `{tree && (` block. Immediately inside it (before the existing `{tree.description && ...}` / sub-plan rendering), add the toggle, and wrap the existing list content so it only shows in list view. Concretely, change the structure to:

```tsx
      {tree && (
        <>
          <div className={styles.viewToggle}>
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }]}
              value={view}
              onChange={(v) => setView(v as 'list' | 'canvas')}
            />
          </div>

          {view === 'canvas' ? (
            <PlanCanvas subPlans={tree.subPlans} />
          ) : (
            <>
              {tree.description && <p className={styles.planDesc}>{tree.description}</p>}
              {/* …the entire existing list body: the subPlans.length === 0 EmptyState
                  branch AND the <div className={styles.list}> … </div> branch … */}
            </>
          )}
        </>
      )}
```
Keep ALL the existing list JSX (the `tree.subPlans.length === 0 ? <EmptyState…/> : <div className={styles.list}>…</div>` block and the "안건 추가" button) intact inside that inner `view === 'list'` `<>…</>`. Do not duplicate or remove any modal — the modals stay after the `{tree && (…)}` block, unchanged. Confirm `Tabs`'s `onChange` signature against `src/components/ui/Tabs.tsx` (it is generic over the key union; pass the cast as shown, or type the items so `onChange` yields the union directly — adapt to the real signature and report).

- [ ] **Step 3: CSS.** Add to `PlanDetail.module.css`:
```css
.viewToggle {
  margin-bottom: var(--sp-4);
}
```

- [ ] **Step 4: Verify.** `npx tsc --noEmit` && `npx eslint src/features/decisions/` → clean.

- [ ] **Step 5: Commit**
```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions-fe): 목록/캔버스 toggle on plan detail (D2)"
```

---

## Task 5: Final build + smoke

- [ ] **Step 1: Full verification.**
```bash
npx tsc --noEmit
npx eslint src/features/decisions/
npm run build
```
All three green. (Repo-wide `eslint src/` has pre-existing errors in untouched calc/notes/sheets files — ignore; only the decisions feature must be clean.)

- [ ] **Step 2: Manual smoke** (requires backend `bootRun` + dev login; report for the user, not a commit blocker):
  1. Open a 계획 with ≥2 안건 (some with options, one decided). Default view is 목록 (D1 list, editable) — unchanged.
  2. Switch to 캔버스 → 안건 nodes render in a left→right row, pan/zoom works, `fitView` frames them, attribution + zoom controls present.
  3. A node cannot be dragged (read-only). Status styling differs by state (대기 dashed-dim / 진행 중 / 결정됨 primary-tinted with `결정됨`).
  4. Click a node header → expands to show its 선택지 with avg scores; the decided option shows a check + highlight; expanding doesn't overlap neighbors (they're side-by-side).
  5. Empty plan (no 안건) → 캔버스 shows the empty state, not a blank canvas.
  6. Switch back to 목록 → unchanged; edit a 안건, return to 캔버스 → reflects the change (remounted with fresh data).

- [ ] **Step 3:** No commit needed if steps 1–2 of this task pass with the work already committed in Tasks 1–4. (If `npm run build` surfaced anything, fix + commit.)

---

## Done criteria
- `@xyflow/react` added; `tsc` + `eslint` (decisions) + `npm run build` green.
- PlanDetail has a 목록/캔버스 toggle; 목록 is the unchanged editable D1 list; 캔버스 is a read-only React Flow row of 안건 nodes (status-styled, expandable to 선택지 with avg + chosen highlight), pan/zoom + fitView, no drag/edges, theme-adaptive nodes.
- No regressions to D1 editing; no setState-in-effect; Korean-only, Lucide-only, tokens-only.

## Known minors (acceptable for D2; revisit later)
- `colorMode="dark"` styles RF chrome dark; under the rarely-used light theme the zoom controls look dark. Nodes themselves are token-styled so they adapt. (D5 polish could derive colorMode from the active theme.)
- Canvas captures data at mount (uncontrolled); a background refetch while staying on the 캔버스 tab won't live-update until you revisit the tab. Fine for read-only.

## After D2
**D3** — free-form drag + persistence: enable dragging, persist `canvasX/canvasY` (debounced PATCH), draw/delete `SubPlanEdge`s (new `sub_plan_edges` table + its additive migration + backend endpoints `POST /api/plans/{id}/edges`, `DELETE /api/edges/{id}`), and create 안건 on the canvas. This is where the canvas becomes interactive and the open §11 node-boundary question gets revisited for edges/handles.
