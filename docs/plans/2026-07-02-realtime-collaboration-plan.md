# Real-Time Collaborative Editing on Shared Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real-time collaborative editing (Yjs CRDT) on shared (WORKSPACE-visibility) notes, including live colored cursors and an avatar stack of who's currently viewing — first fixing a prerequisite permission gap where non-authors currently cannot edit shared notes at all.

**Architecture:** A protocol-blind Spring `BinaryWebSocketHandler` relay (`/ws/notes/{noteId}`) forwards raw Yjs frames between browsers in the same note's room; the CRDT merge happens entirely client-side in each browser's `Y.Doc`. Persistence is untouched — `Collaboration` keeps a normal ProseMirror doc underneath, so the existing debounced `PATCH` autosave path needs no changes. Full design/rationale: [`docs/plans/2026-07-02-realtime-collaboration-design.md`](2026-07-02-realtime-collaboration-design.md).

**Tech Stack:** Backend: Spring Boot 3.5.3, Kotlin 1.9.25, Java 17, `spring-boot-starter-websocket` (new). Frontend: React 19.2.4, Tiptap 3.23.4, `yjs` + `y-websocket` + `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-cursor` (new).

## Global Constraints

- Backend package root: `com.shareddocs.backend`. New collaboration code lives under `com.shareddocs.backend.note.collab`.
- Backend tests: JUnit 5, `@SpringBootTest`, `@ActiveProfiles("test")`, direct service/controller calls (no MockMvc) — matches `NoteWorkspaceIsolationTest.kt` / `NoteShareControllerTest.kt`. Run via `./gradlew test`.
- Frontend has **no test runner** (no Jest/Vitest in `package.json` — confirmed absent). Frontend tasks are verified via `npx tsc -b --noEmit` + `npx eslint <touched path>` + the final manual smoke-test task (Task 11), not automated tests. Do **not** introduce a new test framework as a side effect of this plan — that's an unrelated, unrequested change (YAGNI, matches this codebase's existing convention).
- `npm run build` (`tsc -b && vite build`) is the authoritative frontend gate per this project's CLAUDE.md.
- CSS Modules only, no Tailwind, no hardcoded hex outside the deterministic color palette (which is inherently a fixed list of colors, not a token — see Task 7).
- All new user-facing strings are in Korean (project rule: no English chrome).
- Commit after every task.

---

### Task 1: Fix note write permission for workspace members

Today `NoteService.update()` is author-only for every note, including WORKSPACE-visibility ones — this means nobody but the author can ever write to a shared note, which would leave real-time collaboration with no one to collaborate with. This task fixes that gap: any active workspace member may edit a WORKSPACE note's title/body/pinned; PRIVATE notes and visibility changes stay author-only.

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/NoteService.kt:112-127`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/note/NoteEditPermissionTest.kt` (create)

**Interfaces:**
- Produces: `NoteService.update(id: Long, req: UpdateNoteRequest, workspaceId: Long, callerUserId: Long): NoteResponse` — signature unchanged, only internal permission logic changes. Later tasks don't depend on new signatures here.

- [ ] **Step 1: Write the failing tests**

```kotlin
package com.shareddocs.backend.note

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NoteEditPermissionTest(
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun user(): User = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    @Test
    fun `a non-author workspace member can edit a WORKSPACE note's body`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val member = user()
        workspaces.joinAsMember(ws.id!!, member.id!!)
        val note = noteService.create(
            CreateNoteRequest(body = "<p>original</p>", visibility = Visibility.WORKSPACE),
            ws.id!!,
            owner.id!!,
        )

        val updated = noteService.update(
            note.id,
            UpdateNoteRequest(body = "<p>edited by member</p>"),
            ws.id!!,
            member.id!!,
        )

        assertEquals("<p>edited by member</p>", updated.body)
    }

    @Test
    fun `a non-author cannot edit a PRIVATE note`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W2", "w2-${UUID.randomUUID().toString().take(8)}")
        val member = user()
        workspaces.joinAsMember(ws.id!!, member.id!!)
        val note = noteService.create(
            CreateNoteRequest(body = "<p>secret</p>", visibility = Visibility.PRIVATE),
            ws.id!!,
            owner.id!!,
        )

        val ex = assertThrows(ResponseStatusException::class.java) {
            noteService.update(note.id, UpdateNoteRequest(body = "<p>tampered</p>"), ws.id!!, member.id!!)
        }
        assertEquals(403, ex.statusCode.value())
    }

    @Test
    fun `a non-author cannot change a WORKSPACE note's visibility`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W3", "w3-${UUID.randomUUID().toString().take(8)}")
        val member = user()
        workspaces.joinAsMember(ws.id!!, member.id!!)
        val note = noteService.create(
            CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE),
            ws.id!!,
            owner.id!!,
        )

        val ex = assertThrows(ResponseStatusException::class.java) {
            noteService.update(note.id, UpdateNoteRequest(visibility = Visibility.PRIVATE), ws.id!!, member.id!!)
        }
        assertEquals(403, ex.statusCode.value())
    }

    @Test
    fun `the author can still change visibility`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W4", "w4-${UUID.randomUUID().toString().take(8)}")
        val note = noteService.create(
            CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE),
            ws.id!!,
            owner.id!!,
        )

        val updated = noteService.update(note.id, UpdateNoteRequest(visibility = Visibility.PRIVATE), ws.id!!, owner.id!!)

        assertEquals(Visibility.PRIVATE, updated.visibility)
    }
}
```

- [ ] **Step 2: Run tests to verify the first three fail**

Run: `./gradlew test --tests "com.shareddocs.backend.note.NoteEditPermissionTest"`
Expected: `a non-author workspace member can edit a WORKSPACE note's body` FAILS (currently throws 403 for everyone but the author); the other three currently pass (they already match today's author-only behavior) — that's expected, only the first case is red.

