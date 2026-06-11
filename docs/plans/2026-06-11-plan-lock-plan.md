# Plan Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any workspace member freeze a 계획 to fully read-only (and unlock it again), enforced server-side across every content write.

**Architecture:** An orthogonal `lockedAt`/`lockedByUserId` flag on `Plan` (independent of `PlanStatus`); dedicated `POST /api/plans/{id}/lock` + `/unlock` actions that emit `PLAN_LOCKED`/`PLAN_UNLOCKED` timeline events; a `PlanLockGuard` component that throws `PlanLockedException` (409) from all 14 content-mutating service methods; frontend hides every edit affordance and shows a banner when locked.

**Tech Stack:** Spring Boot 3.5 + Kotlin, JPA/Hibernate (`ddl-auto: validate`), Flyway (MariaDB :3307), JUnit `@SpringBootTest`; React 19 + TS, React Query, `@dnd-kit`, `@xyflow/react`, lucide-react.

**Design doc:** `docs/plans/2026-06-11-plan-lock-design.md`

**Repos:** backend = `shared-docs-backend` (work on a new feature branch `plan-lock`); frontend = `shared-docs` (Task 4, branch `plan-lock`).

**Backend test prereq:** the `test` profile runs against MariaDB on `localhost:3307`, schema `shared_docs_test`. Flyway applies migrations to it on context start. Run a focused test with e.g. `./gradlew test --tests "com.shareddocs.backend.decision.PlanLockServiceTest"`.

---

### Task 1: Backend — lock columns, migration, DTO exposure

Add the two nullable columns to `Plan`, a Flyway migration mirroring the existing `created_by_user_id` FK treatment, and surface `lockedAt`/`lockedByUserId` on the read DTOs. No behavior yet — just the data model and its exposure.

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/Plan.kt`
- Create: `shared-docs-backend/src/main/resources/db/migration/V18__plan_lock.sql`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/PlanLockServiceTest.kt` (create)

- [ ] **Step 1: Create the feature branch**

```bash
cd shared-docs-backend
git checkout -b plan-lock
```

- [ ] **Step 2: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/decision/PlanLockServiceTest.kt`. This references API added across Tasks 1–3; the compiler red is the failing state. (Later tasks add `plans.lock`/`unlock` and the guard — for Task 1 only the `tree.lockedAt`/summary assertions are exercised.)

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanLockServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val decisions: DecisionService,
    @Autowired private val ratings: RatingService,
    @Autowired private val edges: EdgeService,
    @Autowired private val planRepository: PlanRepository,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val entityManager: EntityManager,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private data class Seed(val wsId: Long, val planId: Long, val subPlanId: Long, val optA: Long, val optB: Long, val user: Long)

    private fun seed(): Seed {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val a = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        val b = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "판교"))
        return Seed(ws.id!!, plan.id, sp.id, a.id, b.id, owner.id!!)
    }

    private fun lockedEventCount(planId: Long) =
        events.findAllByPlanIdOrderByCreatedAtDesc(planId).count { it.type == PlanEventType.PLAN_LOCKED }

    @Test
    fun `a fresh plan is unlocked in the tree`() {
        val s = seed()
        val tree = plans.getTree(s.wsId, s.planId)
        assertNull(tree.lockedAt)
        assertNull(tree.lockedByUserId)
    }

    @Test
    fun `lock stamps lockedAt and lockedByUserId and records PLAN_LOCKED`() {
        val s = seed()
        val summary = plans.lock(s.wsId, s.planId, s.user)
        assertNotNull(summary.lockedAt)
        assertEquals(s.user, summary.lockedByUserId)
        assertEquals(PlanEventType.PLAN_LOCKED, events.findAllByPlanIdOrderByCreatedAtDesc(s.planId).first().type)
    }

    @Test
    fun `unlock clears the flag and records PLAN_UNLOCKED`() {
        val s = seed()
        plans.lock(s.wsId, s.planId, s.user)
        val summary = plans.unlock(s.wsId, s.planId, s.user)
        assertNull(summary.lockedAt)
        assertNull(summary.lockedByUserId)
        assertEquals(PlanEventType.PLAN_UNLOCKED, events.findAllByPlanIdOrderByCreatedAtDesc(s.planId).first().type)
    }

    @Test
    fun `locking twice is idempotent and records only one PLAN_LOCKED`() {
        val s = seed()
        plans.lock(s.wsId, s.planId, s.user)
        plans.lock(s.wsId, s.planId, s.user)
        assertEquals(1, lockedEventCount(s.planId))
    }

    @Test
    fun `unlocking an unlocked plan is a no-op with no event`() {
        val s = seed()
        plans.unlock(s.wsId, s.planId, s.user)
        assertEquals(0, events.findAllByPlanIdOrderByCreatedAtDesc(s.planId).count { it.type == PlanEventType.PLAN_UNLOCKED })
    }

    @Test
    fun `while locked, content writes across all four services are rejected`() {
        val s = seed()
        plans.lock(s.wsId, s.planId, s.user)
        entityManager.flush(); entityManager.clear()

        assertThrows(PlanLockedException::class.java) {
            plans.updateSubPlan(s.wsId, s.subPlanId, UpdateSubPlanRequest(title = "x"))
        }
        assertThrows(PlanLockedException::class.java) {
            plans.updateOption(s.wsId, s.optA, UpdateOptionRequest(title = "y"))
        }
        assertThrows(PlanLockedException::class.java) {
            decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(s.optA, reason = "r"))
        }
        assertThrows(PlanLockedException::class.java) {
            ratings.upsert(s.wsId, s.optA, s.user, RateOptionRequest(score = 3))
        }
        assertThrows(PlanLockedException::class.java) {
            edges.create(s.wsId, s.planId, CreateEdgeRequest(s.subPlanId, s.subPlanId))
        }
        assertThrows(PlanLockedException::class.java) {
            plans.delete(s.wsId, s.planId)
        }
    }

    @Test
    fun `reads still work while locked`() {
        val s = seed()
        plans.lock(s.wsId, s.planId, s.user)
        entityManager.flush(); entityManager.clear()
        val tree = plans.getTree(s.wsId, s.planId)
        assertNotNull(tree.lockedAt)
        assertEquals(1, tree.subPlans.size)
    }

    @Test
    fun `after unlock the same edit succeeds`() {
        val s = seed()
        plans.lock(s.wsId, s.planId, s.user)
        plans.unlock(s.wsId, s.planId, s.user)
        entityManager.flush(); entityManager.clear()
        val updated = plans.updateSubPlan(s.wsId, s.subPlanId, UpdateSubPlanRequest(title = "바뀜"))
        assertEquals("바뀜", updated.title)
    }
}
```

