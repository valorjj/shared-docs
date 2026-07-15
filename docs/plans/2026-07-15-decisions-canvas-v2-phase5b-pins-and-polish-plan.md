# Phase 5b — Canvas-Pinned Comments + Canvas Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free-floating comment pins to the Decisions canvas (create/reply/drag/resolve/delete), and fix the canvas polish issues found in P5a smoke (always-land-canvas, working right-click, non-overlapping dagre layout, 캔버스에서 보기 button).

**Architecture:** Backend adds a `comment_pins` table (Flyway V29) whose thread reuses the existing `comments` system keyed `pageId = pin:{id}`; pins are created atomically with their first comment. Frontend renders pins as draggable React Flow custom nodes kept live via a sync effect (mirroring P5a's peer-drag effect), created from a right-click pane menu and read/managed in the Phase-3 slide-in Panel. Canvas fixes: always land on canvas, wire `onPaneContextMenu`/`onNodeContextMenu`, and a dagre layered auto-layout for un-positioned nodes.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + Flyway + MariaDB (BE); React 19 + TS + Vite + `@xyflow/react` v12 + `@tanstack/react-query` v5 + `@dagrejs/dagre` (FE).

## Global Constraints

- **Two repos.** BE tasks (1–3) in `shared-docs-backend` on branch `decisions-p5b-pins` (git identity `valorjj`; this machine = CD runner). FE tasks (4–11) in `shared-docs` on branch `decisions-p5b-pins`.
- **BE gate:** `./gradlew build` (compiles + runs the test suite; Flyway `ddl-auto: validate` means the entity must match the migration exactly). Write real JUnit tests for BE tasks.
- **FE gate:** `npm run build` (`tsc -b && vite build`) passes + `npx eslint <touched files>` clean. **No FE unit-test runner exists — do not add one.**
- **Portfolio-grade BE:** Flyway migration, FK constraints `ON DELETE RESTRICT` + app-level cascade cleanup, optimistic locking (`@Version` via `BaseEntity`), RFC-7807 via `ApiException`, `ddl-validate`. MariaDB/MySQL SQL dialect: `bigint(20) ... AUTO_INCREMENT` PK, `datetime(6)` timestamps (no default), `double`, `tinyint(1)` for boolean, `version bigint(20) NOT NULL DEFAULT 0`, all FKs `ON DELETE RESTRICT`, `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`, backtick snake_case names.
- **Lock stance:** pin create / reply / resolve / delete are **NOT** lock-gated (discussion continues on locked plans). Only pin **move** (position) is lock-gated via `PlanLockGuard`.
- **Bear-minimal FE:** hairlines, no shadow/lift, Lucide icons only (never emoji), Korean UI text, `--c-*`/`--sp-*`/`--r-*` tokens (peer/pin colors excepted).
- **Commit after each task. Do NOT push or deploy** — the user pushes/deploys explicitly, and the live V29 Flyway migration must be confirmed with the user before running on prod.
- BE reuse: `BaseEntity` (id/`@Version version`/createdAt/updatedAt), `@CurrentWorkspace ws: Workspace` (pass `ws.id!!`), `@AuthenticationPrincipal me: AppPrincipal` (`me.userId`), `PlanLockGuard`, `DecisionChangePublisher.publish(workspaceId, planId)`, `ApiException(status, code, detail)`.

---

## SLICE A — Backend (shared-docs-backend, branch `decisions-p5b-pins`)

### Task 1: V29 migration + `CommentPin` entity + repositories

**Files:**
- Create: `src/main/resources/db/migration/V29__comment_pins.sql`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/CommentPin.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/CommentPinRepository.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/comment/CommentRepository.kt` (add a count method)

**Interfaces:**
- Produces (Tasks 2–3): entity `CommentPin` (fields `workspaceId, planId, canvasX, canvasY, resolved, createdBy` + `BaseEntity` id/version/timestamps); `CommentPinRepository.{findAllByPlanId, findByIdAndWorkspaceId, deleteAllByPlanId}`; `CommentRepository.countByWorkspaceIdAndPageId(workspaceId, pageId): Long`.

- [ ] **Step 1: Write the migration**

Create `V29__comment_pins.sql`:

```sql
-- Decisions Canvas v2 (Phase 5b): free-floating comment pins on the canvas.
-- A pin is an (x,y) anchor hosting a comment thread (comments.page_id = 'pin:{id}').
-- FKs ON DELETE RESTRICT; app deletes the pin:{id} comment thread explicitly.
CREATE TABLE `comment_pins` (
  `id`           bigint(20)  NOT NULL AUTO_INCREMENT,
  `workspace_id` bigint(20)  NOT NULL,
  `plan_id`      bigint(20)  NOT NULL,
  `canvas_x`     double      NOT NULL,
  `canvas_y`     double      NOT NULL,
  `resolved`     tinyint(1)  NOT NULL DEFAULT 0,
  `created_by`   bigint(20)  DEFAULT NULL,
  `version`      bigint(20)  NOT NULL DEFAULT 0,
  `created_at`   datetime(6) NOT NULL,
  `updated_at`   datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_comment_pins_plan` (`plan_id`),
  KEY `idx_comment_pins_workspace` (`workspace_id`),
  CONSTRAINT `fk_comment_pins_plan` FOREIGN KEY (`plan_id`)
      REFERENCES `plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_comment_pins_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_comment_pins_user` FOREIGN KEY (`created_by`)
      REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Write the entity**

Create `CommentPin.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table

@Entity
@Table(
    name = "comment_pins",
    indexes = [
        Index(name = "idx_comment_pins_plan", columnList = "plan_id"),
        Index(name = "idx_comment_pins_workspace", columnList = "workspace_id"),
    ],
)
class CommentPin(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,
    @Column(name = "plan_id", nullable = false, updatable = false)
    val planId: Long,
    @Column(name = "canvas_x", nullable = false)
    var canvasX: Double,
    @Column(name = "canvas_y", nullable = false)
    var canvasY: Double,
    @Column(name = "resolved", nullable = false)
    var resolved: Boolean = false,
    @Column(name = "created_by", updatable = false)
    val createdBy: Long? = null,
) : BaseEntity()
```

- [ ] **Step 3: Write the repositories**

Create `CommentPinRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface CommentPinRepository : JpaRepository<CommentPin, Long> {
    fun findAllByPlanId(planId: Long): List<CommentPin>
    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): CommentPin?
    fun deleteAllByPlanId(planId: Long)
}
```

Add to `CommentRepository.kt` (alongside the existing methods):

```kotlin
    fun countByWorkspaceIdAndPageId(workspaceId: Long, pageId: String): Long
```

- [ ] **Step 4: Compile**

Run: `./gradlew compileKotlin compileTestKotlin`
Expected: BUILD SUCCESSFUL. (Full `build`/flyway-validate happens after the service exists in Task 2's test run.)

- [ ] **Step 5: Commit**

```bash
git add src/main/resources/db/migration/V29__comment_pins.sql src/main/kotlin/com/shareddocs/backend/decision/CommentPin.kt src/main/kotlin/com/shareddocs/backend/decision/CommentPinRepository.kt src/main/kotlin/com/shareddocs/backend/comment/CommentRepository.kt
git commit -m "feat(decisions): V29 comment_pins table + entity/repo (P5b task 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 2: `CommentPinService` + DTOs + exception + tests

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/CommentPinService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (add pin DTOs)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt` (add `CommentPinNotFoundException`)
- Create: `src/test/kotlin/com/shareddocs/backend/decision/CommentPinServiceTest.kt`

**Interfaces:**
- Consumes (Task 1): `CommentPin`, `CommentPinRepository`, `CommentRepository.countByWorkspaceIdAndPageId`. Existing: `PlanRepository.findByIdAndWorkspaceId`, `PlanLockGuard.assertUnlockedByPlanId`, `CommentService.create(CreateCommentRequest, workspaceId, callerUserId)`, `CommentRepository.deleteAllByWorkspaceIdAndPageId`, `DecisionChangePublisher.publish`, `PlanNotFoundException`.
- Produces (Task 3): `CommentPinService.{create(wsId, planId, callerUserId, req), move(wsId, pinId, req), setResolved(wsId, pinId, req), delete(wsId, pinId)}`; DTOs `CreateCommentPinRequest{content,x,y}`, `MoveCommentPinRequest{x,y}`, `ResolveCommentPinRequest{resolved}`, `CommentPinResponse{id,x,y,resolved,commentCount,createdBy}`.

- [ ] **Step 1: Add DTOs + exception**

Append to `DecisionDto.kt` (match its existing imports; add `jakarta.validation.constraints.NotBlank`/`Size` if not present):

```kotlin
data class CreateCommentPinRequest(
    @field:NotBlank @field:Size(max = 2000) val content: String,
    val x: Double,
    val y: Double,
)
data class MoveCommentPinRequest(val x: Double, val y: Double)
data class ResolveCommentPinRequest(val resolved: Boolean)
data class CommentPinResponse(
    val id: Long,
    val x: Double,
    val y: Double,
    val resolved: Boolean,
    val commentCount: Long,
    val createdBy: Long?,
)
```

Append to `DecisionExceptions.kt` (match the existing `ApiException(status, code, detail)` pattern used by `OptionFlowEdgeNotFoundException`):

```kotlin
class CommentPinNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "comment-pin-not-found", "댓글 핀을 찾을 수 없어요.")
```

- [ ] **Step 2: Write the service**

Create `CommentPinService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.comment.CommentRepository
import com.shareddocs.backend.comment.CommentService
import com.shareddocs.backend.comment.CreateCommentRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class CommentPinService(
    private val commentPinRepository: CommentPinRepository,
    private val planRepository: PlanRepository,
    private val lockGuard: PlanLockGuard,
    private val commentService: CommentService,
    private val commentRepository: CommentRepository,
    private val changes: DecisionChangePublisher,
) {
    /** Create a pin AND its first comment atomically. NOT lock-gated (discussion). */
    fun create(workspaceId: Long, planId: Long, callerUserId: Long, request: CreateCommentPinRequest): CommentPinResponse {
        planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()
        val pin = commentPinRepository.save(
            CommentPin(workspaceId = workspaceId, planId = planId, canvasX = request.x, canvasY = request.y, createdBy = callerUserId),
        )
        commentService.create(CreateCommentRequest(pageId = "pin:${pin.id}", content = request.content), workspaceId, callerUserId)
        changes.publish(workspaceId, planId)
        return toResponse(pin)
    }

    /** Move a pin. Lock-gated (canvas position mutation). */
    fun move(workspaceId: Long, pinId: Long, request: MoveCommentPinRequest): CommentPinResponse {
        val pin = commentPinRepository.findByIdAndWorkspaceId(pinId, workspaceId) ?: throw CommentPinNotFoundException()
        lockGuard.assertUnlockedByPlanId(pin.planId)
        pin.canvasX = request.x
        pin.canvasY = request.y
        changes.publish(workspaceId, pin.planId)
        return toResponse(pin)
    }

    /** Resolve/reopen. NOT lock-gated. */
    fun setResolved(workspaceId: Long, pinId: Long, request: ResolveCommentPinRequest): CommentPinResponse {
        val pin = commentPinRepository.findByIdAndWorkspaceId(pinId, workspaceId) ?: throw CommentPinNotFoundException()
        pin.resolved = request.resolved
        changes.publish(workspaceId, pin.planId)
        return toResponse(pin)
    }

    /** Delete a pin and its comment thread. NOT lock-gated. */
    fun delete(workspaceId: Long, pinId: Long) {
        val pin = commentPinRepository.findByIdAndWorkspaceId(pinId, workspaceId) ?: throw CommentPinNotFoundException()
        commentRepository.deleteAllByWorkspaceIdAndPageId(workspaceId, "pin:${pin.id}")
        commentPinRepository.delete(pin)
        changes.publish(workspaceId, pin.planId)
    }

    private fun toResponse(pin: CommentPin) = CommentPinResponse(
        id = pin.id!!,
        x = pin.canvasX,
        y = pin.canvasY,
        resolved = pin.resolved,
        commentCount = commentRepository.countByWorkspaceIdAndPageId(pin.workspaceId, "pin:${pin.id}"),
        createdBy = pin.createdBy,
    )
}
```

- [ ] **Step 3: Write the tests**

Create `CommentPinServiceTest.kt`, following the `OptionFlowEdgeServiceTest` fixture style (`@SpringBootTest @ActiveProfiles("test") @Transactional`, `newUser()`, `workspaces.create`, `plans.create`). Verify the covering behaviors:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.comment.CommentRepository
import com.shareddocs.backend.workspace.WorkspaceService
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CommentPinServiceTest(
    @Autowired private val pins: CommentPinService,
    @Autowired private val plans: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val comments: CommentRepository,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER))
    private data class Fx(val wsId: Long, val ownerId: Long, val planId: Long)
    private fun fx(): Fx {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        return Fx(ws.id!!, owner.id!!, plan.id)
    }

    @Test
    fun `create makes a pin and its first comment atomically`() {
        val f = fx()
        val pin = pins.create(f.wsId, f.planId, f.ownerId, CreateCommentPinRequest(content = "why here?", x = 12.0, y = 34.0))
        assertEquals(1, pin.commentCount)
        assertEquals(12.0, pin.x); assertEquals(34.0, pin.y); assertFalse(pin.resolved)
        assertEquals(1, comments.findByWorkspaceIdAndPageIdOrderByCreatedAtAsc(f.wsId, "pin:${pin.id}").size)
    }

    @Test
    fun `move is refused on a locked plan`() {
        val f = fx()
        val pin = pins.create(f.wsId, f.planId, f.ownerId, CreateCommentPinRequest("c", 0.0, 0.0))
        plans.lock(f.wsId, f.planId, f.ownerId)
        assertThrows(PlanLockedException::class.java) { pins.move(f.wsId, pin.id, MoveCommentPinRequest(9.0, 9.0)) }
    }

    @Test
    fun `resolve is allowed on a locked plan (discussion continues)`() {
        val f = fx()
        val pin = pins.create(f.wsId, f.planId, f.ownerId, CreateCommentPinRequest("c", 0.0, 0.0))
        plans.lock(f.wsId, f.planId, f.ownerId)
        val resolved = pins.setResolved(f.wsId, pin.id, ResolveCommentPinRequest(true))
        assertTrue(resolved.resolved)
    }

    @Test
    fun `delete removes the pin and its comment thread`() {
        val f = fx()
        val pin = pins.create(f.wsId, f.planId, f.ownerId, CreateCommentPinRequest("c", 0.0, 0.0))
        pins.delete(f.wsId, pin.id)
        assertEquals(0, comments.findByWorkspaceIdAndPageIdOrderByCreatedAtAsc(f.wsId, "pin:${pin.id}").size)
        assertThrows(CommentPinNotFoundException::class.java) { pins.move(f.wsId, pin.id, MoveCommentPinRequest(1.0, 1.0)) }
    }

    @Test
    fun `foreign-workspace pin is 404`() {
        val f = fx()
        val pin = pins.create(f.wsId, f.planId, f.ownerId, CreateCommentPinRequest("c", 0.0, 0.0))
        val stranger = newUser()
        val wsB = workspaces.create(stranger.id!!, "WB", "wb")
        assertThrows(CommentPinNotFoundException::class.java) { pins.delete(wsB.id!!, pin.id) }
    }
}
```

