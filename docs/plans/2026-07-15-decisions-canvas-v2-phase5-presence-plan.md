# Phase 5a — Live Presence & Cursors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Decisions Canvas, each peer sees the others' live cursors gliding over the graph and sees nodes move in real time while a peer drags them — reusing the existing `/ws/plans/{planId}` Yjs-awareness channel.

**Architecture:** One shared awareness connection (lifted into a `PlanPresenceProvider` context) carries widened awareness fields (`cursor`, `drag`) alongside the existing `user`. A single `requestAnimationFrame` interpolation loop (`useSmoothedPresence`) eases each peer's rendered position toward the latest received target every frame, decoupling smooth 60fps render from the jittery ~20/sec packet rate. Cursors render as a `pointer-events:none` overlay positioned via the live React Flow viewport transform; live-drag feeds the same smoothed value into `setNodes`.

**Tech Stack:** React 19 + TypeScript (strict) + Vite, `@xyflow/react` v12, `yjs` + `y-websocket` (already deps), CSS Modules.

## Global Constraints

- Frontend-only. **Zero backend changes, zero Flyway migration.** Repo: `shared-docs` (git identity `valorjj`).
- Gate per task: `npm run build` (runs `tsc -b && vite build`) MUST pass, and `npx eslint <touched files>` MUST be clean for touched files. **There is no unit-test runner** — do not add one; verification is build + lint + the manual smoke noted per task.
- Single shared awareness connection only — never open a second connection to the same `/ws/plans/{id}` room (duplicate-identity bug).
- Bear-minimal aesthetic: solid color, hairlines, **no shadow / no card-lift**. Lucide icons only, never emoji. All UI text in Korean. Design tokens `--c-*` / `--sp-*` / `--r-*` only (except the deliberately non-tokenized `collabColorForUser` palette).
- Commit after each task. Do NOT push or deploy — the user pushes/deploys explicitly.
- Existing helpers to reuse verbatim: `WS_BASE` (`src/features/decisions/collab/wsBase.ts`), `collabColorForUser(userId: number)` (`src/features/notes/collab/collabColor.ts`), `getToken()` (`src/auth/tokenStorage.ts`), `useAuth()` (`src/auth/useAuth.ts`).

---

### Task 1: Shared presence connection (`PlanPresenceProvider` + migrate avatar stack)

Lift the awareness connection out of `DecisionPresenceStack` into a context provider mounted once per plan. The provider owns the single `WebsocketProvider`, sets the local `user` field (as today), exposes `peers` plus `setCursor`/`setDrag` setters (unused this task — wired in Tasks 2–3), and `DecisionPresenceStack` becomes a pure consumer. **Net visual change this task: none** — the avatar stack must look and behave exactly as before, with each user appearing exactly once.

**Files:**
- Create: `src/features/decisions/collab/usePlanPresence.tsx`
- Modify: `src/features/decisions/collab/DecisionPresenceStack.tsx` (remove provider ownership; consume context)
- Modify: `src/features/decisions/PlanDetail.tsx:296` (wrap the `tree && (...)` block in `<PlanPresenceProvider planId={planId}>`)

**Interfaces:**
- Consumes: `WS_BASE`, `getToken`, `useAuth`, `collabColorForUser`.
- Produces (relied on by Tasks 2 & 3):
```ts
// usePlanPresence.tsx
export type PeerCursor = { x: number; y: number } | null
export type PeerDrag = { nodeId: string; x: number; y: number } | null
export type Peer = {
  clientId: number      // Yjs awareness client id — identity for the rAF map
  userId: number
  name: string
  color: string
  cursor: PeerCursor
  drag: PeerDrag
}
export type PlanPresence = {
  peers: Peer[]                                             // SELF EXCLUDED
  setCursor: (pos: { x: number; y: number } | null) => void
  setDrag: (d: PeerDrag) => void
}
export function PlanPresenceProvider(props: { planId: number; children: ReactNode }): JSX.Element
export function usePlanPresence(): PlanPresence
```

- [ ] **Step 1: Create the provider + hook**