- [ ] **Step 3: Run the test to verify it fails (compile error)**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.PlanLockServiceTest"`
Expected: FAIL — unresolved references (`plans.lock`, `tree.lockedAt`, `PlanLockedException`, etc.). That's the red state; Tasks 1–3 turn it green.

- [ ] **Step 4: Add the lock columns to the `Plan` entity**

In `Plan.kt`, add the `Instant` import and two fields. Replace the import block top and add the fields after `groupLabel`:

Add import (with the other `jakarta.persistence.*` imports, plus `java.time.Instant`):

```kotlin
import java.time.Instant
```

Add these fields inside the `Plan(...)` constructor, after the `groupLabel` property (line 42), before the closing `) : BaseEntity()`:

```kotlin
    @Column(name = "locked_at")
    var lockedAt: Instant? = null,

    @Column(name = "locked_by_user_id")
    var lockedByUserId: Long? = null,
```

- [ ] **Step 5: Create the Flyway migration**

Create `src/main/resources/db/migration/V18__plan_lock.sql`:

```sql
-- Plan lock (Decisions backlog A.1): freeze a 계획 to read-only. Two nullable
-- columns orthogonal to `status` — lockedAt non-null = locked. locked_by_user_id
-- mirrors created_by_user_id (reference-by-id with a RESTRICT FK to users).
ALTER TABLE `plans`
  ADD COLUMN `locked_at`          datetime(6) DEFAULT NULL,
  ADD COLUMN `locked_by_user_id`  bigint(20)  DEFAULT NULL,
  ADD CONSTRAINT `fk_plans_locked_by` FOREIGN KEY (`locked_by_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT;
```

- [ ] **Step 6: Add the DTO fields**

In `DecisionDto.kt`, add the two fields to `PlanSummaryResponse` (after `createdAt`, line 92) and to `PlanTreeResponse` (after `createdAt`, line 104).

`PlanSummaryResponse` — change:

```kotlin
    val createdByUserId: Long,
    val createdAt: Instant,
)
```

to:

```kotlin
    val createdByUserId: Long,
    val createdAt: Instant,
    val lockedAt: Instant?,
    val lockedByUserId: Long?,
)
```

`PlanTreeResponse` — change:

```kotlin
    val createdByUserId: Long,
    val createdAt: Instant,
    val subPlans: List<SubPlanResponse>,
    val edges: List<SubPlanEdgeResponse>,
)
```

to:

```kotlin
    val createdByUserId: Long,
    val createdAt: Instant,
    val lockedAt: Instant?,
    val lockedByUserId: Long?,
    val subPlans: List<SubPlanResponse>,
    val edges: List<SubPlanEdgeResponse>,
)
```

- [ ] **Step 7: Populate the new fields in `PlanService` mappers**

In `PlanService.kt`, update the `toSummary` mapper (lines 319–331) to pass the lock fields. Change:

```kotlin
    private fun Plan.toSummary(subPlanCount: Int, decidedCount: Int) = PlanSummaryResponse(
        id = id!!,
        title = title,
        description = description,
        status = status,
        canvasX = canvasX,
        canvasY = canvasY,
        groupLabel = groupLabel,
        subPlanCount = subPlanCount,
        decidedCount = decidedCount,
        createdByUserId = createdByUserId,
        createdAt = createdAt!!,
    )
```

to:

```kotlin
    private fun Plan.toSummary(subPlanCount: Int, decidedCount: Int) = PlanSummaryResponse(
        id = id!!,
        title = title,
        description = description,
        status = status,
        canvasX = canvasX,
        canvasY = canvasY,
        groupLabel = groupLabel,
        subPlanCount = subPlanCount,
        decidedCount = decidedCount,
        createdByUserId = createdByUserId,
        createdAt = createdAt!!,
        lockedAt = lockedAt,
        lockedByUserId = lockedByUserId,
    )
```

In `getTree` (the `PlanTreeResponse(...)` constructor, lines 95–107), add the two fields after `createdAt = plan.createdAt!!,`:

```kotlin
            createdAt = plan.createdAt!!,
            lockedAt = plan.lockedAt,
            lockedByUserId = plan.lockedByUserId,
            subPlans = subPlanResponses,