> If `plans.lock`'s exact signature differs, match the one used in `OptionFlowEdgeServiceTest` (the brief in Task 1's fixture and that test file are authoritative). `PlanLockedException` is the type `PlanLockGuard` throws.

- [ ] **Step 4: Run the tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.CommentPinServiceTest"`
Expected: 5/5 passing. (This run also flyway-validates V29 against the entity on the test DB.)

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/CommentPinService.kt src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt src/test/kotlin/com/shareddocs/backend/decision/CommentPinServiceTest.kt
git commit -m "feat(decisions): CommentPinService + DTOs + tests (P5b task 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 3: `CommentPinController` + `PlanTree.commentPins` + plan-purge cascade

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/CommentPinController.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (add `commentPins` to `PlanTreeResponse`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (inject `CommentPinRepository`; assemble `commentPins` in `getTree`; purge pins + their comments in the permanent-delete path)

**Interfaces:**
- Consumes: `CommentPinService` (Task 2), `CommentPinRepository`/`CommentRepository` (Task 1), `@CurrentWorkspace`, `@AuthenticationPrincipal AppPrincipal`.
- Produces (frontend): endpoints `POST /api/plans/{planId}/comment-pins`, `PATCH /api/comment-pins/{id}/position`, `PATCH /api/comment-pins/{id}/resolved`, `DELETE /api/comment-pins/{id}`; `PlanTreeResponse.commentPins: List<CommentPinResponse>`.

- [ ] **Step 1: Write the controller**

Create `CommentPinController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
class CommentPinController(private val service: CommentPinService) {
    @PostMapping("/api/plans/{planId}/comment-pins")
    fun create(
        @AuthenticationPrincipal me: AppPrincipal,
        @CurrentWorkspace ws: Workspace,
        @PathVariable planId: Long,
        @Valid @RequestBody request: CreateCommentPinRequest,
    ): ResponseEntity<CommentPinResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.create(ws.id!!, planId, me.userId, request))

    @PatchMapping("/api/comment-pins/{id}/position")
    fun move(
        @CurrentWorkspace ws: Workspace,
        @PathVariable id: Long,
        @Valid @RequestBody request: MoveCommentPinRequest,
    ): CommentPinResponse = service.move(ws.id!!, id, request)

    @PatchMapping("/api/comment-pins/{id}/resolved")
    fun resolve(
        @CurrentWorkspace ws: Workspace,
        @PathVariable id: Long,
        @Valid @RequestBody request: ResolveCommentPinRequest,
    ): CommentPinResponse = service.setResolved(ws.id!!, id, request)

    @DeleteMapping("/api/comment-pins/{id}")
    fun delete(@CurrentWorkspace ws: Workspace, @PathVariable id: Long): ResponseEntity<Void> {
        service.delete(ws.id!!, id)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 2: Add `commentPins` to the tree DTO**

In `DecisionDto.kt`, add the last field to `PlanTreeResponse` (default `emptyList()` to keep other constructors safe):

```kotlin
    val optionFlowEdges: List<OptionFlowEdgeResponse> = emptyList(),
    val commentPins: List<CommentPinResponse> = emptyList(),
)
```

- [ ] **Step 3: Assemble `commentPins` in `getTree` + purge on permanent delete**

In `PlanService.kt`:
1. Add a constructor dependency `private val commentPinRepository: CommentPinRepository` (next to the existing `optionFlowEdgeRepository`). `commentRepository` is already injected.
2. In `getTree`, right where `optionFlowEdges` is built, add:

```kotlin
val commentPins = commentPinRepository.findAllByPlanId(planId).map {
    CommentPinResponse(
        id = it.id!!,
        x = it.canvasX,
        y = it.canvasY,
        resolved = it.resolved,
        commentCount = commentRepository.countByWorkspaceIdAndPageId(workspaceId, "pin:${it.id}"),
        createdBy = it.createdBy,
    )
}
```
and pass `commentPins = commentPins` to the `PlanTreeResponse(...)` constructor.

3. In the permanent-delete path (`deleteForever`, where it already calls `commentRepository.deleteAllByWorkspaceIdAndPageId(..., "plan:$planId")` / `subplan:` / `option:`), add pin cleanup BEFORE the plan row is deleted (FK is RESTRICT):

```kotlin
val pins = commentPinRepository.findAllByPlanId(planId)
pins.forEach { commentRepository.deleteAllByWorkspaceIdAndPageId(plan.workspaceId, "pin:${it.id}") }
commentPinRepository.deleteAllByPlanId(planId)
```

> The `getTree` variable for the workspace id must match what that method already uses (it has `workspaceId` in scope — reuse the exact name; if it's named differently there, use that).

- [ ] **Step 4: Run the full BE build**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL, full suite green (flyway-validate passes; existing `PlanService`/tree tests still pass with the new field).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/CommentPinController.kt src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt
git commit -m "feat(decisions): comment-pin endpoints + tree.commentPins + purge (P5b task 3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

## SLICE B — Frontend canvas fixes (shared-docs, branch `decisions-p5b-pins`)

### Task 4: Always land on canvas

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx` (view initializer + drop persistence)

