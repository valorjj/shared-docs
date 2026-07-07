# Real-Time Collaboration on Decisions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Decisions pillar live: any write by one member appears on every other member's screen without a refresh, plus a presence avatar stack of who's viewing a plan.

**Architecture:** Decisions data is server-authoritative (MariaDB + optimistic locking), so this is NOT Yjs-on-the-data. The server emits a tiny `{planId?}` *change signal* over WebSocket after each write commits (`@TransactionalEventListener(AFTER_COMMIT)`); each client re-runs the `decisionKeys.scope(wsId)` invalidation it already runs locally, and React Query refetches. Presence is a Yjs-*awareness* channel per plan (empty `Y.Doc`), reusing the notes machinery. A shared transport seam (`CollabRoomRegistry` / `BlindRelayHandler` / `JwtQueryTokenInterceptor`) is introduced and the shipped notes relay is retrofitted onto it, so the app has one real-time subsystem.

**Tech Stack:** Spring Boot 3.5 + Kotlin (`spring-boot-starter-websocket` already present from the notes feature) · Vite + React 19 + TS + CSS Modules + React Query · `yjs` + `y-websocket` (already dependencies) · native `WebSocket` for the change signal.

**Design spec:** [`2026-07-07-decisions-realtime-collab-design.md`](2026-07-07-decisions-realtime-collab-design.md).

## Global Constraints

- **Branch:** all work on `decisions-realtime-collab` (already created off `main`; the design doc is committed there).
- **UI text in Korean.** Chrome uses Lucide icons, never emoji.
- **CSS Modules + tokens only.** No hardcoded hex except the existing per-user `collabColor` palette (already exempt). No shadows on cards (Bear rule).
- **No setState in effect** (derive, or set state only from event callbacks — awareness `change` handlers are fine).
- **No backwards-compat shims, no feature flags.** The notes retrofit *replaces* the old classes; it does not keep them alongside.
- **Comments only where the *why* is non-obvious.**
- **Backend gate:** `./gradlew test` green. **Frontend gate:** `npx tsc -b --noEmit` (must use `-b`), `npx eslint src/features/decisions src/features/notes`, `npm run build` — the frontend has no unit-test runner; these three plus manual smoke are authoritative.
- **Frontend WS origin:** derive from `VITE_API_BASE_URL` by swapping `http(s)`→`ws(s)` (never `window.location`), exactly as `useNoteCollaboration` does — prod frontend (Vercel) and backend (Cloudflare Tunnel) are different hosts.
- **Package locations:** backend shared collab code goes in `com.shareddocs.backend.collab`; Decisions-specific collab code in `com.shareddocs.backend.decision` (change signal) reusing the shared package.

---

## File Structure

**Backend — new shared package `com.shareddocs.backend.collab/`:**
- `RoomKey.kt` — value type discriminating rooms (`note:{id}` / `plan:{id}` / `ws:{id}`) so one registry hosts all channels without collision.
- `CollabRoomRegistry.kt` — generic room registry: `join`/`leave`/`relay` (client-origin binary, excludes sender) / `broadcast` (server-origin, all sessions) / `closeRoom`.
- `BlindRelayHandler.kt` — generic `BinaryWebSocketHandler`; relays by the `RoomKey` the interceptor stashed. Serves both `/ws/notes/{noteId}` and `/ws/plans/{planId}`.
- `CollabAccessPredicate.kt` — `fun interface` `(roomId: Long, userId: Long) -> Boolean`.
- `JwtQueryTokenInterceptor.kt` — parameterized handshake interceptor (URI template + id attribute name + `RoomKey` factory + access predicate). Instantiated per endpoint in config.
- `CollabWebSocketConfig.kt` — replaces `note/collab/WebSocketConfig.kt`; registers all three endpoints.

**Backend — modified:**
- `note/collab/NoteCollabAccessService.kt` — unchanged logic; adapted to expose a `CollabAccessPredicate`.
- `note/NoteService.kt:35,138,151` — inject `CollabRoomRegistry`, call `closeRoom(RoomKey.note(id), …)`.
- **Deleted:** `note/collab/NoteCollabRoomRegistry.kt`, `NoteCollaborationHandler.kt`, `NoteCollabHandshakeInterceptor.kt`, `WebSocketConfig.kt` (their behavior moves to the shared package).

**Backend — new Decisions change signal in `com.shareddocs.backend.decision/`:**
- `DecisionsChanged.kt` — event `data class`.
- `DecisionChangePublisher.kt` — thin bean wrapping `ApplicationEventPublisher`.
- `DecisionsChangeListener.kt` — `@TransactionalEventListener(AFTER_COMMIT)` → registry broadcast.
- `DecisionsSignalHandler.kt` — `TextWebSocketHandler`, join/leave the `ws:{id}` room.
- Modified write services: `PlanService`, `VoteService`, `RatingService`, `DecisionService`, `EdgeService`, `PlanDiscussionService` — one `changes.publish(...)` line per write path.

**Frontend — new `src/features/decisions/collab/`:**
- `wsBase.ts` — the `WS_BASE` derivation (kept local to decisions to avoid touching shipped notes code).
- `useDecisionsChangeFeed.ts` — native `WebSocket` to `/ws/decisions/{wsId}`; invalidate `scope(wsId)` on open and on each message; reconnect with backoff.
- `DecisionsCollabBoundary.tsx` — route element mounting the hook once for both decisions routes; renders `<Outlet/>`.
- `DecisionPresenceStack.tsx` + `.module.css` — Yjs-awareness presence for a plan; avatar stack.

**Frontend — modified:**
- `src/App.tsx:73-74` — wrap the two decisions routes in `<Route element={<DecisionsCollabBoundary/>}>`.
- `src/features/decisions/PlanDetail.tsx` — render `<DecisionPresenceStack planId={…} />` in the control strip.
- (Optional, severable) `src/features/decisions/DiscussionPane.tsx` — wire `useNoteCollaboration` into `EditorSection`.

---

# PART A — Backend seam + notes retrofit

