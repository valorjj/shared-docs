# Phase 5c — Focus / Viewing Halo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or inline execution. Steps use checkbox syntax.

**Goal:** Show each peer's attention on the canvas — solid ring + avatar on the node whose panel they have open, faint ring on the node they hover — riding the P5a awareness channel.

**Architecture:** Widen `usePlanPresence` awareness with `focus`/`hover` node-id fields; a `PresenceHalos` overlay (modeled on `PresenceCursors`) draws rings from live node rects + viewport; broadcast focus from a `FocusBroadcaster` child inside the provider and hover from `PlanCanvas` node-mouse events.

**Tech Stack:** React 19 + TS strict + `@xyflow/react` v12 (`useNodes`, `useViewport`), y-websocket awareness. CSS Modules + `--c-*`/`--sp-*`/`--r-*` tokens.

## Global Constraints

- Bear-minimal: hairline rings via `border`/`outline`, **never box-shadow**; no card-lift; calm. Use design tokens.
- Lucide icons only (no emoji). All UI text Korean (this feature has ~no visible text — avatar is an initial).
- Gate = `npm run build` + `eslint` on touched folders. **No unit-test runner exists — do not add one.**
- Self is excluded from `peers` already; do not render self.
- Setters must be `useCallback([])` (stable) so canvas callbacks don't churn on ~20/sec packets.

---

### Task 1: Widen presence payload with focus/hover

**Files:** Modify `src/features/decisions/collab/usePlanPresence.tsx`

**Interfaces produced:** `Peer.focus: string | null`, `Peer.hover: string | null`; `PlanPresence.setFocus(nodeId: string | null)`, `PlanPresence.setHover(nodeId: string | null)`.

- [ ] Add fields to `Peer`, `AwarenessState`, `PlanPresence`; extend the `Ctx` default with noop setters; copy `focus`/`hover` through in `update()`; add the two `useCallback([])` setters; add both to the `value` memo.

```tsx
// Peer type — add after `drag: PeerDrag`
  focus: string | null
  hover: string | null

// PlanPresence type — add after setDrag
  setFocus: (nodeId: string | null) => void
  setHover: (nodeId: string | null) => void

// AwarenessState — add
type AwarenessState = { user?: AwarenessUser; cursor?: PeerCursor; drag?: PeerDrag; focus?: string | null; hover?: string | null }

// Ctx default
const Ctx = createContext<PlanPresence>({ peers: [], setCursor: noop, setDrag: noop, setFocus: noop, setHover: noop })

// inside update() peer object — add after `drag: state.drag ?? null,`
                  focus: state.focus ?? null,
                  hover: state.hover ?? null,

// setters — after setDrag
  const setFocus = useCallback((nodeId: string | null) => {
    providerRef.current?.awareness.setLocalStateField('focus', nodeId)
  }, [])
  const setHover = useCallback((nodeId: string | null) => {
    providerRef.current?.awareness.setLocalStateField('hover', nodeId)
  }, [])

// value memo
  const value = useMemo<PlanPresence>(() => ({
    peers, setCursor, setDrag, setFocus, setHover,
  }), [peers, setCursor, setDrag, setFocus, setHover])
```

- [ ] `npm run build` green.

---

### Task 2: PresenceHalos overlay

**Files:** Create `src/features/decisions/PresenceHalos.tsx` + `PresenceHalos.module.css`

**Interfaces consumed:** `Peer` (Task 1). **Produced:** default-export `PresenceHalos({ peers }: { peers: Peer[] })`.

- [ ] Component:

```tsx
import { useNodes, useViewport } from '@xyflow/react'
import type { Peer } from './collab/usePlanPresence'
import styles from './PresenceHalos.module.css'

const INSET = 3   // px per stacked focuser

/** pointer-events:none overlay of peer attention. Solid ring + avatar on a peer's
 *  focused node (panel open); faint ring on a hovered node. Rects come from live
 *  measured nodes; positioned via the viewport transform so rings stay pinned to
 *  the graph through this viewer's pan/zoom and follow peer node-drags. */
export default function PresenceHalos({ peers }: { peers: Peer[] }) {
  const nodes = useNodes()
  const { x: vx, y: vy, zoom } = useViewport()
  const rect = new Map(
    nodes.map((n) => [n.id, {
      x: n.position.x, y: n.position.y,
      w: n.measured?.width ?? 0, h: n.measured?.height ?? 0,
    }]),
  )

  // focusers grouped per node for stacking offset
  const focusByNode = new Map<string, Peer[]>()
  peers.forEach((p) => {
    if (p.focus && rect.has(p.focus)) {
      const arr = focusByNode.get(p.focus) ?? []
      arr.push(p)
      focusByNode.set(p.focus, arr)
    }
  })

  return (
    <div className={styles.layer} aria-hidden="true">
      {/* faint hover rings (skip when this peer also focuses the same node) */}
      {peers.map((p) => {
        if (!p.hover || p.hover === p.focus) return null
        const r = rect.get(p.hover)
        if (!r || r.w === 0) return null
        return (
          <div
            key={`h-${p.clientId}`}
            className={styles.hoverRing}
            style={{
              transform: `translate(${r.x * zoom + vx}px, ${r.y * zoom + vy}px)`,
              width: r.w * zoom, height: r.h * zoom, borderColor: p.color,
            }}
          />
        )
      })}
      {/* solid focus rings + avatar badges, stacked per node */}
      {[...focusByNode.entries()].flatMap(([nodeId, arr]) => {
        const r = rect.get(nodeId)!
        if (r.w === 0) return []
        return arr.map((p, i) => (
          <div
            key={`f-${p.clientId}`}
            className={styles.focusRing}
            style={{
              transform: `translate(${r.x * zoom + vx - i * INSET}px, ${r.y * zoom + vy - i * INSET}px)`,
              width: r.w * zoom + i * INSET * 2, height: r.h * zoom + i * INSET * 2,
              borderColor: p.color,
            }}
          >
            <span className={styles.badge} style={{ background: p.color, right: i * 14 }}>
              {p.name.slice(0, 1)}
            </span>
          </div>
        ))
      })}
    </div>
  )
}
```