- [ ] **Step 1: Replace the view initializer and drop the persist effect**

In `PlanDetail.tsx`, replace the initializer (lines ~79–82):

```tsx
const [view, setView] = useState<'list' | 'canvas' | 'timeline'>('canvas')
```

And **delete** the persistence effect (line ~95):

```tsx
// DELETE THIS LINE:
useEffect(() => { localStorage.setItem(`plan-view-${planId}`, view) }, [view, planId])
```

(Leave the `Tabs` render and `setView` untouched — tab switching still works, it just resets to canvas on the per-plan `PlanDetailRoute` remount.)

- [ ] **Step 2: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/PlanDetail.tsx` → clean. (If removing the effect orphaned a now-unused `useEffect` import, fix it.)

- [ ] **Step 3: Commit**

```bash
git add src/features/decisions/PlanDetail.tsx
git commit -m "fix(decisions): always land on canvas view (P5b task 4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 5: 캔버스에서 보기 button + focus-on-canvas

**Files:**
- Modify: `src/features/decisions/SubPlanDetail.tsx` (add the button/link)
- Modify: `src/features/decisions/PlanDetail.tsx` (read `?focus`, pass to canvas)
- Modify: `src/features/decisions/PlanCanvas.tsx` (accept `focusNodeId`, center + select on mount)