- [ ] **Step 3: Fix the permission check**

Replace lines 112–127 of `NoteService.kt`:

```kotlin
    fun update(id: Long, req: UpdateNoteRequest, workspaceId: Long, callerUserId: Long): NoteResponse {
        val note = repository.findByIdAndWorkspaceIdAndDeletedAtIsNull(id, workspaceId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "note $id") }
        val isAuthor = note.createdBy.id == callerUserId
        // PRIVATE notes are author-only for every field — the workspaceId scoping
        // (already membership-validated by WorkspaceContextFilter before this
        // method runs) is not enough on its own since PRIVATE means "only the
        // author", not "only this workspace". WORKSPACE notes are editable by any
        // active member of this workspace for title/body/pinned; changing
        // visibility itself is a structural/ownership action reserved to the author.
        if (note.visibility == Visibility.PRIVATE && !isAuthor) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit")
        }
        if (req.visibility != null && !isAuthor) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can change visibility")
        }
        req.title?.let { note.title = it.trim().takeIf { s -> s.isNotEmpty() } }
        val bodyChanged = req.body != null && req.body != note.body
        req.body?.let { note.body = it }
        req.pinned?.let { note.pinned = it }
        req.visibility?.let { note.visibility = it }
        if (bodyChanged) indexer.reindex(note.id!!, workspaceId, note.body)
        return NoteResponse.from(note)
    }
```

- [ ] **Step 4: Run tests to verify all four pass**

Run: `./gradlew test --tests "com.shareddocs.backend.note.NoteEditPermissionTest"`
Expected: PASS (4/4)

- [ ] **Step 5: Run the full note test suite to check for regressions**

Run: `./gradlew test --tests "com.shareddocs.backend.note.*"`
Expected: PASS, including `NoteWorkspaceIsolationTest`

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/NoteService.kt src/test/kotlin/com/shareddocs/backend/note/NoteEditPermissionTest.kt
git commit -m "fix(notes): allow any workspace member to edit a WORKSPACE note

Author-only was blocking the shared-notebook pillar's own premise —
nobody but the creator could ever write to a note, even a
WORKSPACE-visibility one. PRIVATE notes and visibility changes stay
author-only; this is the prerequisite for real-time collaboration,
which needs a second person able to edit at all."
```

---

### Task 2: NoteCollabAccessService — who can join a note's live session

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabAccessService.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollabAccessServiceTest.kt`

**Interfaces:**
- Consumes: `NoteRepository.findById(id: Long): Optional<Note>` (standard `JpaRepository`), `Note.deletedAt: Instant?`, `Note.visibility: Visibility`, `Note.workspaceId: Long`; `WorkspaceService.isActiveMember(workspaceId: Long, userId: Long): Boolean`; `ShareService.resolveNotePermission(noteId: Long, userId: Long): SharePermission?`.
- Produces: `NoteCollabAccessService.canCollaborate(noteId: Long, userId: Long): Boolean` — consumed by Task 4's handshake interceptor.

- [ ] **Step 1: Write the failing tests**

```kotlin
package com.shareddocs.backend.note.collab

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.share.GrantShareRequest
import com.shareddocs.backend.share.NoteShareController
import com.shareddocs.backend.share.SharePermission
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NoteCollabAccessServiceTest(
    @Autowired private val access: NoteCollabAccessService,
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val shareController: NoteShareController,
) {
    private fun user(): User = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    @Test
    fun `workspace member can collaborate on a WORKSPACE note`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val member = user()
        workspaces.joinAsMember(ws.id!!, member.id!!)
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        assertTrue(access.canCollaborate(note.id, member.id!!))
    }

    @Test
    fun `a stranger with no membership and no share cannot collaborate`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W2", "w2-${UUID.randomUUID().toString().take(8)}")
        val stranger = user()
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        assertFalse(access.canCollaborate(note.id, stranger.id!!))
    }

    @Test
    fun `PRIVATE notes are excluded from collaboration even for the author`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W3", "w3-${UUID.randomUUID().toString().take(8)}")
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.PRIVATE), ws.id!!, owner.id!!)

        assertFalse(access.canCollaborate(note.id, owner.id!!))
    }

    @Test
    fun `cross-workspace EDIT share grants collaboration access`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W4", "w4-${UUID.randomUUID().toString().take(8)}")
        val recipient = user()
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)
        val principal = AppPrincipal(owner.id!!, owner.email, owner.name, null, Role.USER)
        shareController.grant(note.id, ws, principal, GrantShareRequest(recipient.email, SharePermission.EDIT))

        assertTrue(access.canCollaborate(note.id, recipient.id!!))
    }

    @Test
    fun `cross-workspace VIEW-only share does not grant collaboration access`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W5", "w5-${UUID.randomUUID().toString().take(8)}")
        val recipient = user()
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)
        val principal = AppPrincipal(owner.id!!, owner.email, owner.name, null, Role.USER)
        shareController.grant(note.id, ws, principal, GrantShareRequest(recipient.email, SharePermission.VIEW))

        assertFalse(access.canCollaborate(note.id, recipient.id!!))
    }

    @Test
    fun `a non-existent note cannot be collaborated on`() {
        assertFalse(access.canCollaborate(999_999_999L, user().id!!))
    }
}
```

