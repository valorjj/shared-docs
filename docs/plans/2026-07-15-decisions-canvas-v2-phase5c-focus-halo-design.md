# Decisions Canvas v2 — Phase 5c: Focus / Viewing Halo (design)

**Status:** approved 2026-07-15. FE-only, zero backend, zero migration. Rides the P5a awareness channel.

## Goal

On the plan canvas, show where each *other* person's attention is: a colored ring
around the node they're looking at, in their P5a cursor color. Two intensities:

- **Panel open** — the node whose detail panel a peer has open (`PlanDetail.selectedNode`):
  **solid** hairline ring **+ a small avatar badge** at the node's top-right corner.
  The strong "I'm working on this" signal, so it earns the avatar.
- **Hover** — the node the peer's cursor is over on the canvas: **faint** ring, **no
  avatar**. Hover is transient/flickery, so it stays a bare ring (Bear-minimal).

A peer can have both at once (panel open on A, hovering B) — both render. Self is
never shown (the peers list already excludes self).

## Architecture

Three moving parts, all FE, building directly on P5a's `usePlanPresence`:

### 1. Widen the awareness payload (`collab/usePlanPresence.tsx`)

The awareness state today carries `{ user, cursor, drag }`. Add two string fields
holding **canvas node ids** (the same `sp:{id}` / `opt:{id}` / `pin:{id}` strings the
canvas already uses), or null:

- `focus: string | null` — the node whose panel this user has open.
- `hover: string | null` — the node this user's cursor is over.

New stable setters `setFocus` / `setHover` (both `useCallback([])`, same pattern as
`setCursor`/`setDrag` — they only touch `providerRef.current`, so downstream
callbacks don't churn on every awareness packet). `Peer` gains `focus`/`hover`;
`PlanPresence` gains the two setters; the `update()` peer-builder copies them through.

`useSmoothedPresence` spreads `...p`, so `focus`/`hover` pass through untouched — only
cursor/drag are interpolated. Halos need no interpolation: the target is a discrete
node id, and the ring rides the node's own live on-screen rect.

### 2. The overlay (`PresenceHalos.tsx` + `.module.css`, new)

Modeled on `PresenceCursors`: a `pointer-events:none` layer rendered as a sibling of
`<ReactFlow>` inside `Flow`. Reads node rects reactively via `useNodes()` (React Flow
v12 populates `node.measured.{width,height}`) and the live transform via
`useViewport()`. For each **smoothed** peer:

- if `peer.focus` matches a rendered node → **solid** ring hugging that node's rect
  (`left = pos.x*zoom + vx`, `top = pos.y*zoom + vy`, `w = measured.w*zoom`,
  `h = measured.h*zoom`) in `peer.color`, plus an avatar badge (first char of name) at
  the top-right corner.
- if `peer.hover` matches a rendered node **and differs from that peer's focus** →
  **faint** ring (same geometry, lower opacity, no badge).

Multiple peers focusing one node → rings inset by stack index (a few px each) and
avatar badges offset along the corner so both are visible. Rings use `border`/
`outline` in the peer color — **never box-shadow** (no shadows house rule).

A focus/hover target that isn't a rendered node (deleted node, or a resolved pin
hidden by the 해결된 댓글 표시 toggle) simply renders nothing.

### 3. Broadcasting

- **Focus** — `selectedNode` lives in `PlanDetail`'s body, which is **above**
  `PlanPresenceProvider` in the tree, so `PlanDetail` itself can't call
  `usePlanPresence()`. A tiny `FocusBroadcaster` component rendered *inside* the
  provider takes the current node id as a prop and, in an effect, calls
  `setFocus(nodeId)` (clearing to null on change and on unmount). `PlanDetail` maps
  `selectedNode` → `${kind}:${id}` and passes it down.
- **Hover** — `PlanCanvas` is already inside the provider. Wire React Flow's
  `onNodeMouseEnter(_, node) → setHover(node.id)` and `onNodeMouseLeave → setHover(null)`;
  also clear on canvas mouse-leave and on unmount (alongside the existing
  `setCursor(null)`/`setDrag(null)` cleanup).

## Files

- `collab/usePlanPresence.tsx` — payload + `Peer`/`PlanPresence` types + setters.
- `PresenceHalos.tsx` + `PresenceHalos.module.css` (new) — the overlay.
- `PlanDetail.tsx` — `FocusBroadcaster` child + pass mapped `selectedNode`.
- `PlanCanvas.tsx` — hover wiring, unmount cleanup, mount `<PresenceHalos/>`.

## Testing

Gate: `npm run build` (`tsc -b && vite build`) + `eslint` on touched files. There is
**no unit-test runner** in this repo — do not add one. Acceptance = manual 2-browser
smoke (see plan).

## Non-goals

No backend, no persistence (attention is ephemeral awareness). No halo on the 목록/기록
views (canvas only). No focus-follow / viewport-sync (seeing *where* someone looks, not
being dragged there).