### Task 1: Generic `CollabRoomRegistry` + `RoomKey`

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/collab/RoomKey.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/collab/CollabRoomRegistry.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/collab/CollabRoomRegistryTest.kt`

**Interfaces:**
- Produces: `RoomKey` with `companion` factories `note(id: Long)`, `plan(id: Long)`, `workspace(id: Long)`. `CollabRoomRegistry` with `join(room, session)`, `leave(room, session)`, `relay(room, sender, BinaryMessage)`, `broadcast(room, message: WebSocketMessage<*>)`, `closeRoom(room, exceptUserId: Long?)`.

- [ ] **Step 1: Write the failing test** (mirrors `NoteCollabRoomRegistryTest`, adds key-isolation + broadcast cases)

`CollabRoomRegistryTest.kt`:

```kotlin
package com.shareddocs.backend.collab

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession

class CollabRoomRegistryTest {
    private val registry = CollabRoomRegistry()

    private fun fakeSession(id: String, userId: Long): WebSocketSession {
        val session = mock(WebSocketSession::class.java)
        `when`(session.id).thenReturn(id)
        `when`(session.isOpen).thenReturn(true)
        `when`(session.attributes).thenReturn(mutableMapOf<String, Any>("userId" to userId))
        return session
    }

    @Test
    fun `relay forwards to peers but not the sender`() {
        val a = fakeSession("a", 1L); val b = fakeSession("b", 2L)
        registry.join(RoomKey.note(1L), a); registry.join(RoomKey.note(1L), b)
        val msg = BinaryMessage("hi".toByteArray())
        registry.relay(RoomKey.note(1L), a, msg)
        verify(b).sendMessage(msg)
        verify(a, never()).sendMessage(any())
    }

    @Test
    fun `note and plan rooms with the same numeric id do not collide`() {
        val a = fakeSession("a", 1L); val b = fakeSession("b", 2L)
        registry.join(RoomKey.note(1L), a); registry.join(RoomKey.plan(1L), b)
        registry.relay(RoomKey.note(1L), a, BinaryMessage("hi".toByteArray()))
        verify(b, never()).sendMessage(any())
    }

    @Test
    fun `broadcast sends the message to every session in the room`() {
        val a = fakeSession("a", 1L); val b = fakeSession("b", 2L)
        registry.join(RoomKey.workspace(9L), a); registry.join(RoomKey.workspace(9L), b)
        val msg = TextMessage("{\"planId\":5}")
        registry.broadcast(RoomKey.workspace(9L), msg)
        verify(a).sendMessage(msg)
        verify(b).sendMessage(msg)
    }

    @Test
    fun `leave removes the session and evicts the empty room`() {
        val a = fakeSession("a", 1L)
        registry.join(RoomKey.plan(3L), a)
        registry.leave(RoomKey.plan(3L), a)
        registry.broadcast(RoomKey.plan(3L), TextMessage("x")) // no room → no throw
        verify(a, never()).sendMessage(any())
    }

    @Test
    fun `closeRoom closes everyone except the given user`() {
        val a = fakeSession("a", 1L); val b = fakeSession("b", 2L)
        registry.join(RoomKey.note(5L), a); registry.join(RoomKey.note(5L), b)
        registry.closeRoom(RoomKey.note(5L), 1L)
        verify(a, never()).close(any())
        verify(b).close(CloseStatus.NORMAL)
    }
}
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `./gradlew test --tests 'com.shareddocs.backend.collab.CollabRoomRegistryTest'`
Expected: compile failure — `RoomKey` / `CollabRoomRegistry` unresolved.

- [ ] **Step 3: Implement `RoomKey`**

`RoomKey.kt`:

```kotlin
package com.shareddocs.backend.collab

/**
 * Discriminates collaboration rooms so one registry can host multiple channel
 * kinds without numeric-id collisions (note 1 and plan 1 are different rooms).
 */
@JvmInline
value class RoomKey(val value: String) {
    companion object {
        fun note(id: Long) = RoomKey("note:$id")
        fun plan(id: Long) = RoomKey("plan:$id")
        fun workspace(id: Long) = RoomKey("ws:$id")
    }
}
```

- [ ] **Step 4: Implement `CollabRoomRegistry`**

`CollabRoomRegistry.kt`:

```kotlin
package com.shareddocs.backend.collab

import org.springframework.stereotype.Component
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * One in-memory registry for every collaboration channel (notes, plan presence,
 * decisions change signal), keyed by [RoomKey]. Single backend instance (Mac
 * Mini) — no cross-instance broadcast needed. This is the seam: a future
 * multi-instance deployment swaps only this class (the distributed impl is
 * proven in the separate shared-doc-yjs scaling lab before it ever lands here).
 */
@Component
class CollabRoomRegistry {
    private val rooms = ConcurrentHashMap<RoomKey, CopyOnWriteArraySet<WebSocketSession>>()

    fun join(room: RoomKey, session: WebSocketSession) {
        rooms.computeIfAbsent(room) { CopyOnWriteArraySet() }.add(session)
    }

    fun leave(room: RoomKey, session: WebSocketSession) {
        val set = rooms[room] ?: return
        set.remove(session)
        if (set.isEmpty()) rooms.remove(room, set)
    }

    /** Client-originated relay: forward a raw frame to peers, never the sender. */
    fun relay(room: RoomKey, sender: WebSocketSession, message: BinaryMessage) {
        val set = rooms[room] ?: return
        set.forEach { peer -> if (peer.id != sender.id && peer.isOpen) peer.sendMessage(message) }
    }

    /** Server-originated broadcast: send to every open session in the room. */
    fun broadcast(room: RoomKey, message: WebSocketMessage<*>) {
        val set = rooms[room] ?: return
        set.forEach { session -> if (session.isOpen) session.sendMessage(message) }
    }

    /** Force-close every session in the room except [exceptUserId]'s (null = everyone). */
    fun closeRoom(room: RoomKey, exceptUserId: Long?) {
        val set = rooms[room] ?: return
        set.forEach { session ->
            if ((exceptUserId == null || session.attributes["userId"] != exceptUserId) && session.isOpen) {
                session.close(CloseStatus.NORMAL)
            }
        }
    }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `./gradlew test --tests 'com.shareddocs.backend.collab.CollabRoomRegistryTest'`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/collab src/test/kotlin/com/shareddocs/backend/collab
git commit -m "feat(collab): generic RoomKey-keyed CollabRoomRegistry seam"
```

---