- [ ] CSS module (hairlines, tokens, no shadow):

```css
.layer { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
.focusRing, .hoverRing {
  position: absolute; top: 0; left: 0; border-radius: var(--r-lg);
  border: 2px solid; box-sizing: border-box;
}
.hoverRing { opacity: 0.35; border-width: 1.5px; }
.focusRing { opacity: 0.9; }
.badge {
  position: absolute; top: -9px;
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: #fff; line-height: 1;
}
```

- [ ] `npm run build` green.

Note: keep `z-index` below `PresenceCursors` so cursors stay on top; verify against `PresenceCursors.module.css`.

---

### Task 3: Broadcast focus + hover, mount overlay

**Files:** Modify `src/features/decisions/PlanDetail.tsx`, `src/features/decisions/PlanCanvas.tsx`

**Interfaces consumed:** Task 1 setters, Task 2 component.

- [ ] **PlanCanvas** — add `setHover` to the `usePlanPresence()` destructure; add handlers and wire them; extend unmount cleanup; mount overlay.

```tsx
// destructure
  const { peers, setCursor, setDrag, setHover } = usePlanPresence()

// handlers (near onCanvasMouseLeave)
  const onNodeMouseEnter = useCallback<(e: React.MouseEvent, node: CanvasNode) => void>(
    (_, node) => setHover(node.id), [setHover])
  const onNodeMouseLeave = useCallback(() => setHover(null), [setHover])

// onCanvasMouseLeave — also clear hover
  const onCanvasMouseLeave = useCallback(() => { setCursor(null); setHover(null) }, [setCursor, setHover])

// unmount cleanup effect — add setHover(null) and setHover to deps
  useEffect(() => () => {
    setCursor(null); setDrag(null); setHover(null)
    if (dragClearTimer.current) { clearTimeout(dragClearTimer.current); dragClearTimer.current = null }
  }, [setCursor, setDrag, setHover])

// on <ReactFlow>: add
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}

// after <PresenceCursors peers={smoothed} />
      <PresenceHalos peers={smoothed} />
```
Add imports: `import PresenceHalos from './PresenceHalos'`.

- [ ] **PlanDetail** — add a `FocusBroadcaster` child inside the provider driven by `selectedNode`.

```tsx
// near other imports
import { PlanPresenceProvider, usePlanPresence } from './collab/usePlanPresence'

// small component (module scope, after imports / before PlanDetail)
function FocusBroadcaster({ nodeId }: { nodeId: string | null }) {
  const { setFocus } = usePlanPresence()
  useEffect(() => {
    setFocus(nodeId)
    return () => setFocus(null)
  }, [nodeId, setFocus])
  return null
}

// inside JSX, first child of <PlanPresenceProvider ...>
          <FocusBroadcaster nodeId={selectedNode ? `${selectedNode.kind}:${selectedNode.id}` : null} />
```

- [ ] `npm run build` + `eslint src/features/decisions` green (no NEW lint errors in touched files).

---

## Manual smoke (2 browsers, owed by user)

1. User A opens 안건 "b" panel → B sees a **solid ring + A's initial badge** on node b. A closes panel → ring clears in B.
2. A hovers node c (no panel) → B sees a **faint ring** on c, no badge; A moves off → clears.
3. A has panel on b AND hovers c → B sees solid ring on b + faint ring on c simultaneously.
4. Both users open the same node → two concentric solid rings + two stacked badges.
5. A drags node b while its panel is open → the ring follows the node in B (rides node position).
6. B pans/zooms → rings stay pinned to their nodes.
7. A navigates away / switches to 목록 → A's rings clear in B (unmount cleanup).
8. A focuses a resolved pin hidden by B's toggle → no ring in B (no rendered node); reveal → ring appears.
9. Never see your own ring.
