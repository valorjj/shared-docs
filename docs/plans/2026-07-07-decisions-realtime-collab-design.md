# Real-Time Collaboration on Decisions — Design

> Brainstormed 2026-07-07. Extends real-time collaboration from shared notes (shipped 2026-07-02) to the **Decisions** pillar (Plan → SubPlan → Option → Decision, votes, deadlines, canvas, roadmap board). Decisions is server-authoritative relational data, so this is **not** a Yjs-on-the-data feature — it is a server-originated *change signal* that drives the existing React Query invalidation, plus a Yjs-*awareness* presence layer. The work also introduces a shared collaboration transport seam and retrofits the notes relay onto it, so the app has **one** coherent real-time subsystem rather than several one-off handlers.

## Why Yjs is the wrong tool for the Decisions *data* (and the right tool for presence)

The shipped notes feature uses Yjs because a rich-text document is naturally client-authoritative and benefits from CRDT merge. Decisions data is the opposite: it lives in MariaDB, is written through REST endpoints with optimistic-locking `version` columns, is guarded by `PlanLockGuard`, and is workspace-permission-checked. The server is the single source of truth.

Making that data "real-time" therefore means **telling clients to re-read the truth**, not merging a second copy of it on the client. Pushing serialized entity deltas or CRDT-merging structured rows would introduce a second source of truth, per-mutation cache surgery, and permanent version-reconciliation risk — to save one refetch on a small, low-frequency app. That is the long-term-wrong trade, not the minimal one.

Presence (who is here, and later cursors / live canvas-drag) *is* ephemeral, client-originated, high-frequency state — exactly what Yjs **awareness** is for. So presence rides a real awareness channel, which also means live cursors and canvas-drag become incremental additions to the same connection later, not a new subsystem.

## Decisions locked (brainstorm 2026-07-07)

1. **Mechanism: invalidate + refetch, server-originated signal.** On every Decisions write, after the DB transaction commits, the server broadcasts a small `{planId}` signal to all clients in the workspace. Each client runs the *same* `qc.invalidateQueries(decisionKeys.scope(wsId))` it already runs locally; React Query refetches. No entity deltas, no client-side merge, no new source of truth.
2. **Presence: Yjs awareness, no shared document.** Presence is an awareness-only Yjs channel per plan (empty `Y.Doc`), reusing the notes machinery. Chosen specifically so deferred live cursors / canvas-drag are extra awareness fields on this connection later, not a rewrite.
3. **Transport seam now, distributed fan-out later (and elsewhere).** Introduce a `CollabRoomRegistry` / broadcaster abstraction; build Decisions on it **and retrofit the notes relay onto it**, giving one real-time layer behind one interface. The in-memory single-instance implementation ships here; the cross-instance (Redis/broker + LB) implementation is deliberately **not** built in this app — it is the job of the separate `shared-doc-yjs` scaling lab. Rationale: a small-group app may never get a second instance; the mature move is to make multi-instance a one-class change, not to run infrastructure nobody needs. "Designed behind a broadcaster interface so multi-instance is a drop-in" is a stronger portfolio claim than operating two backends.
4. **The socket is a hint, never a guarantee.** Every connect and reconnect triggers one invalidation-refetch. A dropped signal, a lost frame, or a backend restart (routine on every CD deploy) leaves a client stale only until its next event or reconnect — the system converges with no message-ordering or replay guarantees required. This is what makes "invalidate + refetch" robust rather than fragile.
5. **Conflict handling unchanged.** Concurrent edits to the same entity hit the existing optimistic-lock `version` → 409 path. Live sync *reduces* 409s (peers usually refetch the new version before they save). No new merge logic — text-CRDT-merging an option title is out of scope by design.
6. **Scope: data sync + presence. Live canvas-drag deferred.** Streaming React Flow node positions live is a separate high-frequency ephemeral stream; the awareness channel is built to host it, but it is not in this project.

## Why this shape