```

- [ ] **Step 8: Verify it compiles and the context loads (migration matches entity)**

The `PlanLockServiceTest` still won't fully pass (no `lock`/`unlock`/guard yet), but the app context must start — confirming the V18 migration matches the entity under `ddl-auto: validate`. Run the existing decision suite as a smoke check:

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.PlanTreeTest"`
Expected: PASS (context starts, validate passes, tree read works with the new nullable fields serialized).

- [ ] **Step 9: Commit**

```bash
cd shared-docs-backend
git add src/main/kotlin/com/shareddocs/backend/decision/Plan.kt \
        src/main/resources/db/migration/V18__plan_lock.sql \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanLockServiceTest.kt
git commit -m "feat(decisions): add plan lock columns + DTO exposure

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — lock/unlock actions + timeline events

Add the two `PlanEventType` values, the idempotent `lock`/`unlock` service methods, and the controller endpoints.

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt`
- Test: `PlanLockServiceTest.kt` (already written in Task 1; the lock/unlock + idempotency tests go green here)

- [ ] **Step 1: Add the event types**

In `PlanEnums.kt`, add two values to `PlanEventType` (after `DECISION_CHANGED`). The `type` column is varchar(40) — both names fit.

```kotlin
enum class PlanEventType {
    PLAN_CREATED,
    SUBPLAN_ADDED,
    OPTION_ADDED,
    DECISION_LOCKED,
    DECISION_REOPENED,
    DECISION_CHANGED,
    PLAN_LOCKED,
    PLAN_UNLOCKED,
}
```

- [ ] **Step 2: Add `lock`, `unlock`, and a `summaryOf` helper to `PlanService`**

In `PlanService.kt`, add `import java.time.Instant` at the top (with the other imports). Add the two methods immediately after `create(...)` (i.e. after line 44), and a private `summaryOf` helper near the other private helpers (e.g. after `requirePlan`, line 285):

```kotlin
    /**
     * Freeze a 계획 to read-only (any member may; soft-lock philosophy). Idempotent:
     * re-locking an already-locked plan changes nothing and records no second event.
     * The freeze itself is enforced by [PlanLockGuard] on every content write.
     */
    fun lock(workspaceId: Long, planId: Long, actorUserId: Long): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        if (plan.lockedAt == null) {
            plan.lockedAt = Instant.now()
            plan.lockedByUserId = actorUserId
            events.record(
                workspaceId = workspaceId,
                planId = planId,
                subPlanId = null,
                type = PlanEventType.PLAN_LOCKED,
                actorUserId = actorUserId,
                payload = mapOf("title" to plan.title),
            )
        }
        return summaryOf(plan)
    }

    /** Thaw a frozen 계획. Idempotent — unlocking an unlocked plan records no event. */
    fun unlock(workspaceId: Long, planId: Long, actorUserId: Long): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        if (plan.lockedAt != null) {
            plan.lockedAt = null
            plan.lockedByUserId = null
            events.record(
                workspaceId = workspaceId,
                planId = planId,
                subPlanId = null,
                type = PlanEventType.PLAN_UNLOCKED,
                actorUserId = actorUserId,
                payload = mapOf("title" to plan.title),
            )
        }
        return summaryOf(plan)
    }
```

And the helper (DRY — factors the roll-up count logic that `update` already does):

```kotlin
    /** Build a summary with the 안건/결정 roll-up counts for a loaded plan. */
    private fun summaryOf(plan: Plan): PlanSummaryResponse {
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(plan.id!!)
        val subPlanIds = subPlans.mapNotNull { it.id }
        val decidedCount = if (subPlanIds.isEmpty()) 0
            else decisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds).size
        return plan.toSummary(subPlanCount = subPlans.size, decidedCount = decidedCount)
    }
```

Refactor `update` (lines 110–123) to use the helper. Change its tail:

```kotlin
        request.groupLabel?.let { plan.groupLabel = it.trim().ifBlank { null } }
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        val subPlanIds = subPlans.mapNotNull { it.id }
        val decidedCount = if (subPlanIds.isEmpty()) 0
            else decisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds).size
        return plan.toSummary(subPlanCount = subPlans.size, decidedCount = decidedCount)
    }
```

to:

```kotlin
        request.groupLabel?.let { plan.groupLabel = it.trim().ifBlank { null } }
        return summaryOf(plan)
    }
```

- [ ] **Step 3: Add the controller endpoints**

In `PlanController.kt`, add two endpoints after `reorderSubPlans` (the last method, before the class closing brace at line 76):

```kotlin
    @PostMapping("/{planId}/lock")
    fun lock(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
    ): PlanSummaryResponse = service.lock(ws.id!!, planId, me.userId)

    @PostMapping("/{planId}/unlock")
    fun unlock(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
    ): PlanSummaryResponse = service.unlock(ws.id!!, planId, me.userId)
```

- [ ] **Step 4: Run the lock/unlock tests**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.PlanLockServiceTest" --tests "*PlanLockServiceTest.lock*" --tests "*PlanLockServiceTest.unlock*"`

(Or just run the whole `PlanLockServiceTest` class — the four lock/unlock/idempotency tests + `a fresh plan is unlocked` should now PASS; the `while locked ... rejected` and `after unlock` tests still FAIL until Task 3.)

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanLockServiceTest"`
Expected: the lock/unlock/idempotency/read tests PASS; only `while locked, content writes ... rejected` and `after unlock the same edit succeeds` still fail (no guard yet) — note `after unlock` actually passes here since nothing blocks it; only the `rejected` test fails.

