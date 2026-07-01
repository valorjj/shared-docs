# Real-Time Collaborative Editing on Shared Notes — Design

> Brainstormed 2026-07-02. The last unbuilt post-v2 direction from VISION.md ("presence on shared notes") turned out to require reversing a stated design rule — this doc is that reversal, made deliberately. Adds live cursors + live concurrent editing (Yjs CRDT) to shared (WORKSPACE-visibility) notes. Decisions discussion notes reuse the same editor component and are an explicit fast-follow, not v1 scope.

## What changed from the original "presence" framing

VISION.md originally described this as "Tiptap awareness — partner's avatar + cursor color... no real-time editing (last-write-wins remains)." That framing turns out to be technically unstable: live cursor *position* only stays meaningful if both viewers' documents are the same document, which requires syncing content, not just cursor metadata. Tiptap's `CollaborationCursor` extension is built on top of `Collaboration` (a Yjs-backed doc) and doesn't work standalone.

So this design ships full real-time collaborative editing (concurrent edits merge live via Yjs's CRDT) with cursors as one part of it — not a cursor-only cosmetic layer. **VISION.md §6 is amended**: "❌ Not a real-time CRDT editor" is replaced with real-time collaborative editing on shared notes, scoped as described below.

## Decisions locked (brainstorm 2026-07-02)

1. **Scope: shared notes only for v1.** Pillar 2 (WORKSPACE-visibility) notes. PRIVATE notes are naturally excluded — only the author ever opens them, nothing to co-edit. Decisions discussion notes reuse `NoteEditorBody`, so extending to them later is close to free — deferred deliberately to keep v1 reviewable.
2. **Persistence: ephemeral Yjs, snapshot to existing storage.** The `Y.Doc` lives only in memory for the life of an active session (browser tabs + relay). `Note.body` keeps its current format and save path (debounced `PATCH` from `editor.getHTML()`) unchanged. No new DB columns, no permanent Yjs binary state, no migration — search indexing, `EntityLink` chips, and everything else downstream of `Note.body` is unaffected.
3. **Transport: Spring WebSocket, protocol-blind relay.** One new endpoint groups connections by `noteId` and forwards raw binary frames between them. It never decodes Yjs — the CRDT merge happens client-side in each browser's `Y.Doc`, so a dumb relay provides the exact same correctness guarantee a smart one would. No new runtime/language; fits the existing Kotlin/Spring/Docker deploy as-is.
4. **Auth: reuse existing note-permission checks at WS handshake.** JWT passed as a query param (browsers can't set WS handshake headers), validated by a `HandshakeInterceptor` that calls the same permission check the REST `NoteController` already applies. No parallel permission model.

## Why this shape

- **Why not keep it cursor-only:** as covered above, `CollaborationCursor` requires `Collaboration` underneath it. Trying to sync only cursor position without doc content would mean cursors silently drift or misplace the moment two people's copies diverge even slightly — not a viable cosmetic-only feature.
- **Why ephemeral persistence, not storing Yjs state as source of truth:** the app's usage pattern (2–10 people, low edit frequency) doesn't need full offline-merge-across-devices or CRDT edit history. Keeping `Note.body`'s format unchanged means zero migration risk and zero changes to every other feature that reads note content (search, entity chips, attachments).
- **Why a blind relay instead of the y-websocket reference server:** the reference server is a Node.js process — a second runtime/language to operate on a single self-hosted Mac Mini for an otherwise all-Kotlin backend. A blind relay is ~100 lines of Spring code and provides identical guarantees, because Yjs is specifically designed so the server never needs to participate in merge logic, only delivery. The npm `y-websocket` **client** library (`WebsocketProvider`) works unmodified against it.

---

## Backend (`shared-docs-backend`)

### New dependency

`spring-boot-starter-websocket` — first WebSocket usage in this codebase.

### `NoteCollaborationHandler` (new) — `BinaryWebSocketHandler`

- Endpoint: `/ws/notes/{noteId}`.
- In-memory room registry: `ConcurrentHashMap<Long, CopyOnWriteArraySet<WebSocketSession>>`, singleton bean. Single backend instance (Mac Mini) — no cross-instance broadcast needed.
- On binary message: forward the raw payload to every other session in the same `noteId` room. Never deserializes Yjs content.
- On session close: remove from its room's set; if the set is now empty, remove the `noteId` entry from the map (bounded memory over the server's lifetime).
- Force-close all sessions in a room (except the author's) when the note's visibility flips to `PRIVATE`, or when the note is soft-deleted — checked on each relayed message or a lightweight periodic sweep.

### `NoteCollabHandshakeInterceptor` (new) — `HandshakeInterceptor`

- Reads `token` from the WS handshake query string, validates it via the existing `JwtProvider`.
- Reuses the existing note-permission check from `NoteService` (workspace membership with edit access, or a cross-workspace `ResourceShare` with `EDIT` permission) — the same rule the REST `PATCH /api/notes/{id}` endpoint already enforces.
- Rejects the handshake (HTTP 403, before upgrade) if the caller can't currently edit the note via the REST API. No separate permission model to maintain.

### `WebSocketConfig` (new)

Registers `NoteCollaborationHandler` at `/ws/notes/{noteId}` with `NoteCollabHandshakeInterceptor`.

---

## Frontend (`shared-docs`)

### `useNoteCollaboration(noteId)` (new hook)

Owns the `Y.Doc` + `WebsocketProvider` lifecycle for one note:

- **Mount:** create a `Y.Doc`; connect `WebsocketProvider` to `/ws/notes/{noteId}?token=...`. If no peer answers the initial sync-step-1 request within a short timeout (nobody else is currently in the note), seed the `Y.Doc` from the note's existing `body` — converted into the Y-XML fragment `Collaboration` expects. If a peer *does* answer, discard the local seed and take their state (they already reflect any changes since the note was last saved by someone else, unlikely for one active session but avoids ever regressing content).
- **Identity:** `name` + `pictureUrl` from `useAuth()`'s `AuthUser`. Color is a deterministic hash of `userId` into a small fixed palette (same person → same color, not randomized per session).
- **Unmount:** flush a final save (existing debounce-save effect fires from current `editor.getHTML()`), then disconnect the provider and destroy the `Y.Doc`.
- **Reconnection:** handled by `WebsocketProvider`'s built-in backoff. While disconnected, the editor keeps working against the local `Y.Doc` exactly as if alone in the note (autosave via REST unaffected); resyncs automatically on reconnect. A full backend restart mid-session (routine on every CD deploy) is just a disconnect-then-reconnect from the client's point of view — no special-casing needed.

### `NoteEditorBody.tsx` (`useEditor()`, ~line 118–210)

Two new extensions added when the note is WORKSPACE-visibility (skipped for PRIVATE notes — nothing to sync):

```ts
Collaboration.configure({ document: yDoc }),
CollaborationCursor.configure({ provider, user: { name, color } }),
```

`Collaboration` keeps a normal ProseMirror doc underneath, so `editor.getHTML()` / the existing debounced autosave effect need no changes at all.

### Visuals

- Partner's cursor: thin colored caret + small name label, styled to match the hairline/no-shadow Bear aesthetic — no bubble, no shadow, matching [`docs/DESIGN.md`](DESIGN.md).
- Avatar stack in the editor header showing everyone currently in the note, reusing `pictureUrl` already available on `AuthUser`/`WorkspaceMember`.

---

## Scope

### In scope
Live cursors + live concurrent editing on shared (WORKSPACE) notes; deterministic per-user cursor color; graceful reconnect on disconnect; forced session close on visibility-flip-to-PRIVATE or soft-delete.

### Explicitly out of scope (YAGNI)
- **Decisions discussion notes** — same editor component, deliberate fast-follow once v1 is verified in the wild, not bundled in to keep this review scoped.
- **Persisted Yjs state / edit history** — ephemeral-only per decision #2 above; revisit only if a real need for offline multi-device merge or edit history emerges.
- **Sheets, or any other editable surface** — not part of "shared notes."
- **WS-specific rate limiting / abuse hardening** — deferred to the same bucket as the already-deferred Cloudflare edge-rules item; low incentive given real Google-account-gated small groups.
- **Read-only viewers seeing live cursors without edit access** — anyone who can't edit via REST can't join the room at all; no separate view-only presence tier.

---

## Testing

### Backend
- Handshake auth: reject no-token, reject non-member, reject PRIVATE-note non-author, accept valid EDIT access (workspace member or `ResourceShare`).
- Relay forwarding: message from session A reaches session B in the same room, not A itself, not sessions in other rooms.
- Room lifecycle: session removed on close; empty room removed from the registry map.
- Forced close on visibility-flip-to-PRIVATE and on soft-delete.

### Frontend
- `useNoteCollaboration`: deterministic color-per-`userId`; seed-from-`Note.body` only when no peer responds to sync; disconnect + flush-save on unmount.
- Same-process integration test simulating two `Y.Doc`s exchanging updates directly (Yjs sync is pure in-memory logic, no real WebSocket needed) — assert concurrent edits converge to the same merged `getHTML()` output on both sides.
- `npx tsc -b --noEmit` clean; `npx eslint src/features/notes` 0 new errors; `npm run build` succeeds.

### Manual smoke checks
Two accounts in the same note typing in different spots at once (no data loss, both edits land); colored cursors distinct and correctly labeled; kill the backend mid-session and confirm auto-reconnect + resync; flip a note to PRIVATE while a second viewer has it open and confirm they're kicked out; soft-delete a note while someone else is viewing it and confirm they see the existing "note not found" state.

---

## VISION.md amendment

§6 "What this is NOT" — remove "❌ Not a real-time CRDT editor. Last-write-wins for the foreseeable future; presence (avatar + cursor) only," replace with a dated note (matching the doc's existing convention of documenting direction reversals) explaining real-time collaborative editing now exists on shared notes, scoped to ephemeral session sync with no permanent CRDT history — persistence is still a plain saved snapshot, not a fundamentally different storage model.