- **Why the seam pays for itself immediately:** the notes relay and Decisions presence turn out to be the *same thing* — a protocol-blind binary Yjs relay, per room. The retrofit is not "wrap old code"; it is generalizing one handler + one registry and registering it at two paths. This is *less* code than three bespoke single-instance handlers.
- **Why AFTER_COMMIT:** `@TransactionalEventListener(phase = AFTER_COMMIT)` fires only if the write actually committed, so a rolled-back mutation never broadcasts a phantom change.
- **Why coarse (workspace-wide) invalidation is fine:** every Decisions query key is `['decisions', wsId, …]` and nearly every mutation already invalidates the single root `decisionKeys.scope(wsId)`. Workspaces are small by design (Notion-scale is on VISION.md's not-list), so a whole-subtree refetch on each change is bounded by product design, not a lurking scale problem.

---

## Backend (`shared-docs-backend`)

### New shared package `com.shareddocs.backend.collab` (promoted from `note.collab`)

- **`CollabRoomRegistry`** — generic room registry: `ConcurrentHashMap<RoomKey, CopyOnWriteArraySet<WebSocketSession>>` with `join` / `leave` (empty rooms evicted) / `broadcast(room, message, exceptSessionId?)`. In-memory, single-instance. This is the seam: a future distributed implementation swaps only this class. `RoomKey` is a value type wrapping the discriminator (`note:{id}` / `plan:{id}` / `ws:{id}`) so one registry can host all channels without key collisions.
- **`BlindRelayHandler`** (`BinaryWebSocketHandler`) — generic protocol-blind relay: on binary message → `registry.broadcast(room, message, sender)`. Room key read from session attributes set by the handshake. Used by both the notes and plan-presence endpoints; it never decodes Yjs.
- **`JwtQueryTokenInterceptor`** (`HandshakeInterceptor`) — shared: extracts `token` query param, validates via `JwtProvider`, stashes `userId`. Delegates the resource permission check to a per-endpoint `CollabAccessPredicate` (functional interface). Rejects 400 (missing room id) / 401 (bad/absent token) / 403 (access denied) before the upgrade — same contract the notes interceptor already has.

### Notes retrofit (behavior-preserving)

- `NoteCollaborationHandler` / `NoteCollabRoomRegistry` are replaced by `BlindRelayHandler` + `CollabRoomRegistry` (room `note:{noteId}`) and a `CollabAccessPredicate` wrapping the existing `NoteCollabAccessService.canCollaborate`. `WebSocketConfig` registers it at `/ws/notes/{noteId}` with `JwtQueryTokenInterceptor`.
- `NoteService`'s force-close on flip-to-PRIVATE / soft-delete calls the generic registry's `closeRoom(note:{id}, exceptUserId?)`.
- **Risk control:** this touches shipped, working code. The existing notes collab tests must pass unchanged (before/after parity), and the manual notes smoke checks from the 2026-07-02 plan are re-run.

### Decisions presence — `/ws/plans/{planId}`

- Registered with `BlindRelayHandler` (room `plan:{planId}`) + `JwtQueryTokenInterceptor` + a predicate = active membership of the plan's workspace (resolve plan → `workspaceId`, then `WorkspaceService.isActiveMember`). Awareness-only; the server never needs a `Y.Doc`.

### Decisions change signal — `/ws/decisions/{workspaceId}`

- **`DecisionsSignalHandler`** (`TextWebSocketHandler`) — server-originated only. Clients connect and listen; they send nothing but optional heartbeats. On connect → `registry.join(ws:{workspaceId}, session)`.
- **`DecisionChangePublisher`** — thin bean; write service methods call `publish(workspaceId, planId?)` after their mutation. Publishes a Spring application event `DecisionsChanged(workspaceId, planId?)`.
- **`DecisionsChangeListener`** — `@TransactionalEventListener(phase = AFTER_COMMIT)` → `registry.broadcast(ws:{workspaceId}, json{"planId":N})`.
- **Publisher wiring — every write path:** `PlanService` (create/update/discard/restore/deleteForever/addSubPlan/reorderSubPlans/lock/unlock/complete/uncomplete/setPlanDeadline/clearPlanDeadline/ensureDiscussionNote), `SubPlan` writes (update incl. canvasX/Y, delete, deadline set/clear, addOption), `OptionController` services (update/delete), `VoteService` (cast/retract), `RatingService` (upsert/delete), `DecisionService` (lock/reopen), `EdgeService` (create/delete). The five with **no** `PlanEvent` (votes, ratings, edges, reorder, canvas-drag) are the easy-to-forget ones and get explicit attention.
- **`useMoveSubPlan` / canvas-drag `PATCH` is deliberately excluded** from the signal (it is fire-and-forget with no invalidation today; live drag is out of scope, so it stays silent — otherwise every drag frame would trigger a workspace-wide refetch).

### Connection topology (recorded decision)

A client on `PlanDetail` holds **two** Decisions sockets: `/ws/decisions/{workspaceId}` (change signal) and `/ws/plans/{planId}` (presence). They are kept separate rather than merged into one workspace room because they carry different things at different scopes and over different transports (server-originated JSON vs. blind client awareness relay). Folding the server-originated signal into the blind awareness relay would break the relay's "blind" property (the server would have to originate Yjs frames and hold a `Y.Doc`). A client on the board (`/decisions`, no open plan) holds only the change-signal socket.

---

## Frontend (`shared-docs`)

- **`useDecisionsChangeFeed(workspaceId)`** (new hook) — opens `/ws/decisions/{wsId}?token=…` (URL built like `useNoteCollaboration`: `VITE_WS_BASE_URL` / http→ws swap). On a `"changed"` frame → `qc.invalidateQueries(decisionKeys.scope(wsId))` (optionally narrowed to `tree(planId)` when the frame's `planId` matches the open plan). **On connect and every reconnect → one invalidation** (decision #4). Reconnect with backoff.
- **`usePlanPresence(planId)`** (new hook) — mirrors `useNoteCollaboration`: a `Y.Doc` + `WebsocketProvider` to `/ws/plans/{planId}`, awareness only. Sets local awareness `{name, color, pictureUrl}` (`color` from the existing `collabColorForUser`). Exposes the peer roster (excludes self, like `CollabAvatarStack`).
- **`DecisionPresenceStack`** (new, tiny) — avatar stack of peers on the current plan, reusing the notes `CollabAvatarStack` visual language (bordered avatars, first-char fallback, deterministic color). Rendered in `PlanDetail`'s sticky control strip.
- **Mount point:** `useDecisionsChangeFeed` mounts once in a `DecisionsLayout` (or the existing shared parent of `/decisions` and `/decisions/:planId`) so the board and an open plan both stay live; `usePlanPresence` mounts in `PlanDetail`, keyed by `planId`.
- **No existing mutation changes.** They already invalidate `scope(wsId)`; the socket only makes *other* clients do the same. The entire live-update behavior falls out of the existing invalidation path.

### Optional fold-in (severable — decide at plan time)

**Discussion-note collaboration.** `DiscussionPane`'s `EditorSection` currently renders `NoteEditorBody` with no `collab` prop, so the plan discussion note is not collaborative. Wiring `useNoteCollaboration(note.id, note.visibility === 'WORKSPACE')` into it (and rendering `CollabAvatarStack`) makes it live — reusing the shipped notes mechanism verbatim. Kept as a clearly-separable final task because it is a distinct Yjs-text mechanism, not part of the structured-data sync.

---

## Scope

### In scope
Server-originated change signal driving existing invalidation for **all** Decisions writes; Yjs-awareness presence per plan; presence avatar stack; refetch-on-connect/reconnect self-healing; membership-gated handshakes; the `CollabRoomRegistry` / `BlindRelayHandler` / `JwtQueryTokenInterceptor` seam; notes-relay retrofit onto the seam.

### Explicitly out of scope (YAGNI)
- **Live canvas node-drag / cursors** — the awareness channel is built to host it; not this project.
- **Push-the-payload / entity-delta sync** — invalidation + refetch is the deliberate mechanism.
- **Cross-instance fan-out (Redis/broker + LB)** — belongs in the `shared-doc-yjs` scaling lab; here we ship the seam + in-memory impl only.
- **Per-entity granular invalidation** — coarse `scope(wsId)` is correct for small workspaces.
- **Persisted presence / history, read-only viewer presence** — same posture as notes.
- **New conflict/merge logic** — optimistic-lock 409 stays.

---

## Testing

### Backend
- **Handshake (both endpoints):** reject no-token / bad-token (401); reject non-member (403); accept active member. Plan-presence resolves plan → workspace correctly (reject a member of a *different* workspace).
- **AFTER_COMMIT semantics:** a committed write broadcasts exactly once; a write that throws / rolls back broadcasts nothing (transactional test).
- **Registry:** change frame reaches every session in the room, blind relay excludes the sender, no cross-room / cross-workspace leakage; session removed on close; empty room evicted; `RoomKey` discriminator prevents `note:1` / `plan:1` / `ws:1` collisions.
- **Publisher coverage:** a parametrized test asserting each Decisions write endpoint produces exactly one `DecisionsChanged` — the guard against a forgotten `publish()` on votes/ratings/edges/reorder.
- **Notes retrofit parity:** all existing notes-collab tests pass unchanged.

### Frontend
- `useDecisionsChangeFeed`: `"changed"` frame → `invalidateQueries(scope(wsId))`; planId-scoped narrowing; **invalidate on connect and on reconnect**; disconnect on unmount.
- `usePlanPresence`: awareness announce on mount + on `planId` change; roster excludes self; teardown on unmount.
- `tsc -b --noEmit` clean; `eslint src/features/decisions` and `src/features/notes` 0 new errors; `npm run build` succeeds.

### Manual smoke (two accounts, same workspace)
- A adds an 안건 / option → appears on B without refresh. A casts / moves / retracts a vote → tally updates on B. A confirms a 결정 → B sees it lock. A sets a deadline / locks / completes a plan → reflected on B. A creates a plan while B is on `/decisions` → board updates.
- Presence: B opens the plan → B's avatar appears for A; B navigates away → avatar drops.
- Kill the backend mid-session → clients reconnect and the connect-refetch catches any change missed while down.
- A non-member cannot open either socket.
- **Notes regression:** re-run the 2026-07-02 notes manual smoke checks (two-account concurrent edit, cursors, reconnect, flip-to-PRIVATE kick, soft-delete) — the retrofit must not regress them.

---

## Long-term note (for ROADMAP/CLAUDE.md when shipped)

This establishes the app's real-time layer as a single seam (`CollabRoomRegistry` + `BlindRelayHandler` + `JwtQueryTokenInterceptor`) shared by notes and Decisions. Two follow-ons are pre-seamed but deliberately deferred: (a) live canvas-drag / cursors on the plan-presence awareness channel; (b) cross-instance fan-out behind the registry interface, proven first in the `shared-doc-yjs` scaling lab before it ever lands here.