- [ ] **Step 2: Run tests to verify they fail to compile (class doesn't exist yet)**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollabAccessServiceTest"`
Expected: FAIL — compilation error, `NoteCollabAccessService` is unresolved.

- [ ] **Step 3: Implement `NoteCollabAccessService`**

```kotlin
package com.shareddocs.backend.note.collab

import com.shareddocs.backend.note.NoteRepository
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.share.ShareService
import com.shareddocs.backend.share.SharePermission
import com.shareddocs.backend.workspace.WorkspaceService
import org.springframework.stereotype.Service

/**
 * Gate for joining a note's live collaboration room — reused by the WebSocket
 * handshake (Task 4), which has no equivalent to WorkspaceContextFilter's
 * header-based membership check since browsers can't set custom headers on a
 * WS handshake. PRIVATE notes are excluded entirely (v1 scope: only
 * WORKSPACE-visibility notes support live co-editing — nothing to sync for a
 * note only one person can ever see).
 */
@Service
class NoteCollabAccessService(
    private val noteRepository: NoteRepository,
    private val workspaceService: WorkspaceService,
    private val shareService: ShareService,
) {
    fun canCollaborate(noteId: Long, userId: Long): Boolean {
        val note = noteRepository.findById(noteId).orElse(null) ?: return false
        if (note.deletedAt != null) return false
        if (note.visibility != Visibility.WORKSPACE) return false
        if (workspaceService.isActiveMember(note.workspaceId, userId)) return true
        return shareService.resolveNotePermission(noteId, userId) == SharePermission.EDIT
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollabAccessServiceTest"`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabAccessService.kt src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollabAccessServiceTest.kt
git commit -m "feat(notes): NoteCollabAccessService gates who can join a note's live session"
```

---

### Task 3: NoteCollabRoomRegistry — in-memory room relay

**Files:**
- Modify: `shared-docs-backend/build.gradle.kts` (add `spring-boot-starter-websocket`)
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabRoomRegistry.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollabRoomRegistryTest.kt`

**Interfaces:**
- Produces: `NoteCollabRoomRegistry.join(noteId: Long, session: WebSocketSession)`, `.leave(noteId: Long, session: WebSocketSession)`, `.relay(noteId: Long, sender: WebSocketSession, message: BinaryMessage)`, `.closeRoom(noteId: Long, exceptUserId: Long?)`. Consumed by Task 4's handler and Task 5's `NoteService` wiring. Session identity: every session's `attributes["userId"]` is a `Long` set by Task 4's handshake interceptor — `closeRoom` reads this to spare one user's session.

- [ ] **Step 1: Add the WebSocket dependency**

In `build.gradle.kts`, add to the `dependencies { }` block, alongside the other `implementation("org.springframework.boot:spring-boot-starter-*")` lines:

```gradle
    implementation("org.springframework.boot:spring-boot-starter-websocket")
```

- [ ] **Step 2: Write the failing tests**

```kotlin
package com.shareddocs.backend.note.collab

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession

class NoteCollabRoomRegistryTest {
    private val registry = NoteCollabRoomRegistry()

    private fun fakeSession(id: String, userId: Long): WebSocketSession {
        val session = mock(WebSocketSession::class.java)
        `when`(session.id).thenReturn(id)
        `when`(session.isOpen).thenReturn(true)
        `when`(session.attributes).thenReturn(mutableMapOf("userId" to userId))
        return session
    }

    @Test
    fun `relay forwards to other sessions in the room but not the sender`() {
        val a = fakeSession("a", 1L)
        val b = fakeSession("b", 2L)
        registry.join(1L, a)
        registry.join(1L, b)
        val message = BinaryMessage("hi".toByteArray())

        registry.relay(1L, a, message)

        verify(b).sendMessage(message)
        verify(a, never()).sendMessage(any())
    }

    @Test
    fun `relay does not cross rooms`() {
        val a = fakeSession("a", 1L)
        val c = fakeSession("c", 3L)
        registry.join(1L, a)
        registry.join(2L, c)

        registry.relay(1L, a, BinaryMessage("hi".toByteArray()))

        verify(c, never()).sendMessage(any())
    }

    @Test
    fun `leave removes the session so it no longer receives relays`() {
        val a = fakeSession("a", 1L)
        val b = fakeSession("b", 2L)
        registry.join(1L, a)
        registry.join(1L, b)
        registry.leave(1L, b)

        registry.relay(1L, a, BinaryMessage("hi".toByteArray()))

        verify(b, never()).sendMessage(any())
    }

    @Test
    fun `closeRoom closes every session except the given user`() {
        val a = fakeSession("a", 1L)
        val b = fakeSession("b", 2L)
        registry.join(5L, a)
        registry.join(5L, b)

        registry.closeRoom(5L, 1L)

        verify(a, never()).close(any())
        verify(b).close(CloseStatus.NORMAL)
    }

    @Test
    fun `closeRoom with a null exception closes everyone`() {
        val a = fakeSession("a", 1L)
        val b = fakeSession("b", 2L)
        registry.join(6L, a)
        registry.join(6L, b)

        registry.closeRoom(6L, null)

        verify(a).close(CloseStatus.NORMAL)
        verify(b).close(CloseStatus.NORMAL)
    }
}
```

This test needs `org.mockito.kotlin:mockito-kotlin` for the `any()` matcher used with Kotlin non-null parameter types (plain Mockito's `any()` returns `null`, which doesn't compile against Kotlin's non-null `BinaryMessage`/`CloseStatus` parameters). Add it as a test dependency in `build.gradle.kts`, alongside the existing `testImplementation` lines:

```gradle
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
```

- [ ] **Step 3: Run tests to verify they fail to compile**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollabRoomRegistryTest"`
Expected: FAIL — compilation error, `NoteCollabRoomRegistry` is unresolved.

- [ ] **Step 4: Implement `NoteCollabRoomRegistry`**

```kotlin
package com.shareddocs.backend.note.collab

import org.springframework.stereotype.Component
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Protocol-blind relay: groups WebSocket sessions by noteId and forwards raw
 * binary frames between them. Never decodes Yjs content — the CRDT merge
 * happens client-side, so a dumb relay gives the same correctness guarantee a
 * smart one would. Single backend instance (Mac Mini) — in-memory is enough,
 * no cross-instance broadcast needed.
 */
@Component
class NoteCollabRoomRegistry {
    private val rooms = ConcurrentHashMap<Long, CopyOnWriteArraySet<WebSocketSession>>()

    fun join(noteId: Long, session: WebSocketSession) {
        rooms.computeIfAbsent(noteId) { CopyOnWriteArraySet() }.add(session)
    }

    fun leave(noteId: Long, session: WebSocketSession) {
        val room = rooms[noteId] ?: return
        room.remove(session)
        if (room.isEmpty()) rooms.remove(noteId, room)
    }

    fun relay(noteId: Long, sender: WebSocketSession, message: BinaryMessage) {
        val room = rooms[noteId] ?: return
        room.forEach { peer ->
            if (peer.id != sender.id && peer.isOpen) {
                peer.sendMessage(message)
            }
        }
    }

    /** Force-closes every session in [noteId]'s room, except [exceptUserId]'s
     *  session when given (the author, on a flip-to-PRIVATE) — or everyone,
     *  when [exceptUserId] is null (soft-delete). */
    fun closeRoom(noteId: Long, exceptUserId: Long?) {
        val room = rooms[noteId] ?: return
        room.forEach { session ->
            if ((exceptUserId == null || session.attributes["userId"] != exceptUserId) && session.isOpen) {
                session.close(CloseStatus.NORMAL)
            }
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollabRoomRegistryTest"`
Expected: PASS (5/5)

- [ ] **Step 6: Commit**

```bash
git add build.gradle.kts src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabRoomRegistry.kt src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollabRoomRegistryTest.kt
git commit -m "feat(notes): NoteCollabRoomRegistry — protocol-blind per-note WS relay"
```

---

### Task 4: WebSocket endpoint — handshake auth + handler wiring

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabHandshakeInterceptor.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollaborationHandler.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/collab/WebSocketConfig.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollaborationHandlerIntegrationTest.kt`

**Interfaces:**
- Consumes: `NoteCollabAccessService.canCollaborate` (Task 2), `NoteCollabRoomRegistry.join/leave/relay` (Task 3), `JwtProvider.parse(token: String): Claims` + `.toPrincipal(claims: Claims): AppPrincipal` (existing), `AppPrincipal.userId: Long` (existing).
- Produces: the live endpoint at `/ws/notes/{noteId}?token=<jwt>` — consumed by the frontend from Task 9 onward.

- [ ] **Step 1: Write the failing integration test**

```kotlin
package com.shareddocs.backend.note.collab

import com.shareddocs.backend.auth.JwtProvider
import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.BinaryWebSocketHandler
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class NoteCollaborationHandlerIntegrationTest(
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val jwtProvider: JwtProvider,
) {
    @LocalServerPort
    private var port: Int = 0

    private fun user(): User = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    @Test
    fun `two workspace members relay binary frames to each other and not to themselves`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val member = user()
        workspaces.joinAsMember(ws.id!!, member.id!!)
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        val client = StandardWebSocketClient()
        val received = CompletableFuture<String>()
        val receiverHandler = object : BinaryWebSocketHandler() {
            override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
                received.complete(String(message.payload.array()))
            }
        }
        val urlA = "ws://localhost:$port/ws/notes/${note.id}?token=${jwtProvider.issue(owner)}"
        val urlB = "ws://localhost:$port/ws/notes/${note.id}?token=${jwtProvider.issue(member)}"
        val sessionA = client.execute(BinaryWebSocketHandler(), urlA).get(2, TimeUnit.SECONDS)
        client.execute(receiverHandler, urlB).get(2, TimeUnit.SECONDS)
        Thread.sleep(200) // let both joins land in the room before sending

        sessionA.sendMessage(BinaryMessage("hello".toByteArray()))

        assertEquals("hello", received.get(2, TimeUnit.SECONDS))
        sessionA.close()
    }

    @Test
    fun `handshake is rejected for a user with no membership and no share`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W2", "w2-${UUID.randomUUID().toString().take(8)}")
        val stranger = user()
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        val client = StandardWebSocketClient()
        val url = "ws://localhost:$port/ws/notes/${note.id}?token=${jwtProvider.issue(stranger)}"

        assertThrows(ExecutionException::class.java) {
            client.execute(BinaryWebSocketHandler(), url).get(2, TimeUnit.SECONDS)
        }
    }

    @Test
    fun `handshake is rejected with no token`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W3", "w3-${UUID.randomUUID().toString().take(8)}")
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        val client = StandardWebSocketClient()
        val url = "ws://localhost:$port/ws/notes/${note.id}"

        assertThrows(ExecutionException::class.java) {
            client.execute(BinaryWebSocketHandler(), url).get(2, TimeUnit.SECONDS)
        }
    }
}
```

- [ ] **Step 2: Run tests to verify they fail (no endpoint registered yet)**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollaborationHandlerIntegrationTest"`
Expected: FAIL — connection refused / 404, since `/ws/notes/**` doesn't exist yet.