### Task 2: Shared handshake interceptor + blind relay handler; retrofit notes onto them

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/collab/CollabAccessPredicate.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/collab/JwtQueryTokenInterceptor.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/collab/BlindRelayHandler.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/collab/CollabWebSocketConfig.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/note/NoteService.kt` (:35, :138, :151)
- Delete: `note/collab/{NoteCollabRoomRegistry,NoteCollaborationHandler,NoteCollabHandshakeInterceptor,WebSocketConfig}.kt`
- Keep: `note/collab/NoteCollabAccessService.kt` (referenced as a predicate)
- Test: existing `NoteCollaborationHandlerIntegrationTest`, `NoteCollabForceCloseTest`, `NoteCollabAccessServiceTest` must pass unchanged (parity).

**Interfaces:**
- Consumes: `CollabRoomRegistry`, `RoomKey` (Task 1); `JwtProvider` (`parse`/`toPrincipal(...).userId`); `NoteCollabAccessService.canCollaborate(noteId, userId)`.
- Produces: `CollabAccessPredicate` (`fun canAccess(roomId: Long, userId: Long): Boolean`); `BlindRelayHandler` bean; `JwtQueryTokenInterceptor(template, idAttr, roomKeyOf, jwtProvider, access)`.

- [ ] **Step 1: Confirm current notes tests pass (baseline)**

Run: `./gradlew test --tests 'com.shareddocs.backend.note.collab.*'`
Expected: PASS. Record the count — the same tests must pass after the retrofit.

- [ ] **Step 2: Implement `CollabAccessPredicate`**

`CollabAccessPredicate.kt`:

```kotlin
package com.shareddocs.backend.collab

/** Per-endpoint authorization for a collaboration room handshake. */
fun interface CollabAccessPredicate {
    fun canAccess(roomId: Long, userId: Long): Boolean
}
```

- [ ] **Step 3: Implement `JwtQueryTokenInterceptor`** (generalized from `NoteCollabHandshakeInterceptor`)

`JwtQueryTokenInterceptor.kt`:

```kotlin
package com.shareddocs.backend.collab

import com.shareddocs.backend.auth.JwtProvider
import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.util.AntPathMatcher
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import org.springframework.web.util.UriComponentsBuilder

/**
 * Validates a collaboration WS handshake before upgrade. Browsers can't set
 * headers on a WS handshake, so the JWT rides as a `token` query param. The
 * path id is validated by the per-endpoint [access] predicate — the same rule
 * the matching REST endpoint enforces, no separate permission model.
 *
 * Instantiated per endpoint (not a @Component) so each registration supplies its
 * own URI template, id attribute name, RoomKey factory, and access predicate.
 */
class JwtQueryTokenInterceptor(
    private val template: String,          // e.g. "/ws/notes/{noteId}"
    private val idVar: String,             // e.g. "noteId"
    private val roomKeyOf: (Long) -> RoomKey,
    private val jwtProvider: JwtProvider,
    private val access: CollabAccessPredicate,
) : HandshakeInterceptor {

    private val pathMatcher = AntPathMatcher()

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val roomId = pathMatcher.extractUriTemplateVariables(template, request.uri.path)[idVar]?.toLongOrNull()
        if (roomId == null) { response.setStatusCode(HttpStatus.BAD_REQUEST); return false }

        val token = UriComponentsBuilder.fromUri(request.uri).build().queryParams.getFirst("token")
        if (token == null) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false }

        val userId = try {
            jwtProvider.toPrincipal(jwtProvider.parse(token)).userId
        } catch (e: Exception) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED); return false
        }

        if (!access.canAccess(roomId, userId)) { response.setStatusCode(HttpStatus.FORBIDDEN); return false }

        attributes["roomKey"] = roomKeyOf(roomId)
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

- [ ] **Step 4: Implement `BlindRelayHandler`** (generalized from `NoteCollaborationHandler`)

`BlindRelayHandler.kt`:

```kotlin
package com.shareddocs.backend.collab

import org.springframework.stereotype.Component
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.BinaryWebSocketHandler

/**
 * Protocol-blind binary relay for any Yjs channel (note content+awareness, or
 * plan presence awareness). Never decodes payloads — the CRDT/awareness merge
 * happens client-side. Room membership is decided by the handshake interceptor,
 * which stashed the [RoomKey] in session attributes.
 */
@Component
class BlindRelayHandler(private val registry: CollabRoomRegistry) : BinaryWebSocketHandler() {

    private fun room(session: WebSocketSession) = session.attributes["roomKey"] as RoomKey

    override fun afterConnectionEstablished(session: WebSocketSession) = registry.join(room(session), session)

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) =
        registry.relay(room(session), session, message)

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) =
        registry.leave(room(session), session)
}
```

- [ ] **Step 5: Implement `CollabWebSocketConfig`** (replaces `note/collab/WebSocketConfig.kt`; registers notes now, plans/decisions added in Tasks 3–4)

`CollabWebSocketConfig.kt`:

```kotlin
package com.shareddocs.backend.collab

import com.shareddocs.backend.auth.JwtProvider
import com.shareddocs.backend.note.collab.NoteCollabAccessService
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Condition
import org.springframework.context.annotation.ConditionContext
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import org.springframework.core.type.AnnotatedTypeMetadata
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean

@Configuration
@EnableWebSocket
class CollabWebSocketConfig(
    private val blindRelay: BlindRelayHandler,
    private val jwtProvider: JwtProvider,
    private val noteAccess: NoteCollabAccessService,
    @Value("\${app.cors.allowed-origins}") private val allowedOrigins: String,
) : WebSocketConfigurer {

    private fun origins() = allowedOrigins.split(",").map { it.trim() }.toTypedArray()

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry
            .addHandler(blindRelay, "/ws/notes/{noteId}")
            .addInterceptors(
                JwtQueryTokenInterceptor(
                    template = "/ws/notes/{noteId}", idVar = "noteId",
                    roomKeyOf = RoomKey::note, jwtProvider = jwtProvider,
                    access = { noteId, userId -> noteAccess.canCollaborate(noteId, userId) },
                ),
            )
            .setAllowedOriginPatterns(*origins())
    }

    /** Bump the binary buffer to 1 MB (Tomcat defaults 8 KB) for full Yjs frames.
     *  Guarded so MOCK test contexts (no real servlet container) don't fail. */
    @Bean
    @Conditional(OnRealServletContainerCondition::class)
    fun createWebSocketContainer(): ServletServerContainerFactoryBean =
        ServletServerContainerFactoryBean().apply { setMaxBinaryMessageBufferSize(1024 * 1024) }
}

class OnRealServletContainerCondition : Condition {
    override fun matches(context: ConditionContext, metadata: AnnotatedTypeMetadata): Boolean =
        context.resourceLoader is ServletWebServerApplicationContext
}
```