- [ ] **Step 5: Commit**

```bash
cd shared-docs-backend
git add src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt
git commit -m "feat(decisions): lock/unlock plan actions + timeline events

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend — PlanLockGuard + freeze enforcement

Add the exception, the two boolean lock queries, the `PlanLockGuard` component, and wire `assert*` into all 14 content writes across four services.

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanLockGuard.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/RatingService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/EdgeService.kt`
- Test: `PlanLockServiceTest.kt` (the `while locked ... rejected` + `after unlock` tests go green here)

- [ ] **Step 1: Add the exception**

In `DecisionExceptions.kt`, append:

```kotlin
/** A write was attempted against a locked (frozen) 계획. Unlock it first. */
class PlanLockedException :
    ApiException(HttpStatus.CONFLICT, "plan-locked", "Plan is locked", "잠긴 계획은 수정할 수 없어요. 먼저 잠금을 해제해 주세요.")
```

- [ ] **Step 2: Add the boolean lock queries to `PlanRepository`**

In `PlanRepository.kt`, add the imports and two `@Query` methods. The `CASE WHEN ... THEN true ELSE false END` form is portable across Hibernate dialects; the SubPlan variant is a theta-join (SubPlan has `planId` as a plain column, no JPA relation). Both return `Boolean?` — `null` only if the row is absent, which can't happen because the guard runs after the caller's `requireX` existence check.

```kotlin
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
```

```kotlin
    /** True if the plan is currently locked. Null only if the plan id doesn't exist. */
    @Query("SELECT CASE WHEN p.lockedAt IS NOT NULL THEN true ELSE false END FROM Plan p WHERE p.id = :planId")
    fun isLockedByPlanId(@Param("planId") planId: Long): Boolean?

    /** True if the plan owning the given 안건 is locked. Null only if the 안건 doesn't exist. */
    @Query(
        "SELECT CASE WHEN p.lockedAt IS NOT NULL THEN true ELSE false END " +
            "FROM Plan p, SubPlan s WHERE s.id = :subPlanId AND s.planId = p.id",
    )
    fun isLockedBySubPlanId(@Param("subPlanId") subPlanId: Long): Boolean?
```

- [ ] **Step 3: Create the `PlanLockGuard`**

Create `src/main/kotlin/com/shareddocs/backend/decision/PlanLockGuard.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.stereotype.Component

/**
 * Single owner of the plan-freeze policy. Every content-mutating method in the
 * decision module calls one of these `assert*` guards immediately after its
 * `requireX` existence/scoping check and before any write; a locked 계획 throws
 * [PlanLockedException] (409). The lock/unlock actions themselves and all reads
 * are intentionally NOT guarded.
 *
 * Three entry points so each caller uses the id it already holds — no caller has
 * to load a full Plan just to check the flag:
 *  - [assertUnlocked] when the Plan is already in hand,
 *  - [assertUnlockedByPlanId] for entities carrying a planId (안건, edge),
 *  - [assertUnlockedBySubPlanId] for option/rating writes that hold only a subPlanId.
 */
@Component
class PlanLockGuard(
    private val planRepository: PlanRepository,
) {
    fun assertUnlocked(plan: Plan) {
        if (plan.lockedAt != null) throw PlanLockedException()
    }

    fun assertUnlockedByPlanId(planId: Long) {
        if (planRepository.isLockedByPlanId(planId) == true) throw PlanLockedException()
    }

    fun assertUnlockedBySubPlanId(subPlanId: Long) {
        if (planRepository.isLockedBySubPlanId(subPlanId) == true) throw PlanLockedException()
    }
}
```

- [ ] **Step 4: Wire the guard into `PlanService` (9 writes)**

In `PlanService.kt`, add `private val lockGuard: PlanLockGuard,` to the constructor (after `events: PlanEventRecorder,`). Then add a guard call as the first line after each method's `requireX`:

`update` (after `val plan = requirePlan(workspaceId, planId)`):
```kotlin
        val plan = requirePlan(workspaceId, planId)
        lockGuard.assertUnlocked(plan)
```

`delete` (after `val plan = requirePlan(workspaceId, planId)`):
```kotlin
        val plan = requirePlan(workspaceId, planId)
        lockGuard.assertUnlocked(plan)
```

`addSubPlan` — change `requirePlan(workspaceId, planId)` (line 159, currently discards the result) to:
```kotlin
        val plan = requirePlan(workspaceId, planId) // 404 if plan absent / wrong workspace
        lockGuard.assertUnlocked(plan)
```

`reorderSubPlans` — change `requirePlan(workspaceId, planId)` (line 205) to:
```kotlin
        val plan = requirePlan(workspaceId, planId) // 404 if plan absent / wrong workspace
        lockGuard.assertUnlocked(plan)
```

`updateSubPlan` (after `val subPlan = requireSubPlan(workspaceId, subPlanId)`):
```kotlin
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
```

`deleteSubPlan` (after `val subPlan = requireSubPlan(workspaceId, subPlanId)`):
```kotlin
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
```

`addOption` (after `val subPlan = requireSubPlan(workspaceId, subPlanId)`):
```kotlin
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
```

`updateOption` (after `val option = requireOption(workspaceId, optionId)`):
```kotlin
        val option = requireOption(workspaceId, optionId)
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
```