- [ ] **Step 3: Implement the handshake interceptor**

```kotlin
package com.shareddocs.backend.note.collab

import com.shareddocs.backend.auth.JwtProvider
import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.util.AntPathMatcher
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import org.springframework.web.util.UriComponentsBuilder

/**
 * Validates the WS handshake before upgrade. Browsers can't set custom
 * headers on a WebSocket handshake, so the JWT rides as a `token` query
 * param (read from the same localStorage value the REST client already
 * sends as `Authorization: Bearer <token>`). Reuses NoteCollabAccessService
 * (Task 2) — the same access rule the REST note-edit endpoint enforces, no
 * separate permission model.
 */
@Component
class NoteCollabHandshakeInterceptor(
    private val jwtProvider: JwtProvider,
    private val accessService: NoteCollabAccessService,
) : HandshakeInterceptor {

    private val pathMatcher = AntPathMatcher()

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val noteId = pathMatcher.extractUriTemplateVariables("/ws/notes/{noteId}", request.uri.path)["noteId"]?.toLongOrNull()
        if (noteId == null) {
            response.setStatusCode(HttpStatus.BAD_REQUEST)
            return false
        }

        val token = UriComponentsBuilder.fromUri(request.uri).build().queryParams.getFirst("token")
        if (token == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED)
            return false
        }

        val userId = try {
            jwtProvider.toPrincipal(jwtProvider.parse(token)).userId
        } catch (e: Exception) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED)
            return false
        }

        if (!accessService.canCollaborate(noteId, userId)) {
            response.setStatusCode(HttpStatus.FORBIDDEN)
            return false
        }

        attributes["noteId"] = noteId
        attributes["userId"] = userId
        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) = Unit
}
```