**Interfaces:**
- Produces: `PlanCanvas` gains optional prop `focusNodeId?: string` (a namespaced id like `sp:{id}`); on mount, if that node exists it is centered and selected.

- [ ] **Step 1: Add the 캔버스에서 보기 link in SubPlanDetail**

In `SubPlanDetail.tsx`, inside the `<nav className={styles.breadcrumb}>` block (after the existing 상위 안건 link), add (reuse the existing `Link` import + a Lucide icon; import `Compass` from `lucide-react`):

```tsx
<Link to={`/decisions/${planId}?focus=sp:${subPlanId}`} className={styles.upLink}>
  <Compass size={12} aria-hidden="true" /> 캔버스에서 보기
</Link>
```

- [ ] **Step 2: PlanDetail reads `?focus` and passes it to the canvas**

In `PlanDetail.tsx`, read the search param (use the existing router hook — `useSearchParams` from `react-router-dom`; if the file already imports `useLocation`/`useParams`, add `useSearchParams`):

```tsx
const [searchParams] = useSearchParams()
const focusNodeId = searchParams.get('focus') ?? undefined
```

Pass it to the canvas render (line ~330):

```tsx
{view === 'canvas' && <PlanCanvas tree={tree} locked={locked} onNodeSelect={setSelectedNode} focusNodeId={focusNodeId} />}
```

- [ ] **Step 3: PlanCanvas centers + selects the focused node**

In `PlanCanvas.tsx`, extend the `Props` type and the inner `Flow` props with `focusNodeId?: string`, thread it through the `<Flow .../>` render in `PlanCanvas`, and add this effect inside `Flow` (after `nodes` state + `onNodeSelect` are in scope; uses `useReactFlow().setCenter`):

```tsx
const { setCenter } = useReactFlow()   // extend the existing useReactFlow() destructure
useEffect(() => {
  if (!focusNodeId) return
  const n = nodes.find((x) => x.id === focusNodeId)
  if (!n) return
  setCenter(n.position.x, n.position.y, { zoom: 1, duration: 400 })
  onNodeSelect?.(parseNodeId(focusNodeId))
  // run once on mount for this focus target
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusNodeId])
```

