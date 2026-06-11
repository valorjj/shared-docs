# Plan Complete + Discard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a COMPLETED plan status (retiring the dead ARCHIVED) and a soft-delete 휴지통 (discard/restore/purge) for plans, mirroring the Note trash pattern.

**Architecture:** `PlanStatus` becomes `ACTIVE | COMPLETED`; a `deletedAt` column gives soft-delete. Dedicated idempotent actions (`complete`/`uncomplete`, `discard`/`restore`/`deleteForever`) emit timeline events for completion only. Reads split into board (active) / 완료 (completed) / 휴지통 (trash). Lock becomes content-only — deletion is no longer lock-guarded.

**Tech Stack:** Spring Boot 3.5 + Kotlin, JPA (`ddl-auto: validate`), Flyway (MariaDB :3307), JUnit; React 19 + TS, React Query, lucide-react.

**Design doc:** `docs/plans/2026-06-11-plan-complete-discard-design.md`

**Repos:** backend = `shared-docs-backend` (branch `complete-discard`); frontend = `shared-docs` (branch `complete-discard`, Task 4).

**Backend test prereq:** `test` profile runs against MariaDB `localhost:3307`, schema `shared_docs_test`; Flyway applies migrations on context start. Focused run e.g. `./gradlew test --tests "com.shareddocs.backend.decision.PlanLifecycleServiceTest"`.

---

### Task 1: Backend — status model, deletedAt column, migration

Retire `ARCHIVED` (→ `ACTIVE | COMPLETED`), add `PLAN_COMPLETED`/`PLAN_UNCOMPLETED` event types, add the `deletedAt` column + Flyway V19, remove `status` from the generic update path, and expose `deletedAt` on the summary DTO. Fix the one existing test that set `status` via update.

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/Plan.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Create: `src/main/resources/db/migration/V19__plan_complete_discard.sql`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt`

- [ ] **Step 1: Branch**

```bash
cd shared-docs-backend && git checkout -b complete-discard
```

- [ ] **Step 2: Status + event enums** — `PlanEnums.kt`:

Replace:
```kotlin
/** Lifecycle of a 계획. ARCHIVED hides it from the active roadmap but keeps history. */
enum class PlanStatus { ACTIVE, ARCHIVED }
```
with:
```kotlin
/** Lifecycle of a 계획. COMPLETED drops it off the active board (shown in the 완료 view). */
enum class PlanStatus { ACTIVE, COMPLETED }
```

In `PlanEventType`, after `PLAN_UNLOCKED,` add:
```kotlin
    PLAN_COMPLETED,
    PLAN_UNCOMPLETED,
```

- [ ] **Step 3: `deletedAt` column on the entity** — `Plan.kt`:

After the `lockedByUserId` field (the last constructor property), add:
```kotlin
    @Column(name = "deleted_at")
    var deletedAt: Instant? = null,
```
(`import java.time.Instant` is already present from the lock work.)

- [ ] **Step 4: DTO — drop `status` from update, add `deletedAt` to summary** — `DecisionDto.kt`:

In `UpdatePlanRequest`, remove the line `val status: PlanStatus? = null,`.

In `PlanSummaryResponse`, after `val lockedByUserId: Long?,` add:
```kotlin
    val deletedAt: Instant?,
```
(`PlanTreeResponse` is unchanged — a discarded plan 404s, and `status` is already on it.)

- [ ] **Step 5: PlanService — drop status mutation, map deletedAt** — `PlanService.kt`:

In `update`, remove the line `request.status?.let { plan.status = it }`.

In the `Plan.toSummary(...)` mapper, after `lockedByUserId = lockedByUserId,` add:
```kotlin
        deletedAt = deletedAt,
```

- [ ] **Step 6: Flyway migration** — create `src/main/resources/db/migration/V19__plan_complete_discard.sql`:

```sql
-- Plan complete + discard (Decisions backlog A.2/A.3).
-- 1) Soft-delete column + index for the board(active)/완료/휴지통 queries.
-- 2) Retire the dead ARCHIVED status: any such rows (none expected — it was never
--    UI-settable) become ACTIVE so the ACTIVE|COMPLETED enum validates.
ALTER TABLE `plans`
  ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL,
  ADD KEY `idx_plans_ws_deleted` (`workspace_id`, `deleted_at`);

UPDATE `plans` SET `status` = 'ACTIVE' WHERE `status` = 'ARCHIVED';
```

- [ ] **Step 7: Fix the existing update test** — `PlanServiceTest.kt`:

The `update applies only the provided fields` test passes `status = PlanStatus.ARCHIVED`, which no longer exists/compiles. Replace the test body (lines ~76–91) with:
```kotlin
    @Test
    fun `update applies only the provided fields`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "old", description = "d"))

        val updated = service.update(
            ws.id!!, plan.id,
            UpdatePlanRequest(title = "new", canvasX = 12.0, canvasY = 34.0),
        )
        assertEquals("new", updated.title)
        assertEquals("d", updated.description)               // untouched (null in request)
        assertEquals(PlanStatus.ACTIVE, updated.status)      // status is not settable via update anymore
        assertEquals(12.0, updated.canvasX)
        assertEquals(34.0, updated.canvasY)
    }