- [ ] **Step 6: Delete the four superseded note/collab classes**

```bash
git rm src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabRoomRegistry.kt \
       src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollaborationHandler.kt \
       src/main/kotlin/com/shareddocs/backend/note/collab/NoteCollabHandshakeInterceptor.kt \
       src/main/kotlin/com/shareddocs/backend/note/collab/WebSocketConfig.kt
```

- [ ] **Step 7: Update `NoteService` to use the generic registry**

In `NoteService.kt` change the injected field (line ~35):

```kotlin
    private val collabRoomRegistry: com.shareddocs.backend.collab.CollabRoomRegistry,
```

Update the two call sites (lines ~138 and ~151):

```kotlin
        if (flippingToPrivate) collabRoomRegistry.closeRoom(com.shareddocs.backend.collab.RoomKey.note(note.id!!), note.createdBy.id)
```

```kotlin
        collabRoomRegistry.closeRoom(com.shareddocs.backend.collab.RoomKey.note(id), null)
```

(If `NoteCollabForceCloseTest` autowires `NoteCollabRoomRegistry`, update it to autowire `com.shareddocs.backend.collab.CollabRoomRegistry` and assert via `RoomKey.note(id)`. Do not change what it asserts — only the type/key.)

- [ ] **Step 8: Run the full notes-collab suite for parity**

Run: `./gradlew test --tests 'com.shareddocs.backend.note.collab.*' --tests 'com.shareddocs.backend.collab.*'`
Expected: PASS — same test count as Step 1, plus Task 1's registry tests. If the integration test fails to connect, confirm `CollabWebSocketConfig` registered `/ws/notes/{noteId}` and the origin patterns match.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(collab): retrofit notes relay onto shared registry/handler/interceptor seam"
```

---

### Task 3: Decisions presence endpoint `/ws/plans/{planId}`

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanPresenceAccessService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/collab/CollabWebSocketConfig.kt` (add the plan handler registration)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanPresenceHandshakeTest.kt`

**Interfaces:**
- Consumes: `BlindRelayHandler`, `JwtQueryTokenInterceptor`, `RoomKey::plan`; `PlanRepository.findByIdAndWorkspaceId`? — no; presence needs plan→workspace then membership. Use `PlanRepository.findById` (plan carries `workspaceId`) + `WorkspaceService.isActiveMember`.
- Produces: `PlanPresenceAccessService.canView(planId, userId): Boolean`.

- [ ] **Step 1: Write the failing handshake test** (mirrors `NoteCollaborationHandlerIntegrationTest`)

`PlanPresenceHandshakeTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.JwtProvider
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.BinaryWebSocketHandler
import java.util.UUID
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PlanPresenceHandshakeTest(
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val jwtProvider: JwtProvider,
) {
    @LocalServerPort private var port: Int = 0
    private fun user() = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    @Test
    fun `active member connects to a plan presence room`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val client = StandardWebSocketClient()
        val url = "ws://localhost:$port/ws/plans/${plan.id}?token=${jwtProvider.issue(owner)}"
        val session = client.execute(BinaryWebSocketHandler(), url).get(2, TimeUnit.SECONDS)
        session.close()
    }

    @Test
    fun `non-member is rejected from a plan presence room`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W2", "w2-${UUID.randomUUID().toString().take(8)}")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val stranger = user()
        val client = StandardWebSocketClient()
        val url = "ws://localhost:$port/ws/plans/${plan.id}?token=${jwtProvider.issue(stranger)}"
        assertThrows(ExecutionException::class.java) {
            client.execute(BinaryWebSocketHandler(), url).get(2, TimeUnit.SECONDS)
        }
    }
}
```

(Confirm `CreatePlanRequest` has a single required `title`; if it needs `description`/`groupLabel`, pass nulls per its actual signature in `DecisionDto.kt`.)

- [ ] **Step 2: Run to confirm it fails**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.PlanPresenceHandshakeTest'`
Expected: both connects fail (endpoint not registered) — the "active member" test fails, proving the endpoint is missing.

- [ ] **Step 3: Implement `PlanPresenceAccessService`**

`PlanPresenceAccessService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.workspace.WorkspaceService
import org.springframework.stereotype.Service

/** Gate for joining a plan's presence room: active membership of the plan's
 *  workspace — the same rule the REST decisions endpoints enforce. */
@Service
class PlanPresenceAccessService(
    private val planRepository: PlanRepository,
    private val workspaceService: WorkspaceService,
) {
    fun canView(planId: Long, userId: Long): Boolean {
        val plan = planRepository.findById(planId).orElse(null) ?: return false
        if (plan.deletedAt != null) return false
        return workspaceService.isActiveMember(plan.workspaceId, userId)
    }
}
```

- [ ] **Step 4: Register the plan endpoint in `CollabWebSocketConfig`**

Add the `PlanPresenceAccessService` constructor param and a second registration in `registerWebSocketHandlers` (after the notes block):

```kotlin
    private val planAccess: PlanPresenceAccessService,
```

```kotlin
        registry
            .addHandler(blindRelay, "/ws/plans/{planId}")
            .addInterceptors(
                JwtQueryTokenInterceptor(
                    template = "/ws/plans/{planId}", idVar = "planId",
                    roomKeyOf = RoomKey::plan, jwtProvider = jwtProvider,
                    access = { planId, userId -> planAccess.canView(planId, userId) },
                ),
            )
            .setAllowedOriginPatterns(*origins())
```