- [ ] **Step 4: Implement the handler**

```kotlin
package com.shareddocs.backend.note.collab

import org.springframework.stereotype.Component
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.BinaryWebSocketHandler

@Component
class NoteCollaborationHandler(
    private val registry: NoteCollabRoomRegistry,
) : BinaryWebSocketHandler() {

    private fun noteId(session: WebSocketSession): Long = session.attributes["noteId"] as Long

    override fun afterConnectionEstablished(session: WebSocketSession) {
        registry.join(noteId(session), session)
    }

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
        registry.relay(noteId(session), session, message)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        registry.leave(noteId(session), session)
    }
}
```

- [ ] **Step 5: Wire the endpoint**

```kotlin
package com.shareddocs.backend.note.collab

import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class WebSocketConfig(
    private val handler: NoteCollaborationHandler,
    private val handshakeInterceptor: NoteCollabHandshakeInterceptor,
) : WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry
            .addHandler(handler, "/ws/notes/{noteId}")
            .addInterceptors(handshakeInterceptor)
            .setAllowedOriginPatterns("*")
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollaborationHandlerIntegrationTest"`
Expected: PASS (3/3)

- [ ] **Step 7: Run the full backend test suite**

Run: `./gradlew test`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabHandshakeInterceptor.kt src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollaborationHandler.kt src/main/kotlin/com/shareddocs/backend/note/collab/WebSocketConfig.kt src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollaborationHandlerIntegrationTest.kt
git commit -m "feat(notes): /ws/notes/{noteId} protocol-blind collaboration relay endpoint"
```

---

### Task 5: Force-close collaboration rooms on visibility flip and soft-delete

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/NoteService.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollabForceCloseTest.kt`

**Interfaces:**
- Consumes: `NoteCollabRoomRegistry.closeRoom(noteId: Long, exceptUserId: Long?)` (Task 3).

- [ ] **Step 1: Write the failing tests**

```kotlin
package com.shareddocs.backend.note.collab

import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.UpdateNoteRequest
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Test
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NoteCollabForceCloseTest(
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    @MockitoBean
    private lateinit var collabRoomRegistry: NoteCollabRoomRegistry

    private fun user(): User = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    @Test
    fun `flipping a note to PRIVATE force-closes its room, sparing the author`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        noteService.update(note.id, UpdateNoteRequest(visibility = Visibility.PRIVATE), ws.id!!, owner.id!!)

        verify(collabRoomRegistry).closeRoom(note.id, owner.id!!)
    }

    @Test
    fun `deleting a note force-closes its room for everyone`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W2", "w2-${UUID.randomUUID().toString().take(8)}")
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        noteService.delete(note.id, ws.id!!, owner.id!!, Role.USER)

        verify(collabRoomRegistry).closeRoom(note.id, null)
    }

    @Test
    fun `a body-only edit does not close the room`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W3", "w3-${UUID.randomUUID().toString().take(8)}")
        val note = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!)

        noteService.update(note.id, UpdateNoteRequest(body = "<p>y</p>"), ws.id!!, owner.id!!)

        org.mockito.Mockito.verifyNoInteractions(collabRoomRegistry)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail (registry not called yet)**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollabForceCloseTest"`
Expected: FAIL — `closeRoom` is never invoked.

- [ ] **Step 3: Wire the registry into `NoteService`**

Add the constructor parameter (in `NoteService.kt`, extend the existing constructor at lines 27–35):

```kotlin
@Service
@Transactional
class NoteService(
    private val repository: NoteRepository,
    private val userRepository: UserRepository,
    private val entityRefs: EntityRefRepository,
    private val attachments: AttachmentRepository,
    private val storage: FileStorageService,
    private val indexer: EntityRefIndexer,
    private val resourceShares: ResourceShareRepository,
    private val collabRoomRegistry: com.shareddocs.backend.note.collab.NoteCollabRoomRegistry,
) {
```

Update `update()` (the version from Task 1) to close the room on a flip to PRIVATE:

```kotlin
    fun update(id: Long, req: UpdateNoteRequest, workspaceId: Long, callerUserId: Long): NoteResponse {
        val note = repository.findByIdAndWorkspaceIdAndDeletedAtIsNull(id, workspaceId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "note $id") }
        val isAuthor = note.createdBy.id == callerUserId
        if (note.visibility == Visibility.PRIVATE && !isAuthor) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit")
        }
        if (req.visibility != null && !isAuthor) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can change visibility")
        }
        val flippingToPrivate = req.visibility == Visibility.PRIVATE && note.visibility == Visibility.WORKSPACE
        req.title?.let { note.title = it.trim().takeIf { s -> s.isNotEmpty() } }
        val bodyChanged = req.body != null && req.body != note.body
        req.body?.let { note.body = it }
        req.pinned?.let { note.pinned = it }
        req.visibility?.let { note.visibility = it }
        if (bodyChanged) indexer.reindex(note.id!!, workspaceId, note.body)
        // A note that's no longer visible to the workspace has no business
        // hosting a live collaboration session for anyone but its author.
        if (flippingToPrivate) collabRoomRegistry.closeRoom(note.id!!, note.createdBy.id)
        return NoteResponse.from(note)
    }
```