```

- [ ] **Step 8: Compile + run the touched test** — production code now compiles; the `delete`/`getTree` tests still pass (unchanged behavior so far).

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: PASS (context boots → V19 validated against the entity; the rewritten update test is green).

- [ ] **Step 9: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt \
        src/main/kotlin/com/shareddocs/backend/decision/Plan.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/resources/db/migration/V19__plan_complete_discard.sql \
        src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt
git commit -m "feat(decisions): plan status ACTIVE|COMPLETED + deletedAt column

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — complete / uncomplete actions

Idempotent status transitions with timeline events, not lock-guarded.

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanLifecycleServiceTest.kt` (create)

- [ ] **Step 1: Write the failing test** — create `PlanLifecycleServiceTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanLifecycleServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val entityManager: EntityManager,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private data class Ctx(val wsId: Long, val planId: Long, val user: Long)

    private fun seed(): Ctx {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        return Ctx(ws.id!!, plan.id, owner.id!!)
    }

    private fun eventTypes(planId: Long) =
        events.findAllByPlanIdOrderByCreatedAtDesc(planId).map { it.type }

    @Test
    fun `complete sets COMPLETED and records PLAN_COMPLETED`() {
        val c = seed()
        val summary = plans.complete(c.wsId, c.planId, c.user)
        assertEquals(PlanStatus.COMPLETED, summary.status)
        assertEquals(PlanEventType.PLAN_COMPLETED, eventTypes(c.planId).first())
    }

    @Test
    fun `uncomplete returns to ACTIVE and records PLAN_UNCOMPLETED`() {
        val c = seed()
        plans.complete(c.wsId, c.planId, c.user)
        val summary = plans.uncomplete(c.wsId, c.planId, c.user)
        assertEquals(PlanStatus.ACTIVE, summary.status)
        assertEquals(PlanEventType.PLAN_UNCOMPLETED, eventTypes(c.planId).first())
    }

    @Test
    fun `completing twice is idempotent with one event`() {
        val c = seed()
        plans.complete(c.wsId, c.planId, c.user)
        plans.complete(c.wsId, c.planId, c.user)
        assertEquals(1, eventTypes(c.planId).count { it == PlanEventType.PLAN_COMPLETED })
    }

    @Test
    fun `list excludes completed plans; listCompleted returns them`() {
        val c = seed()
        plans.complete(c.wsId, c.planId, c.user)
        entityManager.flush(); entityManager.clear()
        assertTrue(plans.list(c.wsId).none { it.id == c.planId })
        assertTrue(plans.listCompleted(c.wsId).any { it.id == c.planId })
    }
}
```