- [ ] **Step 5: Run to confirm it passes**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.PlanPresenceHandshakeTest'`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(decisions): plan presence WebSocket endpoint (Yjs awareness)"
```

---

### Task 4: Decisions change signal — publisher + AFTER_COMMIT listener + signal handler

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionsChanged.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionChangePublisher.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionsChangeListener.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionsSignalHandler.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/collab/CollabWebSocketConfig.kt` (register `/ws/decisions/{workspaceId}`)
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionsSignalAccessService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/DecisionsChangeSignalTest.kt`

**Interfaces:**
- Consumes: `CollabRoomRegistry.broadcast`, `RoomKey::workspace`, `ApplicationEventPublisher`, `ObjectMapper`, `WorkspaceService.isActiveMember`.
- Produces: `DecisionsChanged(workspaceId: Long, planId: Long?)`; `DecisionChangePublisher.publish(workspaceId: Long, planId: Long? = null)`; a WS at `/ws/decisions/{workspaceId}` that emits `{"planId": N|null}` text frames after each Decisions write commits.

- [ ] **Step 1: Write the failing integration test**

`DecisionsChangeSignalTest.kt` — proves (a) a committed write pushes one frame to a connected member, and (b) a rolled-back write pushes nothing.

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.JwtProvider
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.UUID
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class DecisionsChangeSignalTest(
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val jwtProvider: JwtProvider,
) {
    @LocalServerPort private var port: Int = 0
    private fun user() = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    private fun connect(wsId: Long, token: String, sink: LinkedBlockingQueue<String>): WebSocketSession {
        val handler = object : TextWebSocketHandler() {
            override fun handleTextMessage(session: WebSocketSession, message: TextMessage) { sink.add(message.payload) }
        }
        return StandardWebSocketClient()
            .execute(handler, "ws://localhost:$port/ws/decisions/$wsId?token=$token").get(2, TimeUnit.SECONDS)
    }

    @Test
    fun `a committed plan write broadcasts one change frame to a connected member`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val frames = LinkedBlockingQueue<String>()
        val session = connect(ws.id!!, jwtProvider.issue(owner), frames)
        Thread.sleep(200) // let the join land

        planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P")) // @Transactional → AFTER_COMMIT

        val frame = frames.poll(2, TimeUnit.SECONDS)
        assertEquals(true, frame != null && frame.contains("planId"))
        session.close(CloseStatus.NORMAL)
    }

    @Test
    fun `a rolled-back write broadcasts nothing`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W2", "w2-${UUID.randomUUID().toString().take(8)}")
        val frames = LinkedBlockingQueue<String>()
        val session = connect(ws.id!!, jwtProvider.issue(owner), frames)
        Thread.sleep(200)

        // getTree on a missing plan throws inside a @Transactional read → no commit, no publish.
        runCatching { planService.getTree(ws.id!!, 999_999L) }

        assertNull(frames.poll(1, TimeUnit.SECONDS))
        session.close(CloseStatus.NORMAL)
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.DecisionsChangeSignalTest'`
Expected: the first test fails (no endpoint / no publish yet). (`getTree` doesn't publish, so the second may pass vacuously — that's fine; it becomes meaningful once publishing exists.)

- [ ] **Step 3: Implement the event + publisher**

`DecisionsChanged.kt`:

```kotlin
package com.shareddocs.backend.decision

/** Emitted after a Decisions write. planId is best-effort narrowing metadata;
 *  clients invalidate the whole workspace decisions scope regardless. */
data class DecisionsChanged(val workspaceId: Long, val planId: Long?)
```

`DecisionChangePublisher.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Component

/** Called at the end of each Decisions write (inside the service transaction);
 *  the AFTER_COMMIT listener turns this into a WS broadcast only if the tx commits. */
@Component
class DecisionChangePublisher(private val events: ApplicationEventPublisher) {
    fun publish(workspaceId: Long, planId: Long? = null) {
        events.publishEvent(DecisionsChanged(workspaceId, planId))
    }
}
```

- [ ] **Step 4: Implement the AFTER_COMMIT listener**

`DecisionsChangeListener.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.fasterxml.jackson.databind.ObjectMapper
import com.shareddocs.backend.collab.CollabRoomRegistry
import com.shareddocs.backend.collab.RoomKey
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener
import org.springframework.web.socket.TextMessage

@Component
class DecisionsChangeListener(
    private val registry: CollabRoomRegistry,
    private val objectMapper: ObjectMapper,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onChange(event: DecisionsChanged) {
        val payload = objectMapper.writeValueAsString(mapOf("planId" to event.planId))
        registry.broadcast(RoomKey.workspace(event.workspaceId), TextMessage(payload))
    }
}
```

- [ ] **Step 5: Implement the signal handler + access service**

`DecisionsSignalAccessService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.workspace.WorkspaceService
import org.springframework.stereotype.Service

/** Gate for the workspace-wide decisions change feed: active membership. */
@Service
class DecisionsSignalAccessService(private val workspaceService: WorkspaceService) {
    fun canListen(workspaceId: Long, userId: Long): Boolean =
        workspaceService.isActiveMember(workspaceId, userId)
}
```

`DecisionsSignalHandler.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.collab.CollabRoomRegistry
import com.shareddocs.backend.collab.RoomKey
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

/**
 * Server-originated change feed for a workspace's Decisions. Clients connect and
 * listen; they send nothing. Broadcasts are driven by [DecisionsChangeListener].
 */
@Component
class DecisionsSignalHandler(private val registry: CollabRoomRegistry) : TextWebSocketHandler() {

    private fun room(session: WebSocketSession) = session.attributes["roomKey"] as RoomKey

    override fun afterConnectionEstablished(session: WebSocketSession) = registry.join(room(session), session)

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) = registry.leave(room(session), session)
}
```

- [ ] **Step 6: Register `/ws/decisions/{workspaceId}` in `CollabWebSocketConfig`**

Add constructor params and a registration block:

```kotlin
    private val signalHandler: DecisionsSignalHandler,
    private val signalAccess: DecisionsSignalAccessService,
```

```kotlin
        registry
            .addHandler(signalHandler, "/ws/decisions/{workspaceId}")
            .addInterceptors(
                JwtQueryTokenInterceptor(
                    template = "/ws/decisions/{workspaceId}", idVar = "workspaceId",
                    roomKeyOf = RoomKey::workspace, jwtProvider = jwtProvider,
                    access = { wsId, userId -> signalAccess.canListen(wsId, userId) },
                ),
            )
            .setAllowedOriginPatterns(*origins())
```

- [ ] **Step 7: Wire ONE publish call so the test goes green — `PlanService.create`**

In `PlanService`, add the constructor dependency and one call (full wiring is Task 5):

```kotlin
    private val changes: DecisionChangePublisher,
```

At the end of `create`, before `return`:

```kotlin
        changes.publish(workspaceId, plan.id)
```