Update `delete()` (lines 129–138):

```kotlin
    fun delete(id: Long, workspaceId: Long, callerUserId: Long, callerRole: Role) {
        val note = repository.findByIdAndWorkspaceIdAndDeletedAtIsNull(id, workspaceId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "note $id") }
        assertCanMutate(note, callerUserId, callerRole, "delete")
        note.deletedAt = Instant.now()
        entityRefs.deleteAllByFromNoteId(id)
        collabRoomRegistry.closeRoom(id, null)
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.note.collab.NoteCollabForceCloseTest"`
Expected: PASS (3/3)

- [ ] **Step 5: Run the full backend test suite**

Run: `./gradlew test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/NoteService.kt src/test/kotlin/com/shareddocs/backend/note/collab/NoteCollabForceCloseTest.kt
git commit -m "feat(notes): force-close a note's collaboration room on PRIVATE flip / delete"
```

---

### Task 6: Frontend dependencies — Yjs + Tiptap collaboration extensions

**Files:**
- Modify: `shared-docs/package.json`

- [ ] **Step 1: Add the dependencies**

In the `"dependencies"` block, alongside the existing `@tiptap/*` entries, add (keep alphabetical order as the rest of the block does):

```json
    "@tiptap/extension-collaboration": "^3.23.4",
    "@tiptap/extension-collaboration-cursor": "^3.23.4",
```

And add near `axios`/`jwt-decode` (alphabetical):

```json
    "y-websocket": "^2.0.4",
    "yjs": "^13.6.27",
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: lockfile updates, no peer-dependency errors.

- [ ] **Step 3: Verify the build still succeeds**

Run: `npx tsc -b --noEmit && npx eslint .`
Expected: 0 errors (nothing references the new packages yet, so this only confirms the install didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(notes): add yjs + tiptap collaboration extension dependencies"
```

---

### Task 7: Deterministic per-user cursor color

**Files:**
- Create: `shared-docs/src/features/notes/collab/collabColor.ts`

- [ ] **Step 1: Implement**

```typescript
// A fixed, small palette — not a design-token color, since the whole point is
// a stable small set of visually distinct hues assigned deterministically per
// user, not a themeable brand color.
const PALETTE = ['#e06c75', '#61afef', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#d19a66']

/** Deterministic color per user — the same person always renders as the same
 *  cursor color, stable across sessions, reconnects, and page reloads. */
export function collabColorForUser(userId: number): string {
  return PALETTE[userId % PALETTE.length]
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/notes/collab/collabColor.ts
git commit -m "feat(notes): deterministic per-user collaboration cursor color"
```

---

### Task 8: `useNoteCollaboration` — Y.Doc + WebsocketProvider lifecycle

**Files:**
- Create: `shared-docs/src/features/notes/collab/useNoteCollaboration.ts`

**Interfaces:**
- Consumes: `getToken(): string | null` from `src/auth/tokenStorage.ts` (existing).
- Produces: `useNoteCollaboration(noteId: number, enabled: boolean): { yDoc: Y.Doc; provider: WebsocketProvider } | null` — consumed by Task 9.

- [ ] **Step 1: Implement**

```typescript
import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getToken } from '../../../auth/tokenStorage'

export type NoteCollaboration = { yDoc: Y.Doc; provider: WebsocketProvider } | null

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? `ws://${window.location.hostname}:8090`

/**
 * Owns the Y.Doc + WebsocketProvider lifecycle for one note's live
 * collaboration session. Returns null when disabled (PRIVATE notes have
 * nothing to co-edit — v1 scope is WORKSPACE notes only) or when no auth
 * token is available. The Y.Doc is ephemeral — it lives only as long as this
 * hook is mounted; persistence stays the existing debounced PATCH of
 * editor.getHTML(), untouched by this hook.
 */