(If the node isn't on-canvas — e.g. a nested 안건 — the effect no-ops and the user just lands on canvas, per spec.)

- [ ] **Step 4: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/SubPlanDetail.tsx src/features/decisions/PlanDetail.tsx src/features/decisions/PlanCanvas.tsx` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/decisions/SubPlanDetail.tsx src/features/decisions/PlanDetail.tsx src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions): 캔버스에서 보기 button + focus-on-canvas (P5b task 5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 6: Right-click infra (pane menu + node menu)

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx`

**Interfaces:**
- Consumes: `useContextMenu`, `ContextMenu`, `ContextMenuItem`, `ContextMenuDivider`, `ContextMenuGroup` from `../../components/ui`; `useDeleteSubPlan`, `useDeleteOption`, `useSetAppearance` from `./api`; the `ACCENT_COLORS`/`ICON_MAP` + swatch markup used by `SubPlanCard.tsx:302-345`.
- Produces (Task 10): a `composerAt` state `{ x: number; y: number } | null` set by the pane menu's 여기에 댓글 item (composer rendered in Task 10). Extend `parseNodeId` return kind to include `'pin'` is NOT done here (Task 9).

- [ ] **Step 1: Add the two menus + a pane flow-point + composer state**

In `Flow` (PlanCanvas.tsx), add near the other hooks:

```tsx
const paneMenu = useContextMenu()
const nodeMenu = useContextMenu()
const [menuNode, setMenuNode] = useState<{ kind: 'sp' | 'opt'; id: number } | null>(null)
const [paneFlowPos, setPaneFlowPos] = useState<{ x: number; y: number } | null>(null)
const [composerAt, setComposerAt] = useState<{ x: number; y: number } | null>(null)  // consumed in Task 10
const deleteSubPlan = useDeleteSubPlan()
const deleteOption = useDeleteOption()
const setAppearance = useSetAppearance()
```

- [ ] **Step 2: Wire the React Flow context-menu callbacks**

Add handlers:

```tsx
const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
  e.preventDefault()
  const me = e as React.MouseEvent
  setPaneFlowPos(screenToFlowPosition({ x: me.clientX, y: me.clientY }))
  paneMenu.openAt(me.clientX, me.clientY)
}, [screenToFlowPosition, paneMenu])

const onNodeContextMenu = useCallback((e: React.MouseEvent, node: CanvasNode) => {
  e.preventDefault()
  const parsed = parseNodeId(node.id)
  if (parsed.kind !== 'sp' && parsed.kind !== 'opt') return   // pins have their own click→panel, no node menu
  setMenuNode(parsed)
  nodeMenu.openAt(e.clientX, e.clientY)
}, [nodeMenu])
```

Attach to `<ReactFlow>` (next to the other handlers): `onPaneContextMenu={onPaneContextMenu}` and `onNodeContextMenu={onNodeContextMenu}`.

- [ ] **Step 3: Render the pane menu (여기에 댓글)**

After `</ReactFlow>` (near `<PresenceCursors>`), render:

```tsx
<ContextMenu open={paneMenu.open} position={paneMenu.position} onClose={paneMenu.close} ariaLabel="캔버스 메뉴">
  <ContextMenuItem onSelect={() => { paneMenu.close(); if (paneFlowPos) setComposerAt(paneFlowPos) }}>
    여기에 댓글
  </ContextMenuItem>
</ContextMenu>
```

- [ ] **Step 4: Render the node menu (열기 / 색·아이콘 for 안건 / 삭제)**

Add (below the pane menu). Copy the 색/아이콘 `ContextMenuGroup` swatch markup **verbatim** from `SubPlanCard.tsx:302-345` (including its `ACCENT_COLORS`/`ICON_MAP` imports and the `styles.swatch`/`styles.iconChip` classes — add matching styles to `PlanCanvas.module.css` or import the SubPlanCard ones), adapting the `subPlan.id`/`subPlan.accentColor`/`subPlan.icon` references to look up the current node from `tree.subPlans` by `menuNode.id`:

```tsx
{menuNode && (
  <ContextMenu open={nodeMenu.open} position={nodeMenu.position} onClose={nodeMenu.close} ariaLabel="노드 메뉴">
    <ContextMenuItem onSelect={() => { nodeMenu.close(); onNodeSelect?.(menuNode) }}>열기</ContextMenuItem>
    {menuNode.kind === 'sp' && !locked && (() => {
      const sp = tree.subPlans.find((s) => s.id === menuNode.id)
      if (!sp) return null
      return (
        <>
          <ContextMenuDivider />
          {/* PASTE the 색 + 아이콘 ContextMenuGroup blocks from SubPlanCard.tsx:302-345 here,
              replacing subPlan with sp and calling setAppearance.mutate({ id: sp.id, accentColor, icon }) */}
        </>
      )
    })()}
    {!locked && (
      <>
        <ContextMenuDivider />
        <ContextMenuItem danger onSelect={() => {
          nodeMenu.close()
          if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) {
            if (menuNode.kind === 'sp') deleteSubPlan.mutate(menuNode.id)
            else deleteOption.mutate(menuNode.id)
          }
        }}>삭제</ContextMenuItem>
      </>
    )}
  </ContextMenu>
)}
```

> Verify `deleteOption.mutate` takes the option id (a number) — confirm against `api.ts:234` `useDeleteOption`. If its arg shape differs, match it.

- [ ] **Step 5: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/PlanCanvas.tsx` → clean. (`composerAt`/`setComposerAt` are set here and consumed in Task 10; if lint flags `composerAt` as unused-read this task, add a `void composerAt` no-op comment OR fold Task 10 in — but prefer keeping the state and wiring the composer in Task 10. If ESLint errors on the unused variable, temporarily reference it in a comment and remove the workaround in Task 10.)

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/PlanCanvas.tsx src/features/decisions/PlanCanvas.module.css
git commit -m "feat(decisions): canvas right-click menus (pane + node) (P5b task 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 7: dagre layered auto-layout + 정렬 button

**Files:**
- Modify: `package.json` (add `@dagrejs/dagre`)
- Create: `src/features/decisions/canvasLayout.ts` (dagre helper)
- Modify: `src/features/decisions/PlanCanvas.tsx` (use it in `buildNodes` for un-positioned nodes; add 정렬 button)

**Interfaces:**
- Produces: `layoutPositions(tree): Map<string, { x: number; y: number }>` keyed by namespaced node id (`sp:{id}`/`opt:{id}`), a dagre `LR` layered layout.

- [ ] **Step 1: Add the dependency**

Run: `npm install @dagrejs/dagre`
Expected: adds `@dagrejs/dagre` to `dependencies`.

- [ ] **Step 2: Write the layout helper**

Create `canvasLayout.ts`:

```ts
import Dagre from '@dagrejs/dagre'
import type { PlanTree } from './types'

const SP_W = 280, SP_H = 76, OPT_W = 220, OPT_H = 56

/** Left→right layered DAG layout. 안건 own their option nodes (ownership edges),
 *  flow edges (option → downstream 안건) drive ranks, so downstream 안건 land in the
 *  next rank instead of on top of the upstream option column. Keyed by namespaced id. */
export function layoutPositions(tree: PlanTree): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 96 })

  for (const sp of tree.subPlans) {
    g.setNode(`sp:${sp.id}`, { width: SP_W, height: SP_H })
    for (const o of sp.options) {
      g.setNode(`opt:${o.id}`, { width: OPT_W, height: OPT_H })
      g.setEdge(`sp:${sp.id}`, `opt:${o.id}`)          // ownership (안건 → its option)
    }
  }
  const spIds = new Set(tree.subPlans.map((s) => s.id))
  const optIds = new Set(tree.subPlans.flatMap((s) => s.options.map((o) => o.id)))
  for (const e of tree.optionFlowEdges) {
    if (optIds.has(e.sourceOptionId) && spIds.has(e.targetSubPlanId)) {
      g.setEdge(`opt:${e.sourceOptionId}`, `sp:${e.targetSubPlanId}`)   // flow → next rank
    }
  }

  Dagre.layout(g)
  const out = new Map<string, { x: number; y: number }>()
  g.nodes().forEach((id) => {
    const n = g.node(id)
    if (n) out.set(id, { x: n.x - n.width / 2, y: n.y - n.height / 2 })   // dagre gives centers → top-left
  })
  return out
}
```

- [ ] **Step 3: Use it for un-positioned nodes in `buildNodes`**

In `PlanCanvas.tsx`, change `buildNodes(tree)` to compute a dagre layout once and use it as the fallback when a node has no saved `canvasX/Y`:

```tsx
function buildNodes(tree: PlanTree): CanvasNode[] {
  const states = optionStates(tree)
  const auto = layoutPositions(tree)   // dagre fallback
  const nodes: CanvasNode[] = []
  tree.subPlans.forEach((sp) => {
    const a = auto.get(spId(sp.id)) ?? { x: 0, y: 0 }
    const baseX = sp.canvasX ?? a.x
    const baseY = sp.canvasY ?? a.y
    nodes.push({ id: spId(sp.id), type: 'subplan', position: { x: baseX, y: baseY }, data: { subPlan: sp } })
    sp.options.forEach((o) => {
      const oa = auto.get(optId(o.id)) ?? { x: baseX + OPT_OFFSET_X, y: baseY }
      const ox = o.canvasX ?? oa.x
      const oy = o.canvasY ?? oa.y
      const st = states.get(o.id)
      nodes.push({ id: optId(o.id), type: 'option', position: { x: ox, y: oy },
        data: { option: o, chosen: st === 'chosen', dimmed: st === 'dimmed' } })
    })
  })
  return nodes
}
```

(Import `layoutPositions` from `./canvasLayout`. Remove the now-unused `CLUSTER_GAP_X`/`OPT_GAP_Y` constants if they become unreferenced; keep `OPT_OFFSET_X` as the last-ditch fallback.)

- [ ] **Step 4: Add the 정렬 button**

In the toolbar `<div className={styles.toolbar}>` (next to 안건 추가, only when `!locked`), add a button that re-lays-out ALL nodes and persists:

```tsx
<Button variant="outline" size="sm" onClick={() => {
  const auto = layoutPositions(tree)
  setNodes((ns) => ns.map((n) => {
    const p = auto.get(n.id)
    return p ? { ...n, position: p } : n
  }))
  auto.forEach((p, id) => {
    const { kind, id: dbId } = parseNodeId(id)
    if (kind === 'sp') moveSubPlan.mutate({ id: dbId, payload: { canvasX: p.x, canvasY: p.y } })
    else if (kind === 'opt') moveOption.mutate({ id: dbId, payload: { canvasX: p.x, canvasY: p.y } })
  })
}}>정렬</Button>
```

(This recomputes for sp/opt only — pins keep their own positions. `parseNodeId` extension for `'pin'` in Task 9 won't be matched here since `auto` only contains `sp:`/`opt:` keys.)

- [ ] **Step 5: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/canvasLayout.ts src/features/decisions/PlanCanvas.tsx` → clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/decisions/canvasLayout.ts src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions): dagre layered auto-layout + 정렬 button (P5b task 7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

## SLICE C — Frontend pinned comments (shared-docs, branch `decisions-p5b-pins`)

### Task 8: Pin types + API hooks

**Files:**
- Modify: `src/features/decisions/types.ts` (`CommentPin` + `PlanTree.commentPins`)
- Modify: `src/features/decisions/api.ts` (four hooks)

**Interfaces:**
- Produces (Tasks 9–11): type `CommentPin = { id: number; x: number; y: number; resolved: boolean; commentCount: number; createdBy: number | null }`; `PlanTree.commentPins: CommentPin[]`; hooks `useCreateCommentPin(planId)`, `useMoveCommentPin()`, `useSetCommentPinResolved()`, `useDeleteCommentPin()`.

- [ ] **Step 1: Add the type**

In `types.ts`, add:

```ts
export type CommentPin = {
  id: number
  x: number
  y: number
  resolved: boolean
  commentCount: number
  createdBy: number | null
}
```

and add `commentPins: CommentPin[]` as the last field of `PlanTree`.

- [ ] **Step 2: Add the hooks**

In `api.ts`, add (mirroring `useAddFlowEdge`/`useMoveOption`; `useMoveCommentPin` is fire-and-forget with no invalidation):

```ts
export function useCreateCommentPin(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: { x: number; y: number; content: string }) =>
      (await apiClient.post<CommentPin>(`/api/plans/${planId}/comment-pins`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) })
      qc.invalidateQueries({ queryKey: commentKeys.scope(activeId) })
    },
  })
}

export function useMoveCommentPin() {
  return useMutation({
    mutationFn: async (v: { id: number; payload: { x: number; y: number } }) => {
      await apiClient.patch(`/api/comment-pins/${v.id}/position`, v.payload)
    },
  })
}

export function useSetCommentPinResolved() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; resolved: boolean }) => {
      await apiClient.patch(`/api/comment-pins/${v.id}/resolved`, { resolved: v.resolved })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

export function useDeleteCommentPin() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/comment-pins/${id}`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) })
      qc.invalidateQueries({ queryKey: commentKeys.scope(activeId) })
    },
  })
}
```

(Import `CommentPin` from `./types`; `commentKeys` from `../../api/comments` — match the existing import path used elsewhere in `api.ts`, adding it if absent.)

- [ ] **Step 3: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/types.ts src/features/decisions/api.ts` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions): comment-pin types + api hooks (P5b task 8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 9: `CommentPinNode` + canvas wiring + live sync + resolved toggle

**Files:**
- Create: `src/features/decisions/CommentPinNode.tsx` + `src/features/decisions/CommentPinNode.module.css`
- Modify: `src/features/decisions/PlanCanvas.tsx` (register node type; `pinId`/`parseNodeId` extension; pin nodes in `buildNodes`; `onNodeDragStop` pin branch; live sync effect; 해결된 댓글 표시 toggle)

**Interfaces:**
- Consumes: `CommentPin` (Task 8), `useMoveCommentPin` (Task 8), P5a `localDragId` ref + smoothed-drag effect pattern.
- Produces (Task 11): pin nodes are clickable → `onNodeSelect?.({ kind: 'pin', id })`.

- [ ] **Step 1: Create the pin node**

Create `CommentPinNode.tsx`:

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { MessageCircle } from 'lucide-react'
import type { CommentPin } from './types'
import styles from './CommentPinNode.module.css'

export type CommentPinNodeType = Node<{ pin: CommentPin }, 'pin'>

function CommentPinNodeImpl({ data }: NodeProps<CommentPinNodeType>) {
  const { pin } = data
  return (
    <div className={`${styles.pin}${pin.resolved ? ' ' + styles.resolved : ''}`} title={pin.resolved ? '해결된 댓글' : '댓글'}>
      <Handle type="target" position={Position.Left} isConnectable={false} className={styles.hidden} />
      <MessageCircle size={14} aria-hidden="true" />
      <span className={styles.count}>{pin.commentCount}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className={styles.hidden} />
    </div>
  )
}
export default memo(CommentPinNodeImpl)
```

Create `CommentPinNode.module.css` (Bear-minimal — hairline, no shadow):

```css
.pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full, 999px);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.resolved { opacity: 0.4; }
.count { font-variant-numeric: tabular-nums; }
.hidden { opacity: 0; pointer-events: none; }
```

- [ ] **Step 2: Register + parse + pin nodes**

In `PlanCanvas.tsx`:
1. Import + register: `import CommentPinNode from './CommentPinNode'`; `const nodeTypes = { subplan: SubPlanCanvasNode, option: OptionCanvasNode, pin: CommentPinNode }`.
2. Add id helper + widen `parseNodeId`:

```tsx
const pinId = (id: number) => `pin:${id}`
const parseNodeId = (nid: string): { kind: 'sp' | 'opt' | 'pin'; id: number } => {
  const [k, n] = nid.split(':')
  return { kind: k as 'sp' | 'opt' | 'pin', id: Number(n) }
}
```

3. Widen the `CanvasNode` union to include `CommentPinNodeType` (import the type).
4. In `buildNodes`, after the subPlans loop, append pin nodes (respecting the resolved-visibility filter passed in — see Step 5; simplest is to build all and filter at render, but filter here via a param). Add pins:

```tsx
tree.commentPins.forEach((p) => {
  nodes.push({ id: pinId(p.id), type: 'pin', position: { x: p.x, y: p.y }, data: { pin: p } })
})
```

- [ ] **Step 3: Route pin drag persistence**

In `onNodeDragStop`, add the `pin` branch (uses `useMoveCommentPin` — add `const moveCommentPin = useMoveCommentPin()` near the other move hooks, and add it to the `useCallback` deps):

```tsx
timers.set(node.id, setTimeout(() => {
  const payload = { canvasX: node.position.x, canvasY: node.position.y }
  if (kind === 'sp') moveSubPlan.mutate({ id, payload })
  else if (kind === 'opt') moveOption.mutate({ id, payload })
  else if (kind === 'pin') moveCommentPin.mutate({ id, payload: { x: node.position.x, y: node.position.y } })
  timers.delete(node.id)
}, DRAG_SAVE_MS))
```

- [ ] **Step 4: Live sync effect for pins**

The canvas seeds nodes once; add an effect that reconciles pin nodes from `tree.commentPins` (add/remove/resolve) without touching sp/opt nodes and without fighting an in-progress local pin drag (reuse the P5a `localDragId` guard). Place near the P5a peer-drag effect:

```tsx
useEffect(() => {
  setNodes((ns) => {
    const pinNodes = ns.filter((n) => n.id.startsWith('pin:'))
    const byId = new Map(pinNodes.map((n) => [n.id, n]))
    const want = tree.commentPins.filter((p) => showResolved || !p.resolved)
    const wantIds = new Set(want.map((p) => pinId(p.id)))
    // drop removed / now-hidden pins
    let next = ns.filter((n) => !n.id.startsWith('pin:') || wantIds.has(n.id))
    // add new + refresh data (keep position for the pin the user is dragging)
    for (const p of want) {
      const key = pinId(p.id)
      const existing = byId.get(key)
      if (!existing) {
        next = next.concat({ id: key, type: 'pin', position: { x: p.x, y: p.y }, data: { pin: p } })
      } else if (key !== localDragId.current) {
        next = next.map((n) => n.id === key
          ? { ...n, position: { x: p.x, y: p.y }, data: { pin: p } }
          : n)
      }
    }
    return next
  })
}, [tree.commentPins, showResolved, setNodes])
```

- [ ] **Step 5: 해결된 댓글 표시 toggle**

Add `const [showResolved, setShowResolved] = useState(false)` in `Flow`. In `buildNodes`, gate the pin loop with the initial `showResolved` — simplest: pass `showResolved` into `buildNodes` is awkward with the once-only initializer, so instead build ALL pins in `buildNodes` and let the Step-4 sync effect (which runs on mount too, since `showResolved` is a dep) filter them. Add the toolbar toggle (only meaningful when there are resolved pins; keep it always visible for simplicity):

```tsx
<Button variant="ghost" size="sm" onClick={() => setShowResolved((v) => !v)}>
  {showResolved ? '해결된 댓글 숨기기' : '해결된 댓글 표시'}