Create `src/features/decisions/collab/usePlanPresence.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getToken } from '../../../auth/tokenStorage'
import { useAuth } from '../../../auth/useAuth'
import { collabColorForUser } from '../../notes/collab/collabColor'
import { WS_BASE } from './wsBase'

export type PeerCursor = { x: number; y: number } | null
export type PeerDrag = { nodeId: string; x: number; y: number } | null
export type Peer = {
  clientId: number
  userId: number
  name: string
  color: string
  cursor: PeerCursor
  drag: PeerDrag
}
export type PlanPresence = {
  peers: Peer[]
  setCursor: (pos: { x: number; y: number } | null) => void
  setDrag: (d: PeerDrag) => void
}

type AwarenessUser = { userId: number; name: string; color: string }
type AwarenessState = { user?: AwarenessUser; cursor?: PeerCursor; drag?: PeerDrag }

const noop = () => {}
const Ctx = createContext<PlanPresence>({ peers: [], setCursor: noop, setDrag: noop })

/** Single shared awareness connection for a plan. Owns the WebsocketProvider
 *  (awareness-only, empty Y.Doc). Both the avatar stack and the canvas consume
 *  this ONE connection — a second connection would make each user appear twice. */
export function PlanPresenceProvider({ planId, children }: { planId: number; children: ReactNode }) {
  const { user } = useAuth()
  const [peers, setPeers] = useState<Peer[]>([])
  const providerRef = useRef<WebsocketProvider | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token || !user) return

    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(`${WS_BASE}/ws/plans`, String(planId), yDoc, { params: { token } })
    providerRef.current = provider
    provider.awareness.setLocalStateField('user', {
      userId: user.userId, name: user.name, color: collabColorForUser(user.userId),
    } satisfies AwarenessUser)

    const update = () => {
      const localId = provider.awareness.clientID
      const entries = Array.from(provider.awareness.getStates().entries()) as Array<[number, AwarenessState]>
      setPeers(
        entries
          .filter(([clientId]) => clientId !== localId)
          .flatMap(([clientId, state]) =>
            state.user
              ? [{
                  clientId,
                  userId: state.user.userId,
                  name: state.user.name,
                  color: state.user.color,
                  cursor: state.cursor ?? null,
                  drag: state.drag ?? null,
                }]
              : [],
          ),
      )
    }
    provider.awareness.on('change', update)
    update()

    return () => {
      provider.awareness.off('change', update)
      provider.destroy()
      yDoc.destroy()
      providerRef.current = null
      setPeers([])
    }
  }, [planId, user])

  const value = useMemo<PlanPresence>(() => ({
    peers,
    setCursor: (pos) => providerRef.current?.awareness.setLocalStateField('cursor', pos),
    setDrag: (d) => providerRef.current?.awareness.setLocalStateField('drag', d),
  }), [peers])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlanPresence(): PlanPresence {
  return useContext(Ctx)
}
```

- [ ] **Step 2: Migrate `DecisionPresenceStack` to consume the context**

Replace the whole body of `src/features/decisions/collab/DecisionPresenceStack.tsx` with a pure consumer (drop `planId` prop — the provider is keyed by plan higher up; keep the same markup + CSS module):