- [ ] **Step 8: Run to confirm it passes**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.DecisionsChangeSignalTest'`
Expected: PASS (2 tests) — committed create pushes a frame; rollback pushes none.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(decisions): AFTER_COMMIT change signal over /ws/decisions/{workspaceId}"
```

---

### Task 5: Wire the publisher into every remaining Decisions write path

**Files:**
- Modify: `PlanService.kt`, `VoteService.kt`, `RatingService.kt`, `DecisionService.kt`, `EdgeService.kt`, `PlanDiscussionService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/DecisionChangeCoverageTest.kt`

**Interfaces:**
- Consumes: `DecisionChangePublisher.publish(workspaceId, planId?)`.

**Publish rule:** call `changes.publish(workspaceId, <planId>)` at the end of each write, before the return / after the last mutation. Use the planId already in scope; pass `null` where only an option/subplan is loaded (the client invalidates the whole workspace scope regardless — planId is narrowing metadata only). Exact call per method:

| Service / method | Call to add |
|---|---|
| `PlanService.create` | *(done in Task 4)* `changes.publish(workspaceId, plan.id)` |
| `PlanService.lock` / `unlock` / `complete` / `uncomplete` | `changes.publish(workspaceId, planId)` |
| `PlanService.discard` / `restore` | `changes.publish(workspaceId, planId)` |
| `PlanService.setPlanDeadline` / `clearPlanDeadline` | `changes.publish(workspaceId, planId)` |
| `PlanService.update` | `changes.publish(workspaceId, planId)` |
| `PlanService.deleteForever` | `changes.publish(workspaceId, planId)` |
| `PlanService.addSubPlan` | `changes.publish(workspaceId, planId)` |
| `PlanService.updateSubPlan` | `changes.publish(workspaceId, subPlan.planId)` |
| `PlanService.setSubPlanDeadline` / `clearSubPlanDeadline` | `changes.publish(workspaceId, subPlan.planId)` |
| `PlanService.reorderSubPlans` | `changes.publish(workspaceId, planId)` |
| `PlanService.deleteSubPlan` | `changes.publish(workspaceId, subPlan.planId)` |
| `PlanService.addOption` | `changes.publish(workspaceId, subPlan.planId)` |
| `PlanService.updateOption` / `deleteOption` | `changes.publish(workspaceId, null)` |
| `VoteService.cast` / `retract` | `changes.publish(workspaceId, null)` |
| `RatingService.upsert` / `delete` | `changes.publish(workspaceId, null)` |
| `DecisionService.lock` / `reopen` | `changes.publish(workspaceId, null)` |
| `EdgeService.create` | `changes.publish(workspaceId, planId)` |
| `EdgeService.delete` | `changes.publish(workspaceId, edge.planId)` |
| `PlanDiscussionService.ensureDiscussionNote` | `changes.publish(workspaceId, planId)` |

> **Deliberately NOT wired:** canvas-drag persistence is `PlanService.updateSubPlan` with only `canvasX/canvasY` set — but `updateSubPlan` also handles title/desc/sortOrder edits, so it publishes. That means a drag *does* currently emit a signal. To keep drag silent (design decision #6: live drag is out of scope, and a workspace-wide refetch per drag frame is wasteful), the frontend debounces drag to `onNodeDragStop` (already true) — one signal per drag-end is acceptable and self-corrects; do NOT add special-casing in the service. Note this in the commit message so it's a recorded choice, not an oversight.

- [ ] **Step 1: Write the failing coverage test**

`DecisionChangeCoverageTest.kt` — asserts representative writes across all services each emit exactly one `DecisionsChanged`. Uses a `@SpyBean`/recording listener on the application event.

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationListener
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.test.context.ActiveProfiles
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

@SpringBootTest
@ActiveProfiles("test")
class DecisionChangeCoverageTest(
    @Autowired private val planService: PlanService,
    @Autowired private val voteService: VoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val recorder: Recorder,
) {
    @Configuration
    class Rec {
        @Bean fun recorder() = Recorder()
    }
    class Recorder : ApplicationListener<DecisionsChanged> {
        val events = CopyOnWriteArrayList<DecisionsChanged>()
        override fun onApplicationEvent(event: DecisionsChanged) { events.add(event) }
    }

    private fun user() = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))

    @Test
    fun `plan create, subplan add, option add, and vote each emit exactly one change`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")

        recorder.events.clear()
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        assertEquals(1, recorder.events.size)

        recorder.events.clear()
        val sp = planService.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "S"))
        assertEquals(1, recorder.events.size)

        recorder.events.clear()
        val opt = planService.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "O"))
        assertEquals(1, recorder.events.size)

        recorder.events.clear()
        voteService.cast(ws.id!!, opt.id, owner.id!!)
        assertEquals(1, recorder.events.size)
    }
}
```

> Note: `ApplicationListener<DecisionsChanged>` fires on publish (not gated by AFTER_COMMIT), so it records regardless of the `@SpringBootTest` MOCK transaction. Confirm the DTO field names (`CreateSubPlanRequest`, `CreateOptionRequest`, and the `.id` accessors on the responses) against `DecisionDto.kt`; adjust if they differ.

- [ ] **Step 2: Run to confirm it fails**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.DecisionChangeCoverageTest'`
Expected: FAIL — `addSubPlan`/`addOption`/`cast` emit 0 events (only `create` is wired from Task 4).

- [ ] **Step 3: Add the `DecisionChangePublisher` dependency + publish calls per the table above**

For each service, add `private val changes: DecisionChangePublisher,` to the constructor and insert the call from the table at the end of each listed method (after the last mutation, before `return` where there is one). Example (`VoteService.cast`, after the `save`):

```kotlin
        optionVoteRepository.save(
            OptionVote(workspaceId = workspaceId, subPlanId = option.subPlanId, optionId = option.id!!, userId = userId),
        )
        changes.publish(workspaceId, null)
```

Example (`PlanService.addSubPlan`, before `return subPlan.toResponse(...)`):

```kotlin
        changes.publish(workspaceId, planId)
        return subPlan.toResponse(options = emptyList(), decision = null)
```

Apply every row of the table.

- [ ] **Step 4: Run to confirm the coverage test passes**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.DecisionChangeCoverageTest'`
Expected: PASS.

- [ ] **Step 5: Run the whole backend suite**

Run: `./gradlew test`
Expected: PASS (all decision + collab + note tests green).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(decisions): publish change signal from every write path