`deleteOption` (after `val option = requireOption(workspaceId, optionId)`):
```kotlin
        val option = requireOption(workspaceId, optionId)
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
```

- [ ] **Step 5: Wire the guard into `DecisionService` (2 writes)**

In `DecisionService.kt`, add `private val lockGuard: PlanLockGuard,` to the constructor (after `events: PlanEventRecorder,`). Add the guard after `requireSubPlan` in both methods:

`lock` (after `val subPlan = requireSubPlan(workspaceId, subPlanId)`):
```kotlin
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
```

`reopen` (after `val subPlan = requireSubPlan(workspaceId, subPlanId)`):
```kotlin
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
```

- [ ] **Step 6: Wire the guard into `RatingService` (2 writes)**

In `RatingService.kt`, add `private val lockGuard: PlanLockGuard,` to the constructor (after `optionRatingRepository: OptionRatingRepository,`). Both methods currently call `requireOption(...)` and discard the result — capture it and guard:

`upsert` — change `requireOption(workspaceId, optionId)` (line 20) to:
```kotlin
        val option = requireOption(workspaceId, optionId)
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
```

`delete` — change `requireOption(workspaceId, optionId)` (line 46) to:
```kotlin
        val option = requireOption(workspaceId, optionId)
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
```

- [ ] **Step 7: Wire the guard into `EdgeService` (2 writes)**

In `EdgeService.kt`, add `private val lockGuard: PlanLockGuard,` to the constructor (after `edgeRepository: SubPlanEdgeRepository,`).

`create` — change `planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()` (line 21) to capture the plan and guard:
```kotlin
        val plan = planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()
        lockGuard.assertUnlocked(plan)
```

`delete` (after `val edge = edgeRepository.findByIdAndWorkspaceId(edgeId, workspaceId) ?: throw SubPlanEdgeNotFoundException()`):
```kotlin
        val edge = edgeRepository.findByIdAndWorkspaceId(edgeId, workspaceId) ?: throw SubPlanEdgeNotFoundException()
        lockGuard.assertUnlockedByPlanId(edge.planId)
```