```tsx
import { usePlanPresence } from './usePlanPresence'
import styles from './DecisionPresenceStack.module.css'

/** Avatar stack of the other members currently on this plan. Reads the shared
 *  awareness connection from PlanPresenceProvider (no longer owns a socket). */
export default function DecisionPresenceStack() {
  const { peers } = usePlanPresence()
  if (peers.length === 0) return null
  return (
    <div className={styles.stack} aria-label="지금 이 계획을 함께 보고 있는 사람">
      {peers.map((peer) => (
        <span key={peer.clientId} className={styles.avatar} style={{ borderColor: peer.color }} title={peer.name}>
          {peer.name.charAt(0)}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wrap the plan view in the provider + drop the stale prop**

In `src/features/decisions/PlanDetail.tsx`:

1. Add the import near the other decisions imports:
```tsx
import { PlanPresenceProvider } from './collab/usePlanPresence'
```
2. Wrap the existing `{tree && ( ... )}` block (starts at line 296) so the provider encloses BOTH the control strip (avatar stack) and the canvas:
```tsx
{tree && (
  <PlanPresenceProvider planId={planId}>
    <div key={planId} className={discussionOpen ? styles.split : styles.mainWrap}>
      {/* ...unchanged children... */}
    </div>
  </PlanPresenceProvider>
)}
```
3. Change the render site (was line 310) from `<DecisionPresenceStack planId={planId} />` to `<DecisionPresenceStack />`.

- [ ] **Step 4: Build + lint**

Run: `npm run build`
Expected: PASS (no TS errors).
Run: `npx eslint src/features/decisions/collab/usePlanPresence.tsx src/features/decisions/collab/DecisionPresenceStack.tsx src/features/decisions/PlanDetail.tsx`
Expected: clean (no new errors on touched files).

- [ ] **Step 5: Manual smoke (record result in the SDD ledger)**

Two browsers signed in as different users, same plan. Verify: each sees the other's avatar in the strip; **each user appears exactly once** (no duplicate = shared connection is working); closing one tab removes that avatar within a second.

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/collab/usePlanPresence.tsx src/features/decisions/collab/DecisionPresenceStack.tsx src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): shared plan-presence provider (P5a task 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 2: Live cursors (`useSmoothedPresence` engine + `PresenceCursors` overlay + mouse wiring)

Introduce the rAF interpolation engine and render peers' cursors as a smooth overlay. The engine is introduced here because cursors are its first consumer; Task 3 reuses it for drag.

**Files:**
- Create: `src/features/decisions/collab/useSmoothedPresence.ts`
- Create: `src/features/decisions/PresenceCursors.tsx`
- Create: `src/features/decisions/PresenceCursors.module.css`
- Modify: `src/features/decisions/PlanCanvas.tsx` (mouse-move/leave broadcast in `Flow`; render `<PresenceCursors>`)

**Interfaces:**
- Consumes (from Task 1): `usePlanPresence`, `Peer`, `PeerCursor`, `PeerDrag`.
- Produces (relied on by Task 3):
```ts
// useSmoothedPresence.ts
export function useSmoothedPresence(peers: Peer[]): Peer[]   // same peers, cursor+drag positions eased at 60fps
// PresenceCursors.tsx
export default function PresenceCursors(props: { peers: Peer[] }): JSX.Element   // read useViewport() internally
```

- [ ] **Step 1: Create the interpolation engine**

Create `src/features/decisions/collab/useSmoothedPresence.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import type { Peer } from './usePlanPresence'

const ALPHA = 0.25          // ease factor per frame — higher = snappier/less lag, lower = smoother/more lag
const EPSILON = 0.5         // px: within this of target, snap and stop animating that value

type Vec = { x: number; y: number }
type Rendered = { cursor: Vec | null; drag: { nodeId: string; x: number; y: number } | null }

function ease(rendered: number, target: number): number {
  const next = rendered + (target - rendered) * ALPHA
  return Math.abs(target - next) < EPSILON ? target : next
}

/** Decouples render rate from packet rate. Every animation frame, each peer's
 *  rendered cursor/drag position eases toward its latest received target, so the
 *  overlay glides at 60fps regardless of jittery ~20/sec awareness packets. The
 *  rAF loop self-parks when nothing is moving and restarts when a target changes. */