export function useNoteCollaboration(noteId: number, enabled: boolean): NoteCollaboration {
  const [collab, setCollab] = useState<NoteCollaboration>(null)

  useEffect(() => {
    if (!enabled) {
      setCollab(null)
      return
    }
    const token = getToken()
    if (!token) {
      setCollab(null)
      return
    }

    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(`${WS_BASE}/ws/notes`, String(noteId), yDoc, {
      params: { token },
    })
    setCollab({ yDoc, provider })

    return () => {
      provider.destroy()
      yDoc.destroy()
      setCollab(null)
    }
  }, [noteId, enabled])

  return collab
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/notes/collab`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/notes/collab/useNoteCollaboration.ts
git commit -m "feat(notes): useNoteCollaboration hook owns the Y.Doc/WebsocketProvider lifecycle"
```

---

### Task 9: Wire collaboration into the note editor + avatar stack

**Files:**
- Modify: `shared-docs/src/features/notes/editor/NoteEditorBody.tsx`
- Modify: `shared-docs/src/features/notes/editor/NoteEditor.tsx`
- Create: `shared-docs/src/features/notes/collab/CollabAvatarStack.tsx`

**Interfaces:**
- Consumes: `useNoteCollaboration` (Task 8), `collabColorForUser` (Task 7), `useAuth()` → `AuthUser { userId: number; name: string; pictureUrl: string | null }` (existing).

- [ ] **Step 1: Add collaboration props to `NoteEditorBody`**

In `NoteEditorBody.tsx`, add to the imports:

```typescript
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import type { NoteCollaboration } from '../collab/useNoteCollaboration'
```

Extend the `Props` type (the block at lines 41–64):

```typescript
type Props = {
  noteId: number
  initialBody: string
  canEdit?: boolean
  onBodyChange: (html: string) => void
  onUploadImage?: (file: File) => Promise<string>
  onUploadFile?: (file: File) => Promise<{ url: string; filename: string; sizeBytes: number }>
  onPickFile?: () => void
  onPickSnapshot?: () => void
  onPickLinkCard?: () => void
  onPickCalcSnapshot?: () => void
  registerEditor: (editor: Editor | null) => void
  onRequestLinkDialog: () => void
  minimal?: boolean
  /** Live collaboration session for this note — null when disabled (PRIVATE
   *  notes have nothing to co-edit) or not yet connected. */
  collab?: NoteCollaboration
  /** Cursor identity broadcast to peers when `collab` is active. */
  collabUser?: { name: string; color: string }
}
```

Destructure the two new props alongside the others at the top of the component (find the existing prop destructuring and add `collab, collabUser,`).

In the `useEditor()` call, add to the `extensions` array (right after the last existing entry, `MentionCommand.configure({...})`):

```typescript
    ...(collab
      ? [
          Collaboration.configure({ document: collab.yDoc, field: 'default' }),
          CollaborationCursor.configure({
            provider: collab.provider,
            user: collabUser ?? { name: '익명', color: '#61afef' },
          }),
        ]
      : []),
```

Change the `useEditor` call to pass a deps array so the editor recreates once `collab` becomes available (it's `null` for one render while `useNoteCollaboration`'s effect hasn't run yet):

Find the closing of the `useEditor({...})` call and change:

```typescript
})
```

to:

```typescript
}, [collab?.yDoc])
```

- [ ] **Step 2: Seed the Y.Doc from the saved body when no peer answers sync**

Add this effect in `NoteEditorBody.tsx`, after the `useEditor` call (needs access to the `editor` variable it returns):

```typescript
  // First opener of a note has no peer to sync from — seed the Y.Doc from the
  // last saved snapshot. A joiner who connects while someone else is already
  // in the room instead receives their live state via the sync protocol, so
  // this only fires when the fragment comes back empty after sync completes.
  useEffect(() => {
    if (!editor || !collab) return
    const handleSync = (isSynced: boolean) => {
      if (isSynced && collab.yDoc.getXmlFragment('default').length === 0 && initialBody) {
        editor.commands.setContent(initialBody, false)
      }
    }
    collab.provider.on('synced', handleSync)
    return () => {
      collab.provider.off('synced', handleSync)
    }
  }, [editor, collab, initialBody])
```

- [ ] **Step 3: Compute collaboration state in `NoteEditor.tsx` and pass it down**

Add imports:

```typescript
import { useNoteCollaboration } from '../collab/useNoteCollaboration'
import { collabColorForUser } from '../collab/collabColor'
import CollabAvatarStack from '../collab/CollabAvatarStack'
import { useAuth } from '../../../auth/useAuth'
```

Inside the `NoteEditor` component, after the existing state declarations (near the `canEdit` line), add:

```typescript
  const { user } = useAuth()
  const collab = useNoteCollaboration(note.id, note.visibility === 'WORKSPACE')
  const collabUser = user ? { name: user.name, color: collabColorForUser(user.userId) } : undefined
```

Pass the new props to `<NoteEditorBody>` (in the JSX block around line 204):

```typescript
          <NoteEditorBody
            noteId={note.id}
            initialBody={note.body}
            canEdit={canEdit}
            onBodyChange={scheduleBodySave}
            onUploadImage={onUploadImage}
            onUploadFile={onUploadFile}
            onPickFile={onPickFile}
            onPickSnapshot={onPickSnapshot}
            onPickLinkCard={onPickLinkCard}
            onPickCalcSnapshot={onPickCalcSnapshot}
            registerEditor={setEditor}
            onRequestLinkDialog={openLinkDialog}
            collab={collab}
            collabUser={collabUser}
          />
```

Render the avatar stack in `NoteEditorMeta`'s row — add it right before the closing of the meta section (near the existing `<NoteEditorMeta ... />` call around line 193):

```typescript
          <NoteEditorMeta
            note={note}
            saving={bodyDirty || updateNote.isPending}
            canEdit={canEdit}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
            onShare={() => setShareOpen(true)}
          />
          {collab && <CollabAvatarStack provider={collab.provider} />}
```

- [ ] **Step 4: Implement the avatar stack component**

```typescript
import { useEffect, useState } from 'react'
import type { WebsocketProvider } from 'y-websocket'
import styles from './CollabAvatarStack.module.css'

type PeerUser = { name: string; color: string }

export default function CollabAvatarStack({ provider }: { provider: WebsocketProvider }) {
  const [peers, setPeers] = useState<PeerUser[]>([])

  useEffect(() => {
    const update = () => {
      const states = Array.from(provider.awareness.getStates().values()) as Array<{ user?: PeerUser }>
      setPeers(states.map((s) => s.user).filter((u): u is PeerUser => !!u))
    }
    provider.awareness.on('change', update)
    update()
    return () => {
      provider.awareness.off('change', update)
    }
  }, [provider])

  if (peers.length === 0) return null

  return (
    <div className={styles.stack} aria-label="지금 함께 보고 있는 사람">
      {peers.map((peer, i) => (
        <span key={i} className={styles.avatar} style={{ borderColor: peer.color }} title={peer.name}>
          {peer.name.charAt(0)}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/notes`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/notes/editor/NoteEditorBody.tsx src/features/notes/editor/NoteEditor.tsx src/features/notes/collab/CollabAvatarStack.tsx
git commit -m "feat(notes): wire live collaboration + cursors + avatar stack into the note editor"
```

---

### Task 10: Cursor + avatar styling (Bear aesthetic — hairline, no shadow)

**Files:**
- Create: `shared-docs/src/features/notes/collab/CollabAvatarStack.module.css`
- Modify: `shared-docs/src/features/notes/editor/NoteEditorBody.module.css`

- [ ] **Step 1: Avatar stack styles**

```css
.stack {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin-left: var(--sp-2);
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--r-pill);
  border: 1.5px solid var(--c-border);
  background: var(--c-surface);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  color: var(--c-text);
}
```

- [ ] **Step 2: Remote cursor styles**

Tiptap's `CollaborationCursor` renders a `<span class="collaboration-cursor__caret">` (the caret line) containing a `<div class="collaboration-cursor__label">` (the name tag), both with inline `border-color`/`background-color` set from the extension's `user.color`. Add to `NoteEditorBody.module.css`, alongside the existing `:global()` rules for Tiptap-injected classes:

```css
.editor :global(.collaboration-cursor__caret) {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1.5px solid;
  border-right: none;
  word-break: normal;
  pointer-events: none;
}

.editor :global(.collaboration-cursor__label) {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 11px;
  font-weight: var(--fw-medium);
  font-family: var(--font-sans);
  line-height: 1;
  white-space: nowrap;
  color: var(--c-surface);
  padding: 2px 5px;
  border-radius: var(--r-xs);
  pointer-events: none;
  user-select: none;
}
```

- [ ] **Step 3: Verify**

Run: `npx eslint src/features/notes` (CSS Modules aren't linted by ESLint, this just re-confirms no TS regressions from the import) and open the app in the dev server to eyeball spacing:

```bash
npm run dev
```

Expected: dev server starts clean, no console errors from the new CSS Module imports.

- [ ] **Step 4: Commit**

```bash
git add src/features/notes/collab/CollabAvatarStack.module.css src/features/notes/editor/NoteEditorBody.module.css
git commit -m "style(notes): Bear-minimal styling for remote cursors + avatar stack"
```

---

### Task 11: Manual smoke verification + full-repo gate

No file changes — this task is the final verification pass before considering the feature done, per this project's actual testing convention (backend has real tests; frontend relies on type-check/lint/manual QA).

- [ ] **Step 1: Full backend gate**

Run: `cd shared-docs-backend && ./gradlew build`
Expected: BUILD SUCCESSFUL, all tests green including every test added in Tasks 1–5.

- [ ] **Step 2: Full frontend gate**

Run: `cd shared-docs && npm run build`
Expected: `tsc -b` and `vite build` both succeed with 0 errors.

- [ ] **Step 3: Manual smoke checklist**

Run both apps locally (`./gradlew bootRun` in the backend, `npm run dev` in the frontend) and verify with two browser profiles (or one normal + one incognito) signed in as two different workspace members:

- [ ] Both open the same shared note — each sees the other's colored cursor caret + name label as the other moves their cursor or types.
- [ ] Type in different paragraphs simultaneously — both edits land, no data loss, both browsers converge to the same content.
- [ ] Type in the *same* line simultaneously — content merges without an overwrite (Yjs CRDT resolves it; no confirmation dialog, no "conflict" message).
- [ ] Avatar stack in the editor header shows both people while both are viewing; shrinks to nothing when the second person navigates away.
- [ ] Restart the backend (`./gradlew bootRun` again) while both are connected — both browsers show a brief disconnect and auto-reconnect; editing keeps working locally throughout, and content re-syncs once the backend is back.
- [ ] Flip the note to PRIVATE (as the author) while the second person has it open — their session is force-closed and they see the app's existing "note not found" state.
- [ ] Soft-delete the note while someone else has it open — same force-close behavior.
- [ ] A user with only VIEW-level cross-workspace share access cannot open a live collaboration session on that note (handshake should be rejected — confirm via the browser's network/WS inspector showing a failed upgrade, not a silent no-op).
- [ ] A PRIVATE note never attempts a WebSocket connection at all (confirm via the browser's network inspector — no `/ws/notes/` request fires when opening a PRIVATE note).

- [ ] **Step 4: Update CLAUDE.md's feature-status table**

In `shared-docs/CLAUDE.md`, find the row:

```
| Presence on shared notes | **Not started.** Only remaining post-v2 direction from VISION.md. |
```

Replace with:

```
| Real-time collaborative editing on shared notes | **Shipped [DATE].** Yjs CRDT via a protocol-blind Spring WebSocket relay (`/ws/notes/{noteId}`); ephemeral session sync, `Note.body` persistence unchanged. Live colored cursors + avatar stack. Fixed a prerequisite gap where non-authors couldn't edit WORKSPACE notes at all. Design/plan: `docs/plans/2026-07-02-realtime-collaboration-{design,plan}.md`. |
```

(Fill in `[DATE]` with the actual ship date.)

In `shared-docs/docs/VISION.md` §6 "What this is NOT", find:

```
- ❌ **Not a real-time CRDT editor.** Last-write-wins for the foreseeable future; presence (avatar + cursor) only.
```

Replace with:

```
- ✅ ~~Not a real-time CRDT editor~~ — **reversed [DATE]**: shared (WORKSPACE-visibility) notes now support real-time collaborative editing via Yjs, with live colored cursors. This stayed narrower than it sounds: sync is ephemeral (session-only, in-memory `Y.Doc`s relayed by a protocol-blind WebSocket endpoint) — persistence is still a plain saved snapshot via the existing debounced `PATCH`, not a permanent CRDT history. PRIVATE notes are unaffected (author-only, nothing to co-edit). See `docs/plans/2026-07-02-realtime-collaboration-{design,plan}.md`.
```

(Fill in `[DATE]` with the actual ship date, matching Step 4.)

- [ ] **Step 5: Commit the docs update**

```bash
git add CLAUDE.md docs/VISION.md
git commit -m "docs: mark real-time collaborative editing on shared notes as shipped"
```