- [ ] **Step 8: Run the full lock test class**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.PlanLockServiceTest"`
Expected: ALL tests PASS — including `while locked, content writes across all four services are rejected` and `after unlock the same edit succeeds`. (The `entityManager.flush(); clear()` in those tests forces Hibernate to round-trip, so the guard's JPQL query sees the persisted lock state.)

- [ ] **Step 9: Run the whole backend suite (no regressions)**

Run: `cd shared-docs-backend && ./gradlew test`
Expected: BUILD SUCCESSFUL. The guard additions are no-ops on unlocked plans, so existing decision tests stay green.

- [ ] **Step 10: Commit**

```bash
cd shared-docs-backend
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanLockGuard.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/RatingService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/EdgeService.kt
git commit -m "feat(decisions): PlanLockGuard enforces freeze on all content writes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend — types, hooks, read-only gating, timeline labels

Surface the lock state in TS types, add the lock/unlock mutation hooks, render the header toggle + banner, thread a `locked` flag through the list and canvas to hide every edit affordance, label the new timeline events, and badge locked plans on the roadmap.

**Files:**
- Modify: `shared-docs/src/features/decisions/types.ts`
- Modify: `shared-docs/src/features/decisions/api.ts`
- Modify: `shared-docs/src/features/decisions/formatPlanEvent.tsx`
- Modify: `shared-docs/src/features/decisions/PlanDetail.tsx`
- Modify: `shared-docs/src/features/decisions/PlanDetail.module.css`
- Modify: `shared-docs/src/features/decisions/SortableSubPlanSection.tsx`
- Modify: `shared-docs/src/features/decisions/SubPlanSection.tsx`
- Modify: `shared-docs/src/features/decisions/OptionRow.tsx`
- Modify: `shared-docs/src/features/decisions/PlanCanvas.tsx`
- Modify: `shared-docs/src/features/decisions/DecisionList.tsx`

> No frontend test runner. The gate is `npx tsc -b --noEmit` (NOT `tsc --noEmit` — root tsconfig is a references stub) + `npm run build`, plus manual verification.

- [ ] **Step 1: Branch (frontend)**

```bash
cd shared-docs
git checkout -b plan-lock
```

- [ ] **Step 2: Add lock fields + event types to `types.ts`**

In `PlanSummary` (after `createdAt: string`):
```ts
  lockedAt: string | null
  lockedByUserId: number | null
```

In `PlanTree` (after `createdAt: string`):
```ts
  lockedAt: string | null
  lockedByUserId: number | null
```

Extend the `PlanEventType` union:
```ts
export type PlanEventType =
  | 'PLAN_CREATED' | 'SUBPLAN_ADDED' | 'OPTION_ADDED'
  | 'DECISION_LOCKED' | 'DECISION_CHANGED' | 'DECISION_REOPENED'
  | 'PLAN_LOCKED' | 'PLAN_UNLOCKED'
```

- [ ] **Step 3: Add the lock/unlock hooks to `api.ts`**

Add after `useDeletePlan` (line 77). Both return the updated `PlanSummary` and invalidate the workspace decisions scope so the roadmap, tree, and timeline all refresh:

```ts
export function useLockPlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/lock`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUnlockPlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/unlock`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 4: Label the new timeline events in `formatPlanEvent.tsx`**

Add `Lock` and `LockOpen` to the lucide import, two entries to the `ICONS` record (the `Record<PlanEventType, LucideIcon>` type forces this — TS errors otherwise), and two `switch` cases.

Import line — change:
```tsx
import { Flag, ListPlus, CirclePlus, CheckCircle2, RefreshCw, RotateCcw, type LucideIcon } from 'lucide-react'
```
to:
```tsx
import { Flag, ListPlus, CirclePlus, CheckCircle2, RefreshCw, RotateCcw, Lock, LockOpen, type LucideIcon } from 'lucide-react'
```

`ICONS` — add after `DECISION_REOPENED: RotateCcw,`:
```tsx
  PLAN_LOCKED: Lock,
  PLAN_UNLOCKED: LockOpen,
```

`planEventText` switch — add before `default:`:
```tsx
    case 'PLAN_LOCKED': return `${actor}님이 계획을 잠갔어요`
    case 'PLAN_UNLOCKED': return `${actor}님이 계획 잠금을 해제했어요`
```

- [ ] **Step 5: Add `locked` plumbing to `OptionRow.tsx`**

Add a `locked` prop; when locked, hide the edit/delete icons and freeze the rating control (reuse the existing `busy` disable).

Props type — add after `busy?: boolean`:
```tsx
  locked?: boolean
```

Destructure — change the signature line to include `locked`:
```tsx
export default function OptionRow({
  option, myUserId, isChosen, nameOf, busy, locked, onRate, onClearRating, onEdit, onDelete,
}: Props) {
```

Hide the action buttons — wrap the `.actions` div:
```tsx
        {!locked && (
          <div className={styles.actions}>
            <IconButton variant="ghost" size="sm" label="선택지 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="sm" label="선택지 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
          </div>
        )}
```

Freeze the rating control — change the `<RatingControl ... busy={busy} ... />` line to:
```tsx
          <RatingControl key={myRating ? 'rated' : 'unrated'} myRating={myRating} busy={busy || locked} onRate={onRate} onClear={onClearRating} />
```

- [ ] **Step 6: Add `locked` plumbing to `SubPlanSection.tsx`**

Add a `locked` prop and hide every edit affordance when locked: the action icons (connect/edit/delete + the drag handle), the decision "다시 열기" button, and the footer (선택지 추가 / 결정하기). Pass `locked` down to each `OptionRow`.

Props type — add after `dragHandle?: ReactNode`:
```tsx
  locked?: boolean
```

Destructure — add `locked` to the parameter list:
```tsx
export default function SubPlanSection({
  subPlan, links, onJumpToSubPlan, highlight = 'normal', onHoverChange, myUserId, nameOf, busy, onEdit, onDelete, onAddOption,
  onEditOption, onDeleteOption, onRate, onClearRating, onDecide, onReopen, onOpenConnect, dragHandle, locked,
}: Props) {
```

Header actions — replace the `.actions` block (lines 58–65) with a locked-gated version:
```tsx
        {!locked && (
          <div className={styles.actions}>
            {dragHandle}
            {onOpenConnect && (
              <IconButton variant="ghost" size="sm" label="안건 연결" onClick={onOpenConnect}><Link2 size={14} /></IconButton>
            )}
            <IconButton variant="ghost" size="sm" label="안건 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="sm" label="안건 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
          </div>
        )}
```

Decision banner — gate the "다시 열기" button:
```tsx
      {decision && chosen && (
        <div className={styles.banner}>
          <span className={styles.bannerTag}>결정됨</span>
          <span className={styles.bannerBody}><strong>{chosen.title}</strong> · {decision.reason}</span>
          {!locked && <Button variant="ghost" size="sm" onClick={onReopen} disabled={busy}>다시 열기</Button>}
        </div>
      )}
```

Options list — pass `locked` to `OptionRow` (add the prop to the existing `<OptionRow ... />`):
```tsx
            <OptionRow
              key={o.id}
              option={o}
              myUserId={myUserId}
              isChosen={decision?.chosenOptionId === o.id}
              nameOf={nameOf}
              busy={busy}
              locked={locked}
              onRate={(score, comment) => onRate(o.id, score, comment)}
              onClearRating={() => onClearRating(o.id)}
              onEdit={() => onEditOption(o)}
              onDelete={() => onDeleteOption(o)}
            />
```

Footer — hide entirely when locked. Replace the `.footer` block (lines 124–129):
```tsx
      {!locked && (
        <div className={styles.footer}>
          <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={onAddOption}>선택지 추가</Button>
          {!decision && subPlan.options.length > 0 && (
            <Button variant="soft" size="sm" onClick={onDecide} disabled={busy}>결정하기</Button>
          )}
        </div>
      )}
```

- [ ] **Step 7: Disable sortable drag when locked in `SortableSubPlanSection.tsx`**

Pass `disabled: locked` to `useSortable` (so a locked plan's 안건 can't be dragged) and render the handle only when unlocked.

Props type — change:
```tsx
type Props = ComponentProps<typeof SubPlanSection> & {
  showSpine: boolean
  spineActive: boolean
}
```
(no change needed — `locked` already flows through `ComponentProps<typeof SubPlanSection>`). Update the body:

```tsx
export default function SortableSubPlanSection({ showSpine, spineActive, ...sectionProps }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionProps.subPlan.id, disabled: sectionProps.locked })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const handle = sectionProps.locked ? undefined : (
    <button
      type="button"
      className={sectionStyles.dragHandle}
      aria-label="안건 순서 변경"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={14} />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? sectionStyles.dragging : undefined}>
      {showSpine && <div className={[styles.spine, spineActive && styles.active].filter(Boolean).join(' ')} aria-hidden="true" />}
      <SubPlanSection {...sectionProps} dragHandle={handle} />
    </div>
  )
}
```

- [ ] **Step 8: Disable canvas interactions when locked in `PlanCanvas.tsx`**

Add a `locked` prop to `Props`, thread it into `Flow` and `CanvasEmpty`, hide the "안건 추가" toolbar/empty-state buttons, and turn off React Flow drag/connect/select.

`Props` type — change:
```tsx
type Props = { tree: PlanTree }
```
to:
```tsx
type Props = { tree: PlanTree; locked?: boolean }
```

`PlanCanvas` — pass `locked` through:
```tsx
export default function PlanCanvas({ tree, locked }: Props) {
  if (tree.subPlans.length === 0) {
    return (
      <div className={`${styles.canvas} ${styles.canvasEmpty}`}>
        <CanvasEmpty tree={tree} locked={locked} />
      </div>
    )
  }
  return (
    <ReactFlowProvider>
      <Flow tree={tree} locked={locked} />
    </ReactFlowProvider>
  )
}
```

`CanvasEmpty` — accept and respect `locked` (hide the add button + modal when locked):
```tsx
function CanvasEmpty({ tree, locked }: Props) {
  const [adding, setAdding] = useState(false)
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)
  return (
    <>
      <EmptyState
        title="안건이 없어요"
        description={locked ? '잠긴 계획이에요.' : '안건을 추가하면 여기에 나타나요.'}
        action={locked ? undefined : <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAdding(true)}>안건 추가</Button>}
      />
      {!locked && (
        <TitleDescModal
          open={adding} onClose={() => setAdding(false)} entityLabel="안건" busy={addSubPlanM.isPending}
          onSubmit={(p) => addSubPlanM.mutate(p, { onSuccess: () => setAdding(false) })}
        />
      )}
    </>
  )
}
```

`Flow` — accept `locked`, hide the toolbar, and pass the React Flow gating props:
```tsx
function Flow({ tree, locked }: Props) {
```

Replace the toolbar block (lines 144–147) so it only renders when unlocked:
```tsx
      {!locked && (
        <div className={styles.toolbar}>
          <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAdding(true)}>안건 추가</Button>
        </div>
      )}
```

On the `<ReactFlow ...>` element, add these props (after `maxZoom={1.5}`):
```tsx
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        elementsSelectable={!locked}
        edgesFocusable={!locked}
```

- [ ] **Step 9: Add the toggle + banner styles to `PlanDetail.module.css`**

Append (calm, hairline, no shadow — house aesthetic):

```css
.planBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.lockBanner {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  margin-bottom: var(--sp-4);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  background: var(--c-surface-muted);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.lockBannerIcon {
  flex: none;
  color: var(--c-text-muted);
}
```

- [ ] **Step 10: Wire the toggle, banner, and `locked` threading into `PlanDetail.tsx`**

Add the `Lock`/`LockOpen` icons to the lucide import:
```tsx
import { Plus, Lock, LockOpen } from 'lucide-react'
```

Add the hooks import — change the `./api` import block to include the two new hooks:
```tsx
import {
  usePlanTree, useAddSubPlan, useUpdateSubPlan, useDeleteSubPlan,
  useAddOption, useUpdateOption, useDeleteOption,
  useRateOption, useDeleteRating, useLockDecision, useReopenDecision,
  useTimeline, useCreateEdge, useDeleteEdge, useReorderSubPlans,
  useLockPlan, useUnlockPlan,
} from './api'
```

Instantiate the hooks near the other mutations (after `const reorder = useReorderSubPlans(planId)`, line 51):
```tsx
  const lockPlan = useLockPlan()
  const unlockPlan = useUnlockPlan()
```

Derive `locked` right after `tree` is in scope — add inside the `{tree && (...)}` block. Replace the view-toggle block (lines 153–159) with a `planBar` carrying the toggle, plus a `const locked` derived just before the `return`'s JSX. The cleanest spot: derive it at the top of the component body after the `tree` query (it's used in the `tree && ...` block, so compute defensively):

