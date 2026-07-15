# Decisions Canvas v2 — Phase 5a: Live Presence & Cursors

**Date:** 2026-07-15
**Status:** Design (approved for planning)
**Scope:** Frontend-only. Zero backend changes, zero DB migration.
**Depends on:** Phase 1–4 (shipped 2026-07-14). Repo: `shared-docs` (git identity `valorjj`).

---

## 1. Goal

Make the Decisions Canvas feel *inhabited* in real time: while two people are on the same plan, each sees the other's **live cursor** gliding over the graph and sees nodes **move in real time** as the other drags them (not only after drop). This is the n8n-multiplayer feel.

**In scope:** live cursors (colored pointer + name pill, in flow coordinates) and live node-drag. The existing avatar stack (`DecisionPresenceStack`) stays.

**Explicitly out of scope (deferred):**
- Node focus / "viewing" halo (which node a peer has open).
- Canvas-pinned comments (Phase 5b — separate spec; needs a V29 migration).
- Cross-instance presence (single-instance in-memory relay is fine at current scale; distributed sync is the separate `shared-doc-yjs` lab).

## 2. Why this is cheap

The `/ws/plans/{planId}` Yjs-awareness channel **already exists** and is already open whenever a plan is viewed. Today it carries only `{ user: { name, color } }` and feeds the avatar stack. Presence/cursors is purely: (a) widen the awareness payload, (b) render an overlay, (c) drive it smoothly. No new socket, no new endpoint, no table, no Flyway migration.

Backend for reference (unchanged by this phase): `CollabWebSocketConfig` registers `/ws/plans/{planId}` as a protocol-blind binary Yjs relay via `BlindRelayHandler` + `CollabRoomRegistry`; handshake auth via `?token=` (`JwtQueryTokenInterceptor`).

## 3. Critical constraint: ONE shared connection

`DecisionPresenceStack` today owns its *own* `WebsocketProvider`. If the canvas opened a **second** connection to the same room, each user would get two awareness client IDs and appear **twice** (duplicate avatar + duplicate cursor). Therefore the provider MUST be shared. We lift it into a `usePlanPresence(planId)` context provider, mounted once in `PlanDetail`, wrapping both the avatar stack and the canvas. This is a prerequisite, not an option.

## 4. Architecture — units

### 4.1 `usePlanPresence(planId)` — presence connection (new)
`src/features/decisions/collab/usePlanPresence.tsx` (context + hook).

Owns the single `WebsocketProvider` + empty `Y.Doc` (awareness-only), lifecycle-managed (connect on mount, `destroy()` on unmount), connecting to `${WS_BASE}/ws/plans/${planId}?token=...`. Mirrors the connection setup currently in `DecisionPresenceStack` / `useNoteCollaboration`.

Sets local awareness fields and exposes typed peer state:

```ts
type PeerCursor = { x: number; y: number } | null          // flow coordinates
type PeerDrag   = { nodeId: string; x: number; y: number } | null

type Peer = {
  clientId: number      // Yjs awareness client id (identity for the rAF map)
  userId: string
  name: string
  color: string         // collabColorForUser(userId)
  cursor: PeerCursor
  drag: PeerDrag
}

type PlanPresence = {
  peers: Peer[]                                   // SELF EXCLUDED
  setCursor: (pos: { x: number; y: number } | null) => void
  setDrag: (d: PeerDrag) => void
}
```

- Local user field set once: `awareness.setLocalStateField('user', { userId, name, color })`.
- `setCursor` / `setDrag` write `awareness.setLocalStateField('cursor'|'drag', ...)`. **Callers throttle** (see §5); the hook does not throttle internally.
- `peers` derived via `useSyncExternalStore` over `awareness.on('change')`, filtering out `awareness.clientID` (self), reading each remote state's `user`/`cursor`/`drag`.
- Depends on: `WS_BASE` (`wsBase.ts`), JWT token (same source as today), `collabColorForUser`. Nothing else.

### 4.2 `useSmoothedPresence(peers)` — the smoothness engine (new)
`src/features/decisions/collab/useSmoothedPresence.ts`.

Decouples render rate from packet rate. Keeps, per peer clientId, a *rendered* position that eases toward the *latest received target* every animation frame:

```
rendered += (target − rendered) * ALPHA        // ALPHA ≈ 0.25
```

- Single `requestAnimationFrame` loop. Applies the ease to both `cursor` and `drag` targets.
- Returns the same peer list but with **smoothed** `cursor` / `drag` positions.
- **Self-parking:** if no peer has a non-null `cursor` or `drag`, the loop cancels itself (no idle CPU/battery). It restarts when `peers` next reports a live position.
- New peers snap to first target (no ease-in from origin); departed peers (clientId gone) are dropped from the rendered map on the next frame.
- Tuning knobs: `ALPHA` (higher = snappier/lower lag; lower = smoother/more lag).

### 4.3 `PresenceCursors` — overlay render (new)
`src/features/decisions/PresenceCursors.tsx` + `.module.css`.

Pure presentational overlay rendered **inside** the `ReactFlowProvider` (so it can read the viewport). Given smoothed `peers` + `useViewport()` `{ x, y, zoom }`:

- For each peer with a non-null smoothed `cursor`, compute screen position `screenX = flowX * zoom + viewport.x`, `screenY = flowY * zoom + viewport.y`.
- Render an absolutely-positioned, `pointer-events: none` layer covering the pane; each cursor = a small colored SVG pointer + a name pill in the peer's color.
- `transform: translate(screenX, screenY)` — GPU-composited; no layout thrash.
- Peers with `cursor === null` render nothing (off-canvas / mouse left).
- Bear-minimal styling: solid color pill, hairline, no shadow/lift. Uses the peer's `collabColor` for the pointer + pill background; readable text color.

### 4.4 `PlanCanvas` — wiring (modified)
`src/features/decisions/PlanCanvas.tsx`.

**Send side:**
- `onPaneMouseMove` / node mouse-move at the wrapper: `screenToFlowPosition(event)` → **rAF-gated throttle ~50ms** → `setCursor(flowPos)`.
- `onMouseLeave` on the wrapper → `setCursor(null)`.
- `onNodeDrag(event, node)` → same ~50ms throttle → `setDrag({ nodeId: node.id, x: node.position.x, y: node.position.y })`.
- `onNodeDragStop` → existing lock-gated `useMoveSubPlan` / `useMoveOption` PATCH persists final position (unchanged), **then** `setDrag(null)`.

**Receive side (live node-drag):**
- Consume smoothed `peers`; for each peer with a non-null `drag`, `setNodes()` to overwrite that node's `position` with the smoothed value each frame. (Reuses the rAF output; no second loop.)
- When a peer's `drag` clears, the node simply remains at the last smoothed position — which equals the value the peer persisted — so **no snap-back**. A later remount re-reads the identical value from DB. Consistent.
- **Throttle guard:** ignore remote drag updates for a node the *local* user is currently dragging (local drag wins its own gesture).

### 4.5 `DecisionPresenceStack` — modified
Stops owning a provider. Reads `peers` (+ self) from `usePlanPresence` and renders the avatar stack exactly as today. Purely a consumer now.

### 4.6 `PlanDetail` — modified
Wraps the plan view in `<PlanPresenceProvider planId=...>` so the avatar stack and canvas share the one connection. Provider mounts once per plan (aligns with the existing `PlanDetailRoute` keyed-remount-per-plan from Phase 4).

## 5. Smoothness strategy (the core UX requirement)

Awareness packets arrive jittery (variable spacing, occasional drops). Positioning directly from each packet makes cursors/nodes teleport in visible steps. We decouple **receive** from **render**:

1. **Send is rate-limited** to ~20 packets/sec (~50ms rAF-gated throttle), and only on actual movement — keeps the channel light.
2. **Render is 60fps interpolation.** All network jitter lives in the *target*; the *rendered* value is always a smooth ease toward it (`rendered += (target−rendered)*α`). Fast peer moves catch up quickly; jitter is absorbed. Same technique as Figma/n8n cursors.
3. **Cursors** use GPU-composited `transform: translate`. **Nodes** feed the smoothed value into `setNodes` per frame.
4. If it feels laggy → raise `α` or the send rate; if it feels jittery → lower `α`. Single-file tuning.

## 6. Edge cases & guardrails

- **Duplicate identity:** avoided by the single shared connection (§3).
- **Locked plan:** interactivity is lock-gated; locked users can't drag, so no drag broadcast from them. Cursors still broadcast (viewing is allowed).
- **Peer disconnects mid-drag:** awareness removes their state; rAF loop drops that node's target next frame; node rests at last position. No orphaned ghost.
- **Concurrent drag of the same node (2-person):** last-writer-wins visually; the local-drag guard (§4.4) means your own gesture is never overridden mid-drag. Acceptable at current scale.
- **Off-canvas cursor:** `cursor: null` renders nothing.
- **Idle:** rAF loop self-parks when no live positions.
- **Coordinate correctness:** cursors are stored/broadcast in **flow** coordinates and rendered via the live viewport transform, so they stay pinned to the graph through pan/zoom on every client independently of each viewer's zoom.

## 7. Testing

No unit harness for canvas (consistent with P2–P4). **Manual 2-browser smoke** (owed by user):
1. Two browsers, same plan → each sees the other's cursor glide smoothly (no stepping) as it moves; cursor shows correct name + color.
2. Cursor disappears when the peer's mouse leaves the canvas; reappears on re-entry.
3. Peer drags a 안건/선택지 → the other sees it glide in real time; on drop it rests (no snap-back); reload shows the persisted position.
4. Locked plan → no drag from the locked side; cursors still visible.
5. Peer closes tab mid-drag → node rests, no ghost cursor left behind.
6. Pan/zoom on one side does not move the peer's cursor relative to the graph on the other side.
7. Avatar stack still correct (each user appears exactly once — no duplicates).

## 8. Non-goals / follow-ups (logged, not this phase)

- Phase 5b: canvas-pinned comments (V29 migration, backend, persistent overlay).
- Node focus/viewing halo (deferred — cheap add later on the same payload).
- Cursor idle-fade / name-pill auto-hide after N seconds (polish, skip for v1).
- Distributed/cross-instance presence (out of scope; `shared-doc-yjs` lab).

## 9. Aesthetic & conventions

Bear-minimal: solid color, hairlines, no shadow/lift. Lucide icons only (no emoji) if any chrome is added. All UI text Korean. Tokens `--c-*` / `--sp-*` / `--r-*`. Gate is `npm run build`; lint only touched files.