export function useSmoothedPresence(peers: Peer[]): Peer[] {
  const peersRef = useRef<Peer[]>(peers)
  peersRef.current = peers
  const renderedRef = useRef(new Map<number, Rendered>())
  const rafRef = useRef<number | null>(null)
  const [smoothed, setSmoothed] = useState<Peer[]>(peers)

  useEffect(() => {
    const tick = () => {
      const rendered = renderedRef.current
      const current = peersRef.current
      const liveIds = new Set(current.map((p) => p.clientId))
      for (const id of rendered.keys()) if (!liveIds.has(id)) rendered.delete(id)

      let moving = false
      const out = current.map((p) => {
        const prev = rendered.get(p.clientId) ?? { cursor: null, drag: null }

        // cursor
        let cursor: Vec | null
        if (!p.cursor) { cursor = null }
        else if (!prev.cursor) { cursor = { x: p.cursor.x, y: p.cursor.y } }   // new: snap to first target
        else {
          cursor = { x: ease(prev.cursor.x, p.cursor.x), y: ease(prev.cursor.y, p.cursor.y) }
          if (cursor.x !== p.cursor.x || cursor.y !== p.cursor.y) moving = true
        }

        // drag
        let drag: Rendered['drag']
        if (!p.drag) { drag = null }
        else if (!prev.drag || prev.drag.nodeId !== p.drag.nodeId) {
          drag = { nodeId: p.drag.nodeId, x: p.drag.x, y: p.drag.y }           // new node: snap
        } else {
          drag = { nodeId: p.drag.nodeId, x: ease(prev.drag.x, p.drag.x), y: ease(prev.drag.y, p.drag.y) }
          if (drag.x !== p.drag.x || drag.y !== p.drag.y) moving = true
        }

        rendered.set(p.clientId, { cursor, drag })
        return { ...p, cursor, drag }
      })

      setSmoothed(out)
      rafRef.current = moving ? requestAnimationFrame(tick) : null
    }

    // (Re)start the loop whenever peers change (a new target may need animating).
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [peers])

  return smoothed
}
```

> Note on self-parking: the loop stops (`rafRef=null`) once no value is still easing. The effect re-runs on every `peers` change (new packet → new target) and restarts the loop, which runs until it settles again. A settled-but-present cursor keeps rendering at its target with zero frames burned.

- [ ] **Step 2: Create the cursor overlay**

Create `src/features/decisions/PresenceCursors.tsx`:

```tsx
import { useViewport } from '@xyflow/react'
import { MousePointer2 } from 'lucide-react'
import type { Peer } from './collab/usePlanPresence'
import styles from './PresenceCursors.module.css'

/** pointer-events:none overlay of peer cursors. Positions each peer's smoothed
 *  flow-coordinate cursor via the live viewport transform (screen = flow*zoom + pan),
 *  so cursors stay pinned to the graph through this viewer's own pan/zoom. */
export default function PresenceCursors({ peers }: { peers: Peer[] }) {
  const { x, y, zoom } = useViewport()
  return (
    <div className={styles.layer} aria-hidden="true">
      {peers.map((p) =>
        p.cursor ? (
          <div
            key={p.clientId}
            className={styles.cursor}
            style={{ transform: `translate(${p.cursor.x * zoom + x}px, ${p.cursor.y * zoom + y}px)` }}
          >
            <MousePointer2 size={18} className={styles.pointer} style={{ color: p.color, fill: p.color }} />
            <span className={styles.label} style={{ background: p.color }}>{p.name}</span>
          </div>
        ) : null,
      )}
    </div>
  )
}
```

Create `src/features/decisions/PresenceCursors.module.css`:

```css
.layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 5;
}
.cursor {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  display: flex;
  align-items: flex-start;
  gap: 2px;
}
.pointer {
  flex: none;
}
.label {
  margin-top: 10px;
  padding: 1px var(--sp-2);
  border-radius: var(--r-sm);
  font-size: 11px;
  line-height: 1.5;
  color: #fff;
  white-space: nowrap;
}
```

- [ ] **Step 3: Wire mouse broadcast + render the overlay in `Flow`**

In `src/features/decisions/PlanCanvas.tsx`, inside the `Flow` component:

1. Add imports at top of file:
```tsx
import { usePlanPresence } from './collab/usePlanPresence'
import { useSmoothedPresence } from './collab/useSmoothedPresence'
import PresenceCursors from './PresenceCursors'
```
2. Near the other hooks in `Flow` (after `const { screenToFlowPosition } = useReactFlow()`):
```tsx
const { peers, setCursor, setDrag } = usePlanPresence()
const smoothed = useSmoothedPresence(peers)
const lastCursorSent = useRef(0)
```
   (`setDrag` is consumed in Task 3 — reference it there; to avoid an unused-var lint error THIS task, destructure only `peers, setCursor` now and add `setDrag` in Task 3.)
3. Add throttled move handlers (place beside the other `useCallback`s):
```tsx
const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
  const now = performance.now()
  if (now - lastCursorSent.current < 50) return   // ~20 packets/sec
  lastCursorSent.current = now
  const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
  setCursor(pos)
}, [screenToFlowPosition, setCursor])