- [ ] **Step 2: Run it — fails to compile** (`plans.complete`/`uncomplete`/`listCompleted` don't exist yet).

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanLifecycleServiceTest"`
Expected: FAIL (unresolved references). `listCompleted` lands in Task 3 — the list test goes green there; the complete/uncomplete/idempotency tests go green here.

- [ ] **Step 3: Add `complete`/`uncomplete` to `PlanService`** — after the existing `unlock(...)` method (or after `create`, near the other lifecycle actions), add:

```kotlin
    /**
     * Mark a 계획 done. Drops it off the active board (shown in the 완료 view). Idempotent
     * — re-completing records no second event. Lifecycle action: NOT lock-guarded.
     */
    fun complete(workspaceId: Long, planId: Long, actorUserId: Long): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        if (plan.status != PlanStatus.COMPLETED) {
            plan.status = PlanStatus.COMPLETED
            events.record(
                workspaceId = workspaceId,
                planId = planId,
                subPlanId = null,
                type = PlanEventType.PLAN_COMPLETED,
                actorUserId = actorUserId,
                payload = mapOf("title" to plan.title),
            )
        }
        return summaryOf(plan)
    }

    /** Reopen a completed 계획 back to ACTIVE. Idempotent. NOT lock-guarded. */
    fun uncomplete(workspaceId: Long, planId: Long, actorUserId: Long): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        if (plan.status != PlanStatus.ACTIVE) {
            plan.status = PlanStatus.ACTIVE
            events.record(
                workspaceId = workspaceId,
                planId = planId,
                subPlanId = null,
                type = PlanEventType.PLAN_UNCOMPLETED,
                actorUserId = actorUserId,
                payload = mapOf("title" to plan.title),
            )
        }
        return summaryOf(plan)
    }
```

- [ ] **Step 4: Controller endpoints** — `PlanController.kt`, after the `unlock` endpoint:

```kotlin
    @PostMapping("/{planId}/complete")
    fun complete(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
    ): PlanSummaryResponse = service.complete(ws.id!!, planId, me.userId)

    @PostMapping("/{planId}/uncomplete")
    fun uncomplete(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
    ): PlanSummaryResponse = service.uncomplete(ws.id!!, planId, me.userId)
```

- [ ] **Step 5: Run the complete/uncomplete tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanLifecycleServiceTest"`
Expected: the 3 complete/uncomplete/idempotency tests PASS; the `list excludes completed` test still FAILS (`listCompleted` arrives in Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanLifecycleServiceTest.kt
git commit -m "feat(decisions): complete/uncomplete plan actions + events

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend — discard/restore/purge + read filtering

Soft-delete via `deletedAt`, split reads into board/완료/휴지통, make `getTree` delete-aware, repoint the `DELETE` route to soft-delete, and make the old hard-delete `deleteForever` (no longer lock-guarded). Update the superseded lock test.

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanLockServiceTest.kt`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanTrashServiceTest.kt` (create)

- [ ] **Step 1: Write the failing trash test** — create `PlanTrashServiceTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanTrashServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val entityManager: EntityManager,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private data class Ctx(val wsId: Long, val planId: Long, val user: Long)

    private fun seed(): Ctx {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        return Ctx(ws.id!!, plan.id, owner.id!!)
    }

    @Test
    fun `discard removes the plan from the board and puts it in trash`() {
        val c = seed()
        plans.discard(c.wsId, c.planId)
        entityManager.flush(); entityManager.clear()
        assertTrue(plans.list(c.wsId).none { it.id == c.planId })
        val trash = plans.listTrash(c.wsId)
        assertTrue(trash.any { it.id == c.planId })
        assertNotNull(trash.first { it.id == c.planId }.deletedAt)
    }

    @Test
    fun `getTree 404s for a discarded plan`() {
        val c = seed()
        plans.discard(c.wsId, c.planId)
        entityManager.flush(); entityManager.clear()
        assertThrows(PlanNotFoundException::class.java) { plans.getTree(c.wsId, c.planId) }
    }

    @Test
    fun `restore returns the plan to the board`() {
        val c = seed()
        plans.discard(c.wsId, c.planId)
        plans.restore(c.wsId, c.planId)
        entityManager.flush(); entityManager.clear()
        assertTrue(plans.list(c.wsId).any { it.id == c.planId })
        assertTrue(plans.listTrash(c.wsId).none { it.id == c.planId })
    }

    @Test
    fun `deleteForever removes the row entirely`() {
        val c = seed()
        plans.discard(c.wsId, c.planId)
        plans.deleteForever(c.wsId, c.planId)
        entityManager.flush(); entityManager.clear()
        assertTrue(plans.listTrash(c.wsId).none { it.id == c.planId })
        assertThrows(PlanNotFoundException::class.java) { plans.getTree(c.wsId, c.planId) }
    }

    @Test
    fun `discard is idempotent`() {
        val c = seed()
        plans.discard(c.wsId, c.planId)
        plans.discard(c.wsId, c.planId)
        entityManager.flush(); entityManager.clear()
        assertEquals(1, plans.listTrash(c.wsId).count { it.id == c.planId })
    }
}
```

- [ ] **Step 2: Run it — fails to compile** (`discard`/`restore`/`deleteForever`/`listTrash` don't exist).

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanTrashServiceTest"`
Expected: FAIL (unresolved references).

- [ ] **Step 3: Repository queries** — `PlanRepository.kt`:

Replace `findAllByWorkspaceIdOrderByCreatedAtDesc` with the delete/status-aware queries (its only caller, `list`, is repointed in Step 4). The interface becomes:

```kotlin
interface PlanRepository : JpaRepository<Plan, Long> {

    /** Board/완료: non-deleted plans of a given status, newest first. */
    fun findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
        workspaceId: Long,
        status: PlanStatus,
    ): List<Plan>

    /** 휴지통: discarded plans, newest-discarded first. */
    fun findAllByWorkspaceIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(workspaceId: Long): List<Plan>

    /** A single plan, scoped to the workspace — for lifecycle/management actions
     *  (complete/discard/restore/purge), which must reach discarded plans too. */
    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): Plan?

    /** A single VISIBLE plan (not discarded) — for the tree read (→ 404 if discarded). */
    fun findByIdAndWorkspaceIdAndDeletedAtIsNull(id: Long, workspaceId: Long): Plan?

    /** True if the plan is currently locked. Null only if the plan id doesn't exist. */
    @Query("SELECT CASE WHEN p.lockedAt IS NOT NULL THEN true ELSE false END FROM Plan p WHERE p.id = :planId")
    fun isLockedByPlanId(@Param("planId") planId: Long): Boolean?

    /** True if the plan owning the given 안건 is locked.
     *  Null if the 안건 doesn't exist (or, in the FK-orphan case, its owning plan is missing) —
     *  callers run a requireX existence check first, so the guard safely treats null as unlocked. */
    @Query(
        "SELECT CASE WHEN p.lockedAt IS NOT NULL THEN true ELSE false END " +
            "FROM Plan p, SubPlan s WHERE s.id = :subPlanId AND s.planId = p.id",
    )
    fun isLockedBySubPlanId(@Param("subPlanId") subPlanId: Long): Boolean?
}
```
(Keep the existing `import org.springframework.data.jpa.repository.JpaRepository` / `Query` / `Param`.)

- [ ] **Step 4: PlanService — read split + lifecycle methods**

First, refactor the count roll-up so `list`/`listCompleted`/`listTrash` share it. Replace the current `list` method (the `@Transactional(readOnly = true) fun list(...) { ... }` block) with:

```kotlin
    @Transactional(readOnly = true)
    fun list(workspaceId: Long): List<PlanSummaryResponse> =
        summariesOf(planRepository.findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(workspaceId, PlanStatus.ACTIVE))

    @Transactional(readOnly = true)
    fun listCompleted(workspaceId: Long): List<PlanSummaryResponse> =
        summariesOf(planRepository.findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(workspaceId, PlanStatus.COMPLETED))

    @Transactional(readOnly = true)
    fun listTrash(workspaceId: Long): List<PlanSummaryResponse> =
        summariesOf(planRepository.findAllByWorkspaceIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(workspaceId))

    /** Shared roll-up: map plans to summaries with their 안건/결정 counts, no N+1. */
    private fun summariesOf(plans: List<Plan>): List<PlanSummaryResponse> {
        if (plans.isEmpty()) return emptyList()
        val planIds = plans.mapNotNull { it.id }
        val subPlans = subPlanRepository.findAllByPlanIdIn(planIds)
        val subPlansByPlan = subPlans.groupBy { it.planId }
        val subPlanIds = subPlans.mapNotNull { it.id }
        val decidedSubPlanIds = if (subPlanIds.isEmpty()) {
            emptySet()
        } else {
            decisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds).map { it.subPlanId }.toSet()
        }
        return plans.map { plan ->
            val sps = subPlansByPlan[plan.id] ?: emptyList()
            plan.toSummary(subPlanCount = sps.size, decidedCount = sps.count { it.id in decidedSubPlanIds })
        }
    }
```

Make `getTree` delete-aware — change its first line from `val plan = requirePlan(workspaceId, planId)` to:
```kotlin
        val plan = planRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(planId, workspaceId)
            ?: throw PlanNotFoundException()
```

Rename the existing hard-delete method `delete` → `deleteForever` and remove its lock guard. Change its signature line and remove the `lockGuard.assertUnlocked(plan)` line:
```kotlin
    /**
     * Permanently delete the whole tree (영구 삭제 from 휴지통). FK constraints are
     * ON DELETE RESTRICT, so remove references deepest-first: decisions (→ options,
     * sub_plans) and ratings (→ options) before options, then events, sub_plans, and
     * finally the plan. Lifecycle action: NOT lock-guarded.
     */
    fun deleteForever(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        // ... (rest of the existing delete body unchanged) ...
    }
```
(Keep the entire existing body below `val plan = ...` exactly as-is; only the method name changed and the `lockGuard.assertUnlocked(plan)` line was deleted.)

Add the soft-delete lifecycle methods (near complete/uncomplete; NOT lock-guarded, no events):
```kotlin
    /** Soft-delete a 계획 to the 휴지통. Idempotent. Restorable. NOT lock-guarded. */
    fun discard(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        if (plan.deletedAt == null) plan.deletedAt = Instant.now()
    }

    /** Restore a discarded 계획 back to its board/완료 view. Idempotent. */
    fun restore(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        plan.deletedAt = null
    }
```
(`import java.time.Instant` is already present.)

- [ ] **Step 5: Controller — route remap + new endpoints** — `PlanController.kt`:

Change the existing `list` endpoint and `delete` mapping, and add the new routes. The `list` GET stays `GET /api/plans` → `service.list`. Replace the `delete` method and add the others:

```kotlin
    @GetMapping("/completed")
    fun completed(@CurrentWorkspace ws: Workspace): List<PlanSummaryResponse> =
        service.listCompleted(ws.id!!)

    @GetMapping("/trash")
    fun trash(@CurrentWorkspace ws: Workspace): List<PlanSummaryResponse> =
        service.listTrash(ws.id!!)
```

Change the existing delete handler body from `service.delete(...)` to `service.discard(...)`:
```kotlin
    @DeleteMapping("/{planId}")
    fun discard(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): ResponseEntity<Void> {
        service.discard(ws.id!!, planId)
        return ResponseEntity.noContent().build()
    }
```

Add restore + forever:
```kotlin
    @PostMapping("/{planId}/restore")
    fun restore(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): ResponseEntity<Void> {
        service.restore(ws.id!!, planId)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/{planId}/forever")
    fun deleteForever(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): ResponseEntity<Void> {
        service.deleteForever(ws.id!!, planId)
        return ResponseEntity.noContent().build()
    }
```
(`@GetMapping` is already imported.) **Route-order note:** `/completed` and `/trash` are literal paths; Spring matches them ahead of `/{planId}` automatically (literal > variable), so no ordering issue with `GET /{planId}`.

- [ ] **Step 6: Update the superseded lock test** — `PlanLockServiceTest.kt`:

In `while locked, content writes across all four services are rejected`, remove the final assertion block that expects delete to be guarded:
```kotlin
        assertThrows(PlanLockedException::class.java) {
            plans.delete(s.wsId, s.planId)
        }
```
Delete those three lines. (Deletion is no longer lock-guarded — and `plans.delete` no longer exists; it's `deleteForever`.) The other five service-write assertions stay.

- [ ] **Step 7: Update the PlanServiceTest delete test** — `PlanServiceTest.kt`:

The `delete removes the plan and is 404 afterwards` test calls `service.delete`, which is now `discard`. Rewrite it to assert soft-delete semantics:
```kotlin
    @Test
    fun `discard soft-deletes the plan - 404 on tree, gone from board, present in trash`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "x"))

        service.discard(ws.id!!, plan.id)

        assertThrows(PlanNotFoundException::class.java) { service.getTree(ws.id!!, plan.id) }
        assertTrue(service.list(ws.id!!).isEmpty())
        assertTrue(service.listTrash(ws.id!!).any { it.id == plan.id })
    }
```

- [ ] **Step 8: Run the trash + lifecycle + lock tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanTrashServiceTest" --tests "com.shareddocs.backend.decision.PlanLifecycleServiceTest" --tests "com.shareddocs.backend.decision.PlanLockServiceTest" --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: ALL PASS (including the previously-failing `list excludes completed` and `discard...` tests).

- [ ] **Step 9: Full backend suite (no regressions)**

Run: `./gradlew test`
Expected: BUILD SUCCESSFUL. (`DecisionAggregationTest` line ~142 calls `plans.update(..., UpdatePlanRequest(title = "P2"))` with no `status` — still compiles since the field is gone.)

- [ ] **Step 10: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanLockServiceTest.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanTrashServiceTest.kt
git commit -m "feat(decisions): plan discard/restore/purge + board/완료/휴지통 reads

Lock becomes content-only — deletion (now deleteForever) is no longer guarded.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend — status + trash UI

Types/hooks/events, the 완료/다시 진행 toggle in PlanDetail, and the DecisionList board→[보드/완료/휴지통/활동] with per-view card actions.

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`
- Modify: `src/features/decisions/formatPlanEvent.tsx`
- Modify: `src/features/decisions/DecisionList.tsx`
- Modify: `src/features/decisions/DecisionList.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

> Gate: `npx tsc -b --noEmit` (NOT `tsc --noEmit`) + `npm run build`. Lint only `src/features/decisions`.

- [ ] **Step 1: Branch**

```bash
cd shared-docs && git checkout -b complete-discard
```

- [ ] **Step 2: types.ts**

- Change line 1 `export type PlanStatus = 'ACTIVE' | 'ARCHIVED'` → `export type PlanStatus = 'ACTIVE' | 'COMPLETED'`.
- In `PlanSummary`, after `lockedByUserId: number | null` add `  deletedAt: string | null`.
- In `UpdatePlanPayload`, remove `status?: PlanStatus;` → `export type UpdatePlanPayload = { title?: string; description?: string; groupLabel?: string }`.
- Extend `PlanEventType`:
```ts
export type PlanEventType =
  | 'PLAN_CREATED' | 'SUBPLAN_ADDED' | 'OPTION_ADDED'
  | 'DECISION_LOCKED' | 'DECISION_CHANGED' | 'DECISION_REOPENED'
  | 'PLAN_LOCKED' | 'PLAN_UNLOCKED'
  | 'PLAN_COMPLETED' | 'PLAN_UNCOMPLETED'
```

- [ ] **Step 3: api.ts** — add query keys, queries, and mutations.

In `decisionKeys`, add after `list`:
```ts
  completed: (wsId: number | null) => ['decisions', wsId, 'completed'] as const,
  trash: (wsId: number | null) => ['decisions', wsId, 'trash'] as const,
```

Add queries (after `usePlans`):
```ts
export function useCompletedPlans(enabled = true) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.completed(activeId),
    queryFn: async () => (await apiClient.get<PlanSummary[]>('/api/plans/completed')).data,
    enabled: enabled && activeId != null,
  })
}
export function useTrashedPlans(enabled = true) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.trash(activeId),
    queryFn: async () => (await apiClient.get<PlanSummary[]>('/api/plans/trash')).data,
    enabled: enabled && activeId != null,
  })
}
```

Add mutations (after `useDeletePlan`):
```ts
export function useCompletePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/complete`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUncompletePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/uncomplete`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useRestorePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.post(`/api/plans/${id}/restore`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeletePlanForever() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/plans/${id}/forever`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```
(`useDeletePlan` is unchanged — same `DELETE /api/plans/{id}` URL, now a soft-delete server-side.)

- [ ] **Step 4: formatPlanEvent.tsx**

Change the import to add `CheckCircle2` (already imported) — note `CheckCircle2` and `RotateCcw` are already imported for the decision events. Add to the `ICONS` record after `PLAN_UNLOCKED: LockOpen,`:
```tsx
  PLAN_COMPLETED: CheckCircle2,
  PLAN_UNCOMPLETED: RotateCcw,
```
Add to the `planEventText` switch before `default:`:
```tsx
    case 'PLAN_COMPLETED': return `${actor}님이 계획을 완료했어요`
    case 'PLAN_UNCOMPLETED': return `${actor}님이 계획을 다시 진행했어요`
```

- [ ] **Step 5: DecisionList.tsx — full rewrite of the view logic**

Replace the imports, hooks, tab state, `renderCard`, the tab control, and the body with four views. The complete file:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Pencil, Trash2, Plus, CheckCircle2, RotateCcw } from 'lucide-react'
import {
  Page, PageHeader, PageTitle, Fab, Card, Badge, IconButton,
  EmptyState, ErrorState, Skeleton, Tabs,
} from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useFeed,
  useCompletedPlans, useTrashedPlans, useCompletePlan, useUncompletePlan,
  useRestorePlan, useDeletePlanForever,
} from './api'
import PlanModal from './PlanModal'
import Timeline from './Timeline'
import styles from './DecisionList.module.css'
import type { PlanSummary } from './types'

const UNGROUPED = '분류 없음'
type Tab = 'board' | 'completed' | 'trash' | 'feed'

type Section = { key: string; label: string; named: boolean; plans: PlanSummary[] }

/** Group plans into sections: named groups sorted Korean-aware, "분류 없음" last. */
function toSections(plans: PlanSummary[]): { sections: Section[]; hasNamedGroup: boolean; groupOptions: string[] } {
  const byGroup = new Map<string, PlanSummary[]>()
  for (const p of plans) {
    const g = p.groupLabel?.trim() || ''
    const key = g || UNGROUPED
    const arr = byGroup.get(key)
    if (arr) arr.push(p)
    else byGroup.set(key, [p])
  }
  const named = [...byGroup.keys()].filter((k) => k !== UNGROUPED).sort((a, b) => a.localeCompare(b, 'ko'))
  const sections: Section[] = named.map((label) => ({ key: label, label, named: true, plans: byGroup.get(label)! }))
  if (byGroup.has(UNGROUPED)) {
    sections.push({ key: UNGROUPED, label: UNGROUPED, named: false, plans: byGroup.get(UNGROUPED)! })
  }
  return { sections, hasNamedGroup: named.length > 0, groupOptions: named }
}

export default function DecisionList() {
  const navigate = useNavigate()
  const { data: plans, isLoading, isError, error, refetch } = usePlans()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const discard = useDeletePlan()
  const complete = useCompletePlan()
  const uncomplete = useUncompletePlan()
  const restore = useRestorePlan()
  const purge = useDeletePlanForever()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanSummary | null>(null)
  const [tab, setTab] = useState<Tab>('board')

  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) => uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'
  const planNameOf = (id: number) => (plans ?? []).find((p) => p.id === id)?.title ?? '계획'

  const { data: feed, isLoading: feedLoading } = useFeed(tab === 'feed')
  const { data: completed, isLoading: completedLoading } = useCompletedPlans(tab === 'completed')
  const { data: trashed, isLoading: trashLoading } = useTrashedPlans(tab === 'trash')

  const { sections, hasNamedGroup, groupOptions } = useMemo(() => toSections(plans ?? []), [plans])

  const onDiscard = (p: PlanSummary) => {
    if (window.confirm('휴지통으로 이동할까요? 휴지통에서 언제든 복원할 수 있어요.')) discard.mutate(p.id)
  }

  const renderCard = (p: PlanSummary, view: 'board' | 'completed') => (
    <Card key={p.id} padding="none" className={styles.card}>
      <button type="button" className={styles.cardMain} onClick={() => navigate(`/decisions/${p.id}`)}>
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{p.title}</span>
          {p.lockedAt != null
            ? <Badge>잠김</Badge>
            : view === 'completed' ? <Badge>완료</Badge> : null}
        </div>
        {p.description && <span className={styles.cardDesc}>{p.description}</span>}
        <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
      </button>
      <div className={styles.cardActions}>
        {view === 'board' ? (
          <IconButton variant="ghost" size="sm" label="완료" onClick={() => complete.mutate(p.id)}><CheckCircle2 size={14} /></IconButton>
        ) : (
          <IconButton variant="ghost" size="sm" label="다시 진행" onClick={() => uncomplete.mutate(p.id)}><RotateCcw size={14} /></IconButton>
        )}
        {view === 'board' && (
          <IconButton variant="ghost" size="sm" label="계획 수정" onClick={() => setEditing(p)}><Pencil size={14} /></IconButton>
        )}
        <IconButton variant="ghost" size="sm" label="휴지통으로 이동" onClick={() => onDiscard(p)}><Trash2 size={14} /></IconButton>
      </div>
    </Card>
  )

  const renderTrashCard = (p: PlanSummary) => (
    <Card key={p.id} padding="none" className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardTop}><span className={styles.cardTitle}>{p.title}</span></div>
        <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
      </div>
      <div className={styles.cardActions}>
        <IconButton variant="ghost" size="sm" label="복원" onClick={() => restore.mutate(p.id)}><RotateCcw size={14} /></IconButton>
        <IconButton variant="ghost" size="sm" label="영구 삭제"
          onClick={() => { if (window.confirm('계획과 모든 안건·선택지·결정이 완전히 사라집니다. 되돌릴 수 없어요.')) purge.mutate(p.id) }}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </Card>
  )

  return (
    <Page>
      <PageHeader><PageTitle icon={<Vote size={22} strokeWidth={2} />}>결정</PageTitle></PageHeader>

      <Tabs
        className={styles.tabs}
        items={[{ key: 'board', label: '보드' }, { key: 'completed', label: '완료' }, { key: 'trash', label: '휴지통' }, { key: 'feed', label: '활동' }]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'feed' && (
        feedLoading
          ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
          : <Timeline events={feed ?? []} nameOf={nameOf} planNameOf={planNameOf}
                      onEventClick={(e) => navigate(`/decisions/${e.planId}`)} />
      )}

      {tab === 'board' && (
        <>
          {isLoading && (
            <div className={styles.list}>
              <Skeleton height={84} radius="var(--r-md)" />
              <Skeleton height={84} radius="var(--r-md)" />
            </div>
          )}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}
          {plans && plans.length === 0 && (
            <EmptyState icon={<Vote size={24} strokeWidth={1.5} />} title="아직 계획이 없어요"
                        description="함께 정할 일을 계획으로 추가해 보세요." />
          )}
          {plans && plans.length > 0 && (
            hasNamedGroup ? (
              <div className={styles.board}>
                {sections.map((sec) => (
                  <section key={sec.key} className={styles.section}>
                    <header className={styles.sectionHead}>
                      <span className={styles.sectionLabel}>{sec.label}</span>
                      <span className={styles.sectionCount}>계획 {sec.plans.length}</span>
                    </header>
                    <div className={styles.list}>{sec.plans.map((p) => renderCard(p, 'board'))}</div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.list}>{plans.map((p) => renderCard(p, 'board'))}</div>
            )
          )}
        </>
      )}

      {tab === 'completed' && (
        completedLoading
          ? <div className={styles.list}><Skeleton height={84} radius="var(--r-md)" /></div>
          : (completed && completed.length > 0
              ? <div className={styles.list}>{completed.map((p) => renderCard(p, 'completed'))}</div>
              : <EmptyState title="완료된 계획이 없어요" description="계획을 완료하면 여기로 모여요." />)
      )}

      {tab === 'trash' && (
        trashLoading
          ? <div className={styles.list}><Skeleton height={84} radius="var(--r-md)" /></div>
          : (trashed && trashed.length > 0
              ? <div className={styles.list}>{trashed.map(renderTrashCard)}</div>
              : <EmptyState title="휴지통이 비어 있어요" description="삭제한 계획이 여기에 머물러요." />)
      )}

      {tab === 'board' && <Fab label="계획 추가" icon={<Plus size={26} strokeWidth={2.5} />} onClick={() => setAdding(true)} />}

      <PlanModal
        open={adding} onClose={() => setAdding(false)} groupOptions={groupOptions} busy={create.isPending}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setAdding(false) })}
      />
      <PlanModal
        key={`plan-edit-${editing?.id ?? 'none'}`}
        open={editing != null} onClose={() => setEditing(null)} groupOptions={groupOptions}
        initial={editing ? { title: editing.title, description: editing.description, groupLabel: editing.groupLabel } : null}
        busy={update.isPending}
        onSubmit={(payload) => { if (!editing) return; update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) }) }}
      />
    </Page>
  )
}
```

- [ ] **Step 6: DecisionList.module.css** — the rewrite reuses existing classes (`.card`, `.cardMain`, `.cardTop`, `.cardTitle`, `.cardDesc`, `.cardMeta`, `.cardActions`, `.list`, `.board`, `.section`, `.sectionHead`, `.sectionLabel`, `.sectionCount`, `.tabs`). No new classes are needed. **Verify** `.cardMain` works as a non-button `<div>` in the trash card (it's a `<button>` elsewhere) — if `.cardMain` has button-only styling that looks wrong on a div, add `text-align: left;`/`width: 100%` as needed; otherwise leave the CSS unchanged.

- [ ] **Step 7: PlanDetail.tsx — 완료 toggle in the planBar**

Add `CheckCircle2, RotateCcw` to the lucide import:
```tsx
import { Plus, Lock, LockOpen, CheckCircle2, RotateCcw } from 'lucide-react'
```
Add the hooks to the `./api` import list: `useCompletePlan, useUncompletePlan`.
Instantiate after `const unlockPlan = useUnlockPlan()`:
```tsx
  const completePlan = useCompletePlan()
  const uncompletePlan = useUncompletePlan()
```
Derive after `const locked = tree?.lockedAt != null`:
```tsx
  const completed = tree?.status === 'COMPLETED'
```
In the `.planBar`, add a complete toggle next to the lock toggle (after the lock/unlock `Button` block, still inside `.planBar`):
```tsx
            {completed ? (
              <Button variant="ghost" size="sm" leading={<RotateCcw size={14} />} disabled={uncompletePlan.isPending}
                onClick={() => uncompletePlan.mutate(tree.id)}>다시 진행</Button>
            ) : (
              <Button variant="ghost" size="sm" leading={<CheckCircle2 size={14} />} disabled={completePlan.isPending}
                onClick={() => completePlan.mutate(tree.id)}>완료</Button>
            )}
```
Add a calm "완료됨" banner under the lock banner (after the `{locked && (...)}` block):
```tsx
          {completed && (
            <div className={styles.lockBanner}>
              <CheckCircle2 size={14} className={styles.lockBannerIcon} aria-hidden="true" />
              <span>완료된 계획이에요. ‘다시 진행’으로 되돌릴 수 있어요.</span>
            </div>
          )}
```

- [ ] **Step 8: PlanDetail.module.css** — no new classes (reuses `.planBar`, `.lockBanner`, `.lockBannerIcon`). If the planBar now wraps awkwardly with three buttons, add `flex-wrap: wrap;` to `.planBar` — otherwise leave it.

- [ ] **Step 9: Type-check + build + lint**

```bash
cd shared-docs
npx tsc -b --noEmit   # expected: no errors
npm run build         # expected: success
npx eslint src/features/decisions   # expected: no new errors
```

- [ ] **Step 10: Manual verification**

Backend running + `npm run dev`. On 결정: complete a plan → it leaves 보드, appears under 완료 with a 완료 badge, 활동 shows "…계획을 완료했어요"; 다시 진행 returns it. Trash a board plan ("휴지통으로 이동") → it's gone from 보드, appears in 휴지통; 복원 brings it back; 영구 삭제 (with confirm) removes it. Lock a plan, then complete and discard it → both succeed (lock = content only).

- [ ] **Step 11: Commit**

```bash
git add src/features/decisions/
git commit -m "feat(decisions): complete + discard UI — 완료/휴지통 tabs, toggles, trash

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §4.1 status enum + events + remove status-from-update → Task 1 (Steps 2,4,5) + Task 2 (events used).
- §4.1 complete/uncomplete actions + endpoints → Task 2.
- §4.2 deletedAt + discard/restore/deleteForever + route remap → Task 1 (Step 3 column) + Task 3.
- §4.3 read split (list/listCompleted/listTrash) + delete-aware getTree → Task 3 (Steps 3–4).
- §4.4 deletedAt on summary DTO → Task 1 (Step 4).
- §4.5 controller endpoints table → Task 2 (Step 4) + Task 3 (Step 5).
- §5 frontend types/hooks/events/DecisionList/PlanDetail → Task 4.
- §6 lock revision (remove guard from deleteForever + update PlanLockServiceTest) → Task 3 (Steps 4,6).
- §8 testing → Task 2/3 tests + Task 4 gates.
- Migration V19 → Task 1 (Step 6).

**Placeholder scan:** none — every code step has full content.

**Type/name consistency:** `PlanStatus = ACTIVE|COMPLETED` (backend enum ↔ TS union); `deletedAt` (entity `deleted_at` ↔ DTO ↔ TS); service methods `complete`/`uncomplete`/`discard`/`restore`/`deleteForever`/`list`/`listCompleted`/`listTrash`/`summariesOf` consistent across service, controller, repo, and tests; repo `findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc` / `findAllByWorkspaceIdAndDeletedAtIsNotNullOrderByDeletedAtDesc` / `findByIdAndWorkspaceIdAndDeletedAtIsNull` used consistently; hooks `useCompletePlan`/`useUncompletePlan`/`useRestorePlan`/`useDeletePlanForever`/`useCompletedPlans`/`useTrashedPlans`; events `PLAN_COMPLETED`/`PLAN_UNCOMPLETED` in backend enum + TS union + `formatPlanEvent`. The old `findAllByWorkspaceIdOrderByCreatedAtDesc` is removed and its only caller (`list`) repointed.