Canvas drag (updateSubPlan with only canvasX/Y) intentionally still emits
one signal per drag-end; not special-cased — live drag is out of scope and
a debounced onNodeDragStop keeps it to one refetch."
```

---

# PART B — Frontend

### Task 6: `useDecisionsChangeFeed` hook

**Files:**
- Create: `src/features/decisions/collab/wsBase.ts`
- Create: `src/features/decisions/collab/useDecisionsChangeFeed.ts`

**Interfaces:**
- Consumes: `getToken` from `../../../auth/tokenStorage`; `decisionKeys.scope` from `../api`; `useQueryClient`.
- Produces: `useDecisionsChangeFeed(workspaceId: number | null): void`.

- [ ] **Step 1: Implement `wsBase.ts`**

```ts
// Derive the WS origin from the REST base URL (never window.location) — prod
// frontend (Vercel) and backend (Cloudflare Tunnel) are different hosts. Same
// rule as notes' useNoteCollaboration.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? API_BASE.replace(/^http/, 'ws')
```

- [ ] **Step 2: Implement `useDecisionsChangeFeed.ts`**

```ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken } from '../../../auth/tokenStorage'
import { decisionKeys } from '../api'
import { WS_BASE } from './wsBase'

/**
 * Subscribes to the workspace's Decisions change feed. On connect and on every
 * server frame, invalidates the whole decisions scope so React Query refetches —
 * the same invalidation local mutations already do, now triggered by peers'
 * writes too. The socket is a hint, never a guarantee: the invalidate-on-open
 * (and on every reconnect) means a dropped frame or a backend restart only
 * leaves the client stale until its next reconnect. No-op when no active
 * workspace or no auth token.
 */
export function useDecisionsChangeFeed(workspaceId: number | null): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (workspaceId == null) return
    const token = getToken()
    if (!token) return

    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let closed = false

    const invalidate = () => qc.invalidateQueries({ queryKey: decisionKeys.scope(workspaceId) })

    const connect = () => {
      socket = new WebSocket(`${WS_BASE}/ws/decisions/${workspaceId}?token=${encodeURIComponent(token)}`)
      socket.onopen = () => {
        attempt = 0
        invalidate() // catch anything missed while disconnected
      }
      socket.onmessage = () => invalidate()
      socket.onclose = () => {
        if (closed) return
        const delay = Math.min(1000 * 2 ** attempt, 15000)
        attempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }
    }
    connect()

    return () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [workspaceId, qc])
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/collab`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/collab
git commit -m "feat(decisions): useDecisionsChangeFeed — invalidate on peer writes + reconnect"
```

---

### Task 7: Mount the change feed once for both decisions routes

**Files:**
- Create: `src/features/decisions/collab/DecisionsCollabBoundary.tsx`
- Modify: `src/App.tsx:73-74`

**Interfaces:**
- Consumes: `useDecisionsChangeFeed`, `useActiveWorkspace().activeId`, `Outlet`.

- [ ] **Step 1: Implement `DecisionsCollabBoundary.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { useActiveWorkspace } from '../../../auth/useActiveWorkspace'
import { useDecisionsChangeFeed } from './useDecisionsChangeFeed'

/**
 * Route boundary that keeps one Decisions change-feed socket open for the whole
 * /decisions section (board + open plan), so both stay live and the socket
 * follows navigation between them without reconnecting.
 */
export default function DecisionsCollabBoundary() {
  const { activeId } = useActiveWorkspace()
  useDecisionsChangeFeed(activeId)
  return <Outlet />
}
```

- [ ] **Step 2: Wrap the decisions routes in `App.tsx`**

Add a lazy import alongside the others (near line 22):

```tsx
const DecisionsCollabBoundary = lazy(() => import('./features/decisions/collab/DecisionsCollabBoundary'))
```

Replace lines 73–74:

```tsx
            <Route path="/decisions" element={<DecisionList />} />
            <Route path="/decisions/:planId" element={<PlanDetail />} />
```

with:

```tsx
            <Route element={<DecisionsCollabBoundary />}>
              <Route path="/decisions" element={<DecisionList />} />
              <Route path="/decisions/:planId" element={<PlanDetail />} />
            </Route>
```

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions src/App.tsx && npm run build`
Expected: 0 errors, build succeeds.

- [ ] **Step 4: Manual smoke (two browsers, same workspace)**

Open `/decisions` in browser A and B (two accounts in one workspace). In A, create a plan / add a 안건 / add a 선택지 / cast a vote / set a deadline / lock a plan. Each should appear in B within ~1s without a manual refresh. Open a plan in both, edit in A, confirm B updates.

- [ ] **Step 5: Commit**

```bash
git add src/features/decisions/collab/DecisionsCollabBoundary.tsx src/App.tsx
git commit -m "feat(decisions): mount change feed across the decisions section"
```

---

### Task 8: Plan presence — `DecisionPresenceStack`

**Files:**
- Create: `src/features/decisions/collab/DecisionPresenceStack.tsx`
- Create: `src/features/decisions/collab/DecisionPresenceStack.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx` (render the stack in the control strip)

**Interfaces:**
- Consumes: `WebsocketProvider` from `y-websocket`, `Y.Doc` from `yjs`, `getToken`, `WS_BASE`, `collabColorForUser` from `../../notes/collab/collabColor`, `useAuth`.
- Produces: `<DecisionPresenceStack planId={number} />`.

- [ ] **Step 1: Implement `DecisionPresenceStack.tsx`** (self-contained: owns its awareness provider; sets peers from awareness `change` events — allowed, not setState-in-effect)

```tsx
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getToken } from '../../../auth/tokenStorage'
import { useAuth } from '../../../auth/useAuth'
import { collabColorForUser } from '../../notes/collab/collabColor'
import { WS_BASE } from './wsBase'
import styles from './DecisionPresenceStack.module.css'

type PeerUser = { name: string; color: string }
type Peer = PeerUser & { clientId: number }

/** Avatar stack of the other members currently viewing this plan. Awareness-only
 *  Yjs channel (empty Y.Doc) — the same machinery notes uses, so live cursors /
 *  canvas-drag can later be added as extra awareness fields on this connection. */