const onCanvasMouseLeave = useCallback(() => setCursor(null), [setCursor])
```
4. On the canvas wrapper `<div className={styles.canvas} ref={wrapRef}>`, add the handlers:
```tsx
<div className={styles.canvas} ref={wrapRef} onMouseMove={onCanvasMouseMove} onMouseLeave={onCanvasMouseLeave}>
```
5. Render the overlay as a sibling of `<ReactFlow>`, immediately AFTER the closing `</ReactFlow>` tag (still inside the `styles.canvas` div, so it overlays the pane; still inside `ReactFlowProvider`, so `useViewport` works):
```tsx
      </ReactFlow>
      <PresenceCursors peers={smoothed} />
```
6. Ensure `styles.canvas` establishes a positioning context. Check `PlanCanvas.module.css` — the `.canvas` rule must include `position: relative;`. If it is not already present, add `position: relative;` to `.canvas`.

- [ ] **Step 4: Build + lint**

Run: `npm run build`
Expected: PASS.
Run: `npx eslint src/features/decisions/collab/useSmoothedPresence.ts src/features/decisions/PresenceCursors.tsx src/features/decisions/PlanCanvas.tsx`
Expected: clean.

- [ ] **Step 5: Manual smoke (record in ledger)**

Two browsers, same plan, canvas view. Verify: moving the mouse on one shows a colored pointer + correct name gliding **smoothly** (no visible stepping) on the other; the cursor disappears when the mouse leaves the canvas and returns on re-entry; panning/zooming on the observer's side keeps the peer's cursor pinned to the same graph location.

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/collab/useSmoothedPresence.ts src/features/decisions/PresenceCursors.tsx src/features/decisions/PresenceCursors.module.css src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions): live smoothed cursors on the canvas (P5a task 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 3: Live node-drag

Broadcast the local drag gesture and move peers' dragged nodes live from the smoothed target, guarding the node the local user is dragging.

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx` (drag broadcast in `onNodeDrag`/start/stop; effect applying smoothed drags to `setNodes`)

**Interfaces:**
- Consumes (from Tasks 1–2): `usePlanPresence().setDrag`, the `smoothed` peer list from `useSmoothedPresence`, existing `setNodes`, `parseNodeId`.
- Produces: none (terminal task).

- [ ] **Step 1: Add `setDrag` + drag-gesture state to `Flow`**

In `src/features/decisions/PlanCanvas.tsx`:

1. Update the presence destructure to include `setDrag`:
```tsx
const { peers, setCursor, setDrag } = usePlanPresence()
```
2. Add refs for throttling drag sends and tracking the locally-dragged node:
```tsx
const lastDragSent = useRef(0)
const localDragId = useRef<string | null>(null)
```
3. Add `useEffect` to the imports from `react` at the top of the file (currently `import { useCallback, useRef, useState } from 'react'`):
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
```

- [ ] **Step 2: Broadcast the drag gesture**

Add handlers beside the existing `onNodeDragStop`:

```tsx
const onNodeDragStart = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
  localDragId.current = node.id
}, [])