</Button>
```

(Because the sync effect runs on mount and filters by `showResolved`, resolved pins are hidden by default without needing `buildNodes` to know the flag.)

- [ ] **Step 6: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/CommentPinNode.tsx src/features/decisions/PlanCanvas.tsx` → clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/decisions/CommentPinNode.tsx src/features/decisions/CommentPinNode.module.css src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions): comment-pin nodes + live sync + resolved toggle (P5b task 9)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 10: Pin composer (wire 여기에 댓글 → create)

**Files:**
- Create: `src/features/decisions/PinComposer.tsx` + `.module.css`
- Modify: `src/features/decisions/PlanCanvas.tsx` (render composer from `composerAt`)

**Interfaces:**
- Consumes: `composerAt` state (Task 6), `useCreateCommentPin(tree.id)` (Task 8), `flowToScreenPosition` (React Flow).
- Produces: submitting creates a pin+first-comment; canceling clears `composerAt` with no write.

- [ ] **Step 1: Create the composer**

Create `PinComposer.tsx` — a small popover anchored at a screen point with a textarea + 등록/취소:

```tsx
import { useState } from 'react'
import { Button } from '../../components/ui'
import styles from './PinComposer.module.css'

type Props = {
  screenX: number
  screenY: number
  busy: boolean
  onSubmit: (content: string) => void
  onCancel: () => void
}
export default function PinComposer({ screenX, screenY, busy, onSubmit, onCancel }: Props) {
  const [content, setContent] = useState('')
  return (
    <div className={styles.popover} style={{ transform: `translate(${screenX}px, ${screenY}px)` }}>
      <textarea
        className={styles.input}
        autoFocus
        placeholder="댓글을 입력하세요"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
      />
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button size="sm" disabled={busy || !content.trim()} onClick={() => onSubmit(content.trim())}>등록</Button>
      </div>
    </div>
  )
}
```