export default function DecisionPresenceStack({ planId }: { planId: number }) {
  const { user } = useAuth()
  const [peers, setPeers] = useState<Peer[]>([])
  const providerRef = useRef<WebsocketProvider | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token || !user) return

    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(`${WS_BASE}/ws/plans`, String(planId), yDoc, { params: { token } })
    providerRef.current = provider
    provider.awareness.setLocalStateField('user', { name: user.name, color: collabColorForUser(user.userId) })

    const update = () => {
      const localId = provider.awareness.clientID
      const entries = Array.from(provider.awareness.getStates().entries()) as Array<[number, { user?: PeerUser }]>
      setPeers(
        entries
          .filter(([clientId]) => clientId !== localId)
          .flatMap(([clientId, state]) => (state.user ? [{ ...state.user, clientId }] : [])),
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

- [ ] **Step 2: Implement `DecisionPresenceStack.module.css`** (mirrors the notes avatar stack)

```css
.stack {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--r-pill);
  border: 1.5px solid;
  background: var(--c-surface);
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  line-height: 1;
  user-select: none;
}

.avatar + .avatar {
  margin-left: -6px;
}
```

- [ ] **Step 3: Render it in `PlanDetail.tsx`**

Import at the top:

```tsx
import DecisionPresenceStack from './collab/DecisionPresenceStack'
```

In the sticky control strip (near the `Tabs` control around line 318, where the plan title/controls render), add the stack, passing the numeric plan id already in scope (the `planId` route param parsed to a number — reuse the same value `usePlanTree(planId)` receives):

```tsx
        <DecisionPresenceStack planId={planId} />
```

Place it in the control strip's right-aligned area next to the view tabs (match the existing strip layout; do not introduce a shadowed container).

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions && npm run build`
Expected: 0 errors, build succeeds.

- [ ] **Step 5: Manual smoke**

Two accounts, same workspace. B opens `/decisions/:planId`; A (viewing the same plan) sees B's avatar appear. B navigates away → avatar disappears within ~1s. Confirm the caret color matches `collabColorForUser` (same person, same hue as their notes cursor).

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/collab/DecisionPresenceStack.tsx src/features/decisions/collab/DecisionPresenceStack.module.css src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): plan presence avatar stack (Yjs awareness)"
```

---

### Task 9 (optional, severable): Discussion-note live collaboration

> Skip this task if you want to ship the structured-data sync alone. It reuses the shipped notes mechanism verbatim to make the plan discussion note collaborative. Decide at execution time.

**Files:**
- Modify: `src/features/decisions/DiscussionPane.tsx` (the `EditorSection`, ~lines 48-56)

**Interfaces:**
- Consumes: `useNoteCollaboration` from `../notes/collab/useNoteCollaboration`; `CollabAvatarStack` from `../notes/collab/CollabAvatarStack`; `collabColorForUser`; `useAuth`.

- [ ] **Step 1: Wire collaboration into `EditorSection`**

At the top of `EditorSection`:

```tsx
  const { user } = useAuth()
  const collab = useNoteCollaboration(note.id, note.visibility === 'WORKSPACE')
  const collabUser = user ? { name: user.name, color: collabColorForUser(user.userId) } : undefined
```

Pass them into the existing `NoteEditorBody`:

```tsx
        <NoteEditorBody
          noteId={note.id}
          initialBody={note.body}
          canEdit
          minimal
          collab={collab}
          collabUser={collabUser}
          onBodyChange={(html) => scheduleSave({ body: html })}
          registerEditor={() => {}}
          onRequestLinkDialog={() => {}}
        />
```

Render the avatar stack above/below the editor when collab is active:

```tsx
        {collab && <CollabAvatarStack provider={collab.provider} />}
```

- [ ] **Step 2: Type-check, lint, build**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions && npm run build`
Expected: 0 errors. (Confirm `NoteEditorBody`'s `collab`/`collabUser` props are exported/optional — they are, per the notes editor wiring.)

- [ ] **Step 3: Manual smoke**

Two accounts open the same plan's discussion pane; concurrent typing merges live with colored cursors, exactly like a shared note.

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/DiscussionPane.tsx
git commit -m "feat(decisions): live collaboration on the plan discussion note"
```

---

## Final verification

- [ ] **Backend:** `./gradlew test` — all green (collab seam, notes parity, plan presence, change signal, coverage).
- [ ] **Frontend:** `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions src/features/notes` 0 new errors; `npm run build` succeeds.
- [ ] **Notes regression (retrofit):** re-run the 2026-07-02 notes manual smoke — two-account concurrent edit merges, cursors show, kill-backend reconnect resyncs, flip-to-PRIVATE kicks the non-author, soft-delete shows "note not found".
- [ ] **Decisions end-to-end:** every write kind in Task 7 Step 4 propagates live; presence appears/drops (Task 8 Step 5); a non-member cannot open `/ws/plans/{id}` or `/ws/decisions/{wsId}`; killing the backend mid-session reconnects and the connect-refetch catches missed changes.
- [ ] Update `CLAUDE.md` + `docs/ROADMAP.md` with a dated "shipped" line (mirror the 2026-07-02 notes entry), and add the design doc's long-term note about the shared collab seam + two pre-seamed deferrals (live canvas-drag; cross-instance fan-out in the scaling lab).

---

## Self-review (completed against the spec)

- **Spec coverage:** invalidate+refetch mechanism → Tasks 4–7; Yjs-awareness presence → Task 8; shared seam + notes retrofit → Tasks 1–2; plan-presence endpoint → Task 3; AFTER_COMMIT → Task 4; refetch-on-reconnect self-healing → Task 6 (`invalidate` in `onopen`); publisher coverage incl. the easy-to-forget votes/ratings/edges → Task 5 + coverage test; two-socket topology → Tasks 7 (ws signal) + 8 (plan presence); discussion-note fold-in → Task 9. Conflict handling unchanged (no task needed — existing 409 path). Out-of-scope items (live drag, delta-push, cross-instance) have no tasks by design.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `RoomKey.note/plan/workspace`, `CollabRoomRegistry.{join,leave,relay,broadcast,closeRoom}`, `CollabAccessPredicate.canAccess`, `DecisionChangePublisher.publish(workspaceId, planId?)`, `useDecisionsChangeFeed(workspaceId)`, `WS_BASE`, `DecisionPresenceStack({planId})` are used consistently across tasks.
- **Verify-at-execution flags:** DTO field names (`CreatePlanRequest`/`CreateSubPlanRequest`/`CreateOptionRequest` and response `.id` accessors) and `NoteCollabForceCloseTest`'s autowired type/`NoteEditorBody` prop names are the two spots to confirm against source when the touching task runs — called out inline.