Add after line 76 (`const { data: timeline ... }`):
```tsx
  const locked = tree?.lockedAt != null
```

Replace the `viewToggle` block:
```tsx
          <div className={styles.planBar}>
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }, { key: 'timeline', label: '기록' }]}
              value={view}
              onChange={setView}
            />
            {locked ? (
              <Button variant="ghost" size="sm" leading={<LockOpen size={14} />} disabled={unlockPlan.isPending}
                onClick={() => unlockPlan.mutate(tree.id)}>잠금 해제</Button>
            ) : (
              <Button variant="ghost" size="sm" leading={<Lock size={14} />} disabled={lockPlan.isPending}
                onClick={() => lockPlan.mutate(tree.id)}>잠금</Button>
            )}
          </div>

          {locked && (
            <div className={styles.lockBanner}>
              <Lock size={14} className={styles.lockBannerIcon} aria-hidden="true" />
              <span>이 계획은 잠겨 있어요. 잠금을 해제하면 다시 편집할 수 있어요.</span>
            </div>
          )}
```

Pass `locked` to the canvas:
```tsx
          {view === 'canvas' && <PlanCanvas tree={tree} locked={locked} />}
```

In the empty-state branch (list view, zero 안건), hide the add action when locked — change the `EmptyState` action:
```tsx
                <EmptyState title="안건이 없어요" description={locked ? '잠긴 계획이에요.' : '결정할 안건을 추가해 보세요.'}
                  action={locked ? undefined : <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>} />
```