Create `PinComposer.module.css`:

```css
.popover {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  width: 240px;
  padding: var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  background: var(--c-surface);
}
.input {
  width: 100%;
  min-height: 60px;
  resize: vertical;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-bg);
  color: var(--c-text);
  padding: var(--sp-1) var(--sp-2);
  font: inherit;
}
.actions { display: flex; justify-content: flex-end; gap: var(--sp-1); margin-top: var(--sp-1); }
```

- [ ] **Step 2: Render it from `composerAt`**

In `PlanCanvas.tsx` `Flow`: add `const createPin = useCreateCommentPin(tree.id)` and `const { flowToScreenPosition } = useReactFlow()` (extend the existing destructure). After `</ReactFlow>` (near the menus), render:

```tsx
{composerAt && (() => {
  const s = flowToScreenPosition(composerAt)
  const rect = wrapRef.current?.getBoundingClientRect()
  const left = s.x - (rect?.left ?? 0)
  const top = s.y - (rect?.top ?? 0)
  return (
    <PinComposer
      screenX={left} screenY={top} busy={createPin.isPending}
      onSubmit={(content) => createPin.mutate(
        { x: composerAt.x, y: composerAt.y, content },
        { onSuccess: () => setComposerAt(null) },
      )}
      onCancel={() => setComposerAt(null)}
    />
  )
})()}
```