const onNodeDrag = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
  const now = performance.now()
  if (now - lastDragSent.current < 50) return
  lastDragSent.current = now
  setDrag({ nodeId: node.id, x: node.position.x, y: node.position.y })
}, [setDrag])
```

Then extend the EXISTING `onNodeDragStop` body — after the debounced-save block, clear the broadcast and the local guard:

```tsx
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
  setDrag(null)
  localDragId.current = null
}, [moveSubPlan, moveOption, setDrag])
```

- [ ] **Step 3: Apply peers' smoothed drags to the node positions**

Add this effect after `const smoothed = useSmoothedPresence(peers)`:

```tsx
// Move nodes that a peer is dragging, from the smoothed target — but never a node
// the local user is dragging (their own gesture wins). When a peer's drag clears,
// the node simply stays put (last smoothed pos == persisted pos), so no snap-back.
useEffect(() => {
  const drags = smoothed.filter((p) => p.drag && p.drag.nodeId !== localDragId.current)
  if (drags.length === 0) return
  setNodes((ns) =>
    ns.map((n) => {
      const d = drags.find((p) => p.drag!.nodeId === n.id)
      if (!d) return n
      const { x, y } = d.drag!
      if (n.position.x === x && n.position.y === y) return n
      return { ...n, position: { x, y } }
    }),
  )
}, [smoothed, setNodes])
```

- [ ] **Step 4: Attach the new handlers to `<ReactFlow>`**

Add `onNodeDragStart={onNodeDragStart}` and `onNodeDrag={onNodeDrag}` to the `<ReactFlow>` props (next to the existing `onNodeDragStop={onNodeDragStop}`):

```tsx
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
```

- [ ] **Step 5: Build + lint**

Run: `npm run build`
Expected: PASS.
Run: `npx eslint src/features/decisions/PlanCanvas.tsx`
Expected: clean.

- [ ] **Step 6: Manual smoke (record in ledger)**

Two browsers, same plan, canvas view. Verify: dragging a 안건 or 선택지 node on one browser makes it **glide** on the other in real time (not just after drop); on drop the node stays put with no snap-back; reloading the observer shows the node at the persisted position. On a **locked** plan the locked side cannot drag (no movement broadcast). Dragging the SAME node locally while a peer drags it does not fight your own gesture. Closing a tab mid-drag leaves the node at rest (no ghost).

- [ ] **Step 7: Commit**

```bash
git add src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions): live node-drag on the canvas (P5a task 3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

## Self-Review

**Spec coverage:**
- §3 shared connection → Task 1 (`PlanPresenceProvider`, single socket, avatar stack migrated). ✅
- §4.1 `usePlanPresence` → Task 1. ✅
- §4.2 `useSmoothedPresence` → Task 2 Step 1. ✅
- §4.3 `PresenceCursors` overlay → Task 2 Steps 2–3. ✅
- §4.4 canvas wiring: cursor send → Task 2 Step 3; drag send + receive → Task 3. ✅
- §4.5 `DecisionPresenceStack` consumer → Task 1 Step 2. ✅
- §4.6 `PlanDetail` provider wrap → Task 1 Step 3. ✅
- §5 smoothing (send throttle ~50ms; 60fps ease; GPU transform for cursors; setNodes for drag) → Task 2 Step 3 (`performance.now()` 50ms gate, `translate`) + Task 3 Steps 2–3. ✅
- §6 guardrails: duplicate identity (single provider, T1); locked (existing `nodesDraggable={!locked}` unchanged — locked users emit no drag); disconnect mid-drag (rendered map prunes gone clientIds each frame, T2 engine); off-canvas null cursor (T2 overlay skips null); idle self-park (T2 engine); coordinate correctness (flow coords + viewport transform, T2 overlay). ✅
- §7 testing = manual smoke → per-task Step 5/6. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step shows full code. ✅

**Type consistency:** `Peer`/`PeerCursor`/`PeerDrag` defined in Task 1, consumed unchanged in Tasks 2–3. `useSmoothedPresence(peers: Peer[]): Peer[]` (Task 2) consumed in Task 3. `setCursor(pos|null)`, `setDrag(PeerDrag)` signatures match provider (Task 1) and callers (Tasks 2–3). `drag.nodeId` is the namespaced React Flow node id (`sp:`/`opt:`) throughout — matched against `n.id` in Task 3's setNodes and `node.id` in the send handlers. `performance.now()` used consistently for both throttles. ✅

**Note on `setDrag` unused-var in Task 2:** flagged inline in Task 2 Step 3 — destructure only `peers, setCursor` in Task 2, add `setDrag` in Task 3 Step 1, so lint stays clean at each task boundary.