Pass `locked` to each `SortableSubPlanSection` (add the prop):
```tsx
                        <SortableSubPlanSection
                          key={sp.id}
                          showSpine={i > 0}
                          spineActive={i > 0 && spineActive(tree.subPlans[i - 1].id, sp.id)}
                          subPlan={sp}
                          links={linksBySubPlan.get(sp.id)}
                          onJumpToSubPlan={jumpToSubPlan}
                          highlight={highlightOf(sp.id)}
                          onHoverChange={(hovered) => setHoveredSubPlanId(hovered ? sp.id : null)}
                          myUserId={myUserId}
                          nameOf={nameOf}
                          locked={locked}
                          busy={rate.isPending || lock.isPending || reopen.isPending || deleteSubPlan.isPending || deleteOption.isPending}
                          onEdit={() => setEditingSubPlan(sp)}
                          ...
```
(leave the remaining handler props unchanged.)

Hide the bottom "안건 추가" row when locked — change the `.addRow` block:
```tsx
                  {!locked && (
                    <div className={styles.addRow}>
                      <Button variant="outline" full leading={<Plus size={16} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>
                    </div>
                  )}
```

- [ ] **Step 11: Badge + freeze affordances on the roadmap in `DecisionList.tsx`**

Show a 잠김 badge and hide edit/delete on locked plan cards (prevents confusing 409s). In `renderCard`, derive `const planLocked = p.lockedAt != null` and use it:

```tsx
  const renderCard = (p: PlanSummary) => {
    const planLocked = p.lockedAt != null
    return (
    <Card key={p.id} padding="none" className={styles.card}>
      <button type="button" className={styles.cardMain} onClick={() => navigate(`/decisions/${p.id}`)}>
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{p.title}</span>
          {planLocked ? <Badge>잠김</Badge> : <Badge>{p.status === 'ARCHIVED' ? '보관됨' : '진행 중'}</Badge>}
        </div>
        {p.description && <span className={styles.cardDesc}>{p.description}</span>}
        <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
      </button>
      {!planLocked && (
        <div className={styles.cardActions}>
          <IconButton variant="ghost" size="sm" label="계획 수정" onClick={() => setEditing(p)}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="계획 삭제"
            onClick={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) remove.mutate(p.id) }}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}
    </Card>
    )
  }
```

- [ ] **Step 12: Type-check and build**

Run: `cd shared-docs && npx tsc -b --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 13: Lint the touched folder**

Run: `cd shared-docs && npx eslint src/features/decisions`
Expected: no new errors in the decisions folder. (`eslint src/` is RED on main from pre-existing debt in other folders — lint only what you touched.)

- [ ] **Step 14: Manual verification**

Start the app (`npm run dev` + backend running). Open a 계획 with at least one 안건 and one 선택지:
1. Click **잠금**. The banner appears; the toggle becomes **잠금 해제**; every 수정/삭제/연결/안건 추가/선택지 추가/결정하기/다시 열기 button and the drag handles disappear; rating controls are disabled. Switch to 캔버스 — nodes can't be dragged, no add button. On the roadmap (결정 list), the card shows a 잠김 badge and no edit/delete.
2. Click **잠금 해제**. All affordances return; editing works again. The 기록 timeline shows "…님이 계획을 잠갔어요" and "…잠금을 해제했어요".

- [ ] **Step 15: Commit**

```bash
cd shared-docs
git add src/features/decisions/
git commit -m "feat(decisions): plan lock UI — toggle, banner, read-only gating

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §4.1 data model + migration → Task 1 (Steps 4–5).
- §4.1 derived `isLocked`, read-DTO exposure → Task 1 (Steps 6–7) + Task 4 (Step 2).
- §4.2 dedicated lock/unlock actions, idempotency, `PLAN_LOCKED`/`PLAN_UNLOCKED` events → Task 2.
- §4.3 `PlanLockGuard` + `PlanLockedException` (409, slug, Korean detail) + 3 entry points → Task 3 (Steps 1–3).
- §4.4 guard wired into all 14 content writes; lock/unlock + reads exempt → Task 3 (Steps 4–7).
- §4.5 frontend types, hooks, toggle (Lock/LockOpen), banner, read-only threading (list + canvas + roadmap) → Task 4.
- §6 testing: state+event, idempotency, per-service freeze, reads-unaffected, round-trip, autoflush → Task 1 test (run across Tasks 2–3); frontend gate `tsc -b` + build + manual → Task 4.

**Placeholder scan:** none — every code step has full content.

**Type/name consistency:** `lockedAt`/`lockedByUserId` (entity ↔ `locked_at`/`locked_by_user_id` columns ↔ DTO ↔ TS); `PlanLockedException` slug `plan-locked`; `PlanEventType.PLAN_LOCKED`/`PLAN_UNLOCKED` match the TS union and `formatPlanEvent` entries; guard methods `assertUnlocked`/`assertUnlockedByPlanId`/`assertUnlockedBySubPlanId` consistent across all call sites; hooks `useLockPlan`/`useUnlockPlan`; `PlanCanvas`/`SubPlanSection`/`OptionRow`/`SortableSubPlanSection` all take the same `locked` prop name.