(Import `PinComposer`. `flowToScreenPosition` returns viewport-relative screen coords; subtract the canvas wrapper's rect so the popover positions inside the `position:relative` `.canvas` container, matching the PresenceCursors overlay convention.)

- [ ] **Step 3: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/PinComposer.tsx src/features/decisions/PlanCanvas.tsx` → clean. (This removes any Task-6 unused-`composerAt` workaround.)

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/PinComposer.tsx src/features/decisions/PinComposer.module.css src/features/decisions/PlanCanvas.tsx
git commit -m "feat(decisions): pin composer — 여기에 댓글 creates a pin (P5b task 10)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

### Task 11: Pin detail Panel (thread + resolve/delete)

**Files:**
- Create: `src/features/decisions/CommentPinPanel.tsx`
- Modify: `src/features/decisions/PlanDetail.tsx` (extend `selectedNode` union to `'pin'`; third `<Panel>` block)
- Modify: `src/features/decisions/PlanCanvas.tsx` (pin nodes already call `onNodeSelect` via `onNodeClick` → confirm the existing `onNodeClick={(_, n) => onNodeSelect?.(parseNodeId(n.id))}` now yields `kind:'pin'`)

**Interfaces:**
- Consumes: `Panel` (`components/ui`), `Comments` (`components/Comments`), `useSetCommentPinResolved`/`useDeleteCommentPin` (Task 8), the plan tree's `commentPins` to resolve the selected pin.

- [ ] **Step 1: Create the pin panel**

Create `CommentPinPanel.tsx`:

```tsx
import { Button } from '../../components/ui'
import Comments from '../../components/Comments'
import { useSetCommentPinResolved, useDeleteCommentPin } from './api'
import type { CommentPin } from './types'
import styles from './OptionPanel.module.css'   // reuse an existing panel-body stylesheet, or a minimal local one

export default function CommentPinPanel({ pin, onDeleted }: { pin: CommentPin; onDeleted: () => void }) {
  const setResolved = useSetCommentPinResolved()
  const del = useDeleteCommentPin()
  return (
    <div>
      <div className={styles.panelActions ?? ''} style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <Button variant="outline" size="sm"
          onClick={() => setResolved.mutate({ id: pin.id, resolved: !pin.resolved })}>
          {pin.resolved ? '다시 열기' : '해결'}
        </Button>
        <Button variant="ghost" size="sm"
          onClick={() => { if (window.confirm('이 댓글 핀을 삭제할까요?')) del.mutate(pin.id, { onSuccess: onDeleted }) }}>
          삭제
        </Button>
      </div>
      <Comments pageId={`pin:${pin.id}`} />
    </div>
  )
}
```

> If `OptionPanel.module.css` has no `panelActions` class, use the inline `style` (as shown) and drop the `styles.panelActions ??` reference — keep it Bear-minimal (hairline Button row above the thread).

- [ ] **Step 2: Wire selection in PlanDetail**

In `PlanDetail.tsx`:
1. Extend the selection state type to include `'pin'`:

```tsx
const [selectedNode, setSelectedNode] = useState<{ kind: 'sp' | 'opt' | 'pin'; id: number } | null>(null)
```

2. Add a memo to resolve the selected pin from the live tree (mirror the existing `selectedOption` memo):

```tsx
const selectedPin = useMemo(
  () => (selectedNode?.kind === 'pin' ? tree?.commentPins.find((p) => p.id === selectedNode.id) ?? null : null),
  [selectedNode, tree],
)
```

3. Add a third `<Panel>` block next to the option/subplan ones:

```tsx
{selectedNode?.kind === 'pin' && selectedPin && (
  <Panel open onClose={() => setSelectedNode(null)} title="댓글">
    <CommentPinPanel pin={selectedPin} onDeleted={() => setSelectedNode(null)} />
  </Panel>
)}
```

(Import `CommentPinPanel`. The existing `onNodeSelect={setSelectedNode}` + `onNodeClick` in PlanCanvas already deliver `{kind:'pin', id}` now that `parseNodeId` knows `'pin'`.)

- [ ] **Step 3: Build + lint**

Run: `npm run build` → PASS.
Run: `npx eslint src/features/decisions/CommentPinPanel.tsx src/features/decisions/PlanDetail.tsx` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/CommentPinPanel.tsx src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): pin detail panel — thread + resolve/delete (P5b task 11)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZc85nBpz22aMMAst9oXiS"
```

---

## Self-Review

**Spec coverage:**
- §3 BE (V29 table, entity/repo, service create-with-first-comment / move-lock-gated / resolve / delete-cascade, two PATCH endpoints, PlanTree.commentPins, realtime, tests, plan-purge cascade) → Tasks 1–3. ✅
- §4.1 always-land-canvas → Task 4. ✅
- §4.2 right-click infra (pane 여기에 댓글 + node menu) → Task 6. ✅
- §4.3 dagre + 정렬 → Task 7. ✅
- §4.4 캔버스에서 보기 + focus → Task 5. ✅
- §5.1 types+api → Task 8. §5.2 CommentPinNode → Task 9. §5.3 create composer → Tasks 6+10. §5.4 live sync effect → Task 9. §5.5 open/resolve/delete Panel + drag persist → Tasks 9(drag)+11(panel). §5.6 해결된 댓글 표시 toggle → Task 9. ✅
- §6 guardrails: no-orphan (atomic create, Task 2/10); dagre fills nulls (Task 7); sync-vs-local-drag guard (Task 9); optimistic version (Task 1 entity); right-click preventDefault (Task 6); lock (Tasks 2 move-gated / others not); focus best-effort (Task 5). ✅
- §7 testing: BE gradlew + cases (Tasks 2–3); FE build+lint per task; manual smoke owed. ✅

**Placeholder scan:** The two "copy verbatim from SubPlanCard.tsx:302-345" references (Task 6 swatches) point at exact source lines rather than re-quoting a large block — acceptable per the reuse guidance; every other code step is complete. No TBD/TODO. ✅

**Type consistency:** `CommentPin` FE type (Task 8) fields match `CommentPinResponse` BE DTO (Task 2: id,x,y,resolved,commentCount,createdBy). Hook names `useCreateCommentPin`/`useMoveCommentPin`/`useSetCommentPinResolved`/`useDeleteCommentPin` consistent across Tasks 8–11. `parseNodeId` widened to `'pin'` in Task 9, consumed by `onNodeDragStop`/`onNodeClick`/Task 11. Endpoint paths consistent BE↔FE: `POST /api/plans/{id}/comment-pins`, `PATCH …/{id}/position`, `PATCH …/{id}/resolved`, `DELETE …/{id}`. `composerAt` produced in Task 6, consumed in Task 10. `showResolved`/`localDragId` used in Task 9's sync effect. ✅

**Cross-task ordering note:** Task 6 introduces `composerAt` (set, not yet rendered) — flagged inline; Task 10 renders it. If ESLint's unused-var rule errors at Task 6's boundary, the inline note says to reference it in a comment and clean up in Task 10. BE Tasks 1→2→3 are strictly ordered (entity → service → controller/tree). FE slice B (4–7) and slice C (8–11) assume slice B's Task 6 lands before Task 10.
