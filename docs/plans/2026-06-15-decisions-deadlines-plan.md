# Decisions A.4 — 기한 (Deadlines) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a date-only deadline to 계획 and 안건, surface it as a live D-day chip on the board + PlanDetail, and record set/change/clear in the 기록 timeline. A decided 안건 / completed 계획 freezes whether it landed 기한 내 or 기한 지나. Never blocks a write.

**Architecture:** Backend adds two nullable columns (`plans.deadline`, `sub_plans.deadline`) plus `plans.completed_at`, two `PlanEventType`s, and four dedicated set/clear endpoints (lifecycle-style, mirroring lock/complete). Frontend adds one pure `deadlineLabel` helper, one `DeadlineChip` component (display + inline edit Modal), four mutation hooks, and timeline formatter lines. Deadline mutations invalidate `decisionKeys.scope`, so every surface refreshes with no new query wiring.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + MariaDB + Flyway (next migration **V22**); Vite + React 19 + TS + CSS Modules + React Query + lucide-react.

**Spec:** `docs/plans/2026-06-15-decisions-deadlines-design.md`. **Branch:** `decisions-deadlines` (already created; design docs committed at `007a58e`).

**Conventions to respect:**
- Backend type-check/test: `./gradlew build` (with tests). Single class: `./gradlew test --tests "com.shareddocs.backend.decision.<Class>"`. `ddl-auto: validate` means the entity fields and the migration must land together or startup fails.
- Frontend type-check: **`npx tsc -b --noEmit`** (plain `tsc --noEmit` checks zero files). Authoritative gate: `npm run build`. Lint only `npx eslint src/features/decisions/`. **There is no frontend test runner** (no `test` script) — `deadlineLabel` is written as a pure function for clarity/future testing, but the gate is tsc + build.
- All UI text Korean; Lucide icons; CSS Modules + tokens only.

---

# Backend (`shared-docs-backend`)

### Task 1: Migration V22 + entity fields + event types + response DTOs/mappers

This is a structural/contract change with no new behavior — verification is "build is green and existing tests pass." Schema + entities ship together (ddl-auto validate).

**Files:**
- Create: `src/main/resources/db/migration/V22__plan_deadlines.sql`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/Plan.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/SubPlan.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (3 mapper/builder sites)

- [ ] **Step 1: Write the migration** `V22__plan_deadlines.sql`

```sql
-- 기한 (Deadlines) — Decisions backlog A.4.
-- Date-only deadline on 계획 and 안건; completed_at gives plan-level completion a
-- timestamp to compare a deadline against (안건 already has decisions.created_at).
ALTER TABLE `plans`
  ADD COLUMN `deadline` date DEFAULT NULL,
  ADD COLUMN `completed_at` datetime(6) DEFAULT NULL;

ALTER TABLE `sub_plans`
  ADD COLUMN `deadline` date DEFAULT NULL;

-- Best-effort backfill: existing COMPLETED plans get updated_at as their
-- completion timestamp (closest available proxy).
UPDATE `plans` SET `completed_at` = `updated_at` WHERE `status` = 'COMPLETED';
```

- [ ] **Step 2: Add entity fields**

In `Plan.kt`, add inside the constructor (after `lockedByUserId`, before `deletedAt` — order is cosmetic):

```kotlin
    @Column(name = "deadline")
    var deadline: java.time.LocalDate? = null,

    @Column(name = "completed_at")
    var completedAt: Instant? = null,
```

In `SubPlan.kt`, add after `description` (before `sortOrder`):

```kotlin
    @Column(name = "deadline")
    var deadline: java.time.LocalDate? = null,
```

- [ ] **Step 3: Add event types**

In `PlanEnums.kt`, append to `PlanEventType` (within the varchar(40) cap):

```kotlin
    DEADLINE_SET,
    DEADLINE_CLEARED,
```

- [ ] **Step 4: Extend response DTOs**

In `DecisionDto.kt`:

`PlanSummaryResponse` — add after `deletedAt`:
```kotlin
    val deadline: java.time.LocalDate?,
    val completedAt: Instant?,
```

`PlanTreeResponse` — add after `lockedByUserId`:
```kotlin
    val deadline: java.time.LocalDate?,
    val completedAt: Instant?,
```

`SubPlanResponse` — add after `canvasY`:
```kotlin
    val deadline: java.time.LocalDate?,
```

- [ ] **Step 5: Update the three builder/mapper sites in `PlanService.kt`**

(a) `Plan.toSummary` (~line 449) — add to the `PlanSummaryResponse(...)` call:
```kotlin
        deadline = deadline,
        completedAt = completedAt,
```

(b) `SubPlan.toResponse` (~line 423) — add to the `SubPlanResponse(...)` call:
```kotlin
        deadline = deadline,
```

(c) `getTree` (~line 204) — add to the `PlanTreeResponse(...)` call (after `lockedByUserId = plan.lockedByUserId,`):
```kotlin
            deadline = plan.deadline,
            completedAt = plan.completedAt,
```

- [ ] **Step 6: Build + verify existing tests pass**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL — schema validates against the new entity fields, all existing tests pass (new fields default null, new event types unused).

- [ ] **Step 7: Commit**

```bash
git add src/main/resources/db/migration/V22__plan_deadlines.sql \
        src/main/kotlin/com/shareddocs/backend/decision/Plan.kt \
        src/main/kotlin/com/shareddocs/backend/decision/SubPlan.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt
git commit -m "feat(decisions-be): deadline + completed_at columns, event types, DTO fields (A.4)"
```

---

### Task 2: `completedAt` set on complete / cleared on uncomplete (TDD)

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (`complete`, `uncomplete`)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanLifecycleServiceTest.kt`

- [ ] **Step 1: Write the failing tests**

Append to `PlanLifecycleServiceTest.kt` (the class already has `seed()`, `plans`, `entityManager`; add a `planRepository` autowire and an import for it at the top: `@Autowired private val planRepository: PlanRepository` in the constructor):

```kotlin
    @Test
    fun `complete stamps completedAt`() {
        val c = seed()
        plans.complete(c.wsId, c.planId, c.user)
        entityManager.flush(); entityManager.clear()
        assertTrue(planRepository.findById(c.planId).get().completedAt != null)
    }

    @Test
    fun `uncomplete clears completedAt`() {
        val c = seed()
        plans.complete(c.wsId, c.planId, c.user)
        plans.uncomplete(c.wsId, c.planId, c.user)
        entityManager.flush(); entityManager.clear()
        assertTrue(planRepository.findById(c.planId).get().completedAt == null)
    }
```

Add the constructor param (after `userRepository`):
```kotlin
    @Autowired private val planRepository: PlanRepository,
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanLifecycleServiceTest"`
Expected: FAIL — `complete stamps completedAt` fails (completedAt stays null).

- [ ] **Step 3: Implement**

In `PlanService.complete` (~line 93), inside the `if (plan.status != PlanStatus.COMPLETED)` block, before `events.record`:
```kotlin
            plan.completedAt = Instant.now()
```

In `PlanService.uncomplete` (~line 110), inside the `if (plan.status != PlanStatus.ACTIVE)` block, before `events.record`:
```kotlin
            plan.completedAt = null
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanLifecycleServiceTest"`
Expected: PASS (all tests in the class).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanLifecycleServiceTest.kt
git commit -m "feat(decisions-be): stamp Plan.completedAt on complete/uncomplete (A.4)"
```

---

### Task 3: Plan deadline set/clear — service + endpoint (TDD)

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (add `SetDeadlineRequest`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (add `setPlanDeadline`, `clearPlanDeadline`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt` (2 endpoints)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanDeadlineServiceTest.kt` (new)

- [ ] **Step 1: Add the request DTO**

In `DecisionDto.kt`, in the Requests section (after `ReorderSubPlansRequest`), add:
```kotlin
/** Set/replace a 기한 on a 계획 or 안건. Date-only; past dates allowed (not enforced). */
data class SetDeadlineRequest(
    @field:jakarta.validation.constraints.NotNull val deadline: java.time.LocalDate,
)
```

- [ ] **Step 2: Write the failing test** `PlanDeadlineServiceTest.kt`

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanDeadlineServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val planRepository: PlanRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
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

    private fun typesNewestFirst(planId: Long) =
        events.findAllByPlanIdOrderByCreatedAtDesc(planId).map { it.type }

    @Test
    fun `set records DEADLINE_SET and stores the date`() {
        val c = seed()
        val summary = plans.setPlanDeadline(c.wsId, c.planId, c.user, LocalDate.of(2026, 7, 1))
        assertEquals(LocalDate.of(2026, 7, 1), summary.deadline)
        assertEquals(PlanEventType.DEADLINE_SET, typesNewestFirst(c.planId).first())
    }

    @Test
    fun `changing the deadline records a second DEADLINE_SET`() {
        val c = seed()
        plans.setPlanDeadline(c.wsId, c.planId, c.user, LocalDate.of(2026, 7, 1))
        plans.setPlanDeadline(c.wsId, c.planId, c.user, LocalDate.of(2026, 7, 8))
        assertEquals(2, typesNewestFirst(c.planId).count { it == PlanEventType.DEADLINE_SET })
        assertEquals(LocalDate.of(2026, 7, 8), planRepository.findById(c.planId).get().deadline)
    }

    @Test
    fun `clear nulls the date and records DEADLINE_CLEARED`() {
        val c = seed()
        plans.setPlanDeadline(c.wsId, c.planId, c.user, LocalDate.of(2026, 7, 1))
        val summary = plans.clearPlanDeadline(c.wsId, c.planId, c.user)
        assertNull(summary.deadline)
        assertEquals(PlanEventType.DEADLINE_CLEARED, typesNewestFirst(c.planId).first())
    }

    @Test
    fun `clearing when no deadline records no event`() {
        val c = seed()
        plans.clearPlanDeadline(c.wsId, c.planId, c.user)
        assertEquals(0, typesNewestFirst(c.planId).count { it == PlanEventType.DEADLINE_CLEARED })
    }

    @Test
    fun `setting a deadline on a locked plan throws`() {
        val c = seed()
        plans.lock(c.wsId, c.planId, c.user)
        assertThrows(PlanLockedException::class.java) {
            plans.setPlanDeadline(c.wsId, c.planId, c.user, LocalDate.of(2026, 7, 1))
        }
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanDeadlineServiceTest"`
Expected: FAIL to compile — `setPlanDeadline` / `clearPlanDeadline` don't exist yet.

- [ ] **Step 4: Implement the service methods**

In `PlanService.kt`, after `update(...)` (~line 230), add:

```kotlin
    /** Set/replace a 계획's 기한. Lock-guarded (planning content). Records DEADLINE_SET. */
    fun setPlanDeadline(workspaceId: Long, planId: Long, actorUserId: Long, deadline: java.time.LocalDate): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        lockGuard.assertUnlocked(plan)
        plan.deadline = deadline
        events.record(
            workspaceId = workspaceId,
            planId = planId,
            subPlanId = null,
            type = PlanEventType.DEADLINE_SET,
            actorUserId = actorUserId,
            payload = mapOf("deadline" to deadline.toString()),
        )
        return summaryOf(plan)
    }

    /** Clear a 계획's 기한. Lock-guarded. Records DEADLINE_CLEARED only if one existed. */
    fun clearPlanDeadline(workspaceId: Long, planId: Long, actorUserId: Long): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        lockGuard.assertUnlocked(plan)
        if (plan.deadline != null) {
            plan.deadline = null
            events.record(
                workspaceId = workspaceId,
                planId = planId,
                subPlanId = null,
                type = PlanEventType.DEADLINE_CLEARED,
                actorUserId = actorUserId,
                payload = emptyMap(),
            )
        }
        return summaryOf(plan)
    }
```

- [ ] **Step 5: Add the controller endpoints**

In `PlanController.kt`, after `update(...)` (~line 61), add (the `SetDeadlineRequest` import resolves from the same package):

```kotlin
    @org.springframework.web.bind.annotation.PutMapping("/{planId}/deadline")
    fun setDeadline(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
        @Valid @RequestBody request: SetDeadlineRequest,
    ): PlanSummaryResponse = service.setPlanDeadline(ws.id!!, planId, me.userId, request.deadline)

    @DeleteMapping("/{planId}/deadline")
    fun clearDeadline(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
    ): PlanSummaryResponse = service.clearPlanDeadline(ws.id!!, planId, me.userId)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanDeadlineServiceTest"`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanDeadlineServiceTest.kt
git commit -m "feat(decisions-be): plan deadline set/clear endpoints + events (A.4)"
```

---

### Task 4: SubPlan (안건) deadline set/clear — service + endpoint (TDD)

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (add `setSubPlanDeadline`, `clearSubPlanDeadline`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt` (2 endpoints)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubPlanDeadlineServiceTest.kt` (new)

- [ ] **Step 1: Write the failing test** `SubPlanDeadlineServiceTest.kt`

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SubPlanDeadlineServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val subPlanRepository: SubPlanRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private data class Ctx(val wsId: Long, val planId: Long, val subPlanId: Long, val user: Long)

    private fun seed(): Ctx {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네 정하기"))
        return Ctx(ws.id!!, plan.id, sp.id, owner.id!!)
    }

    private fun events(planId: Long) = events.findAllByPlanIdOrderByCreatedAtDesc(planId)

    @Test
    fun `set records DEADLINE_SET with subPlanTitle and stores the date`() {
        val c = seed()
        val resp = plans.setSubPlanDeadline(c.wsId, c.subPlanId, c.user, LocalDate.of(2026, 7, 1))
        assertEquals(LocalDate.of(2026, 7, 1), resp.deadline)
        val e = events(c.planId).first()
        assertEquals(PlanEventType.DEADLINE_SET, e.type)
        assertEquals(c.subPlanId, e.subPlanId)
    }

    @Test
    fun `clear nulls the date and records DEADLINE_CLEARED`() {
        val c = seed()
        plans.setSubPlanDeadline(c.wsId, c.subPlanId, c.user, LocalDate.of(2026, 7, 1))
        val resp = plans.clearSubPlanDeadline(c.wsId, c.subPlanId, c.user)
        assertNull(resp.deadline)
        assertEquals(PlanEventType.DEADLINE_CLEARED, events(c.planId).first().type)
    }

    @Test
    fun `clearing when no deadline records no event`() {
        val c = seed()
        plans.clearSubPlanDeadline(c.wsId, c.subPlanId, c.user)
        assertEquals(0, events(c.planId).count { it.type == PlanEventType.DEADLINE_CLEARED })
    }

    @Test
    fun `setting a deadline under a locked plan throws`() {
        val c = seed()
        plans.lock(c.wsId, c.planId, c.user)
        assertThrows(PlanLockedException::class.java) {
            plans.setSubPlanDeadline(c.wsId, c.subPlanId, c.user, LocalDate.of(2026, 7, 1))
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanDeadlineServiceTest"`
Expected: FAIL to compile — `setSubPlanDeadline` / `clearSubPlanDeadline` don't exist.

- [ ] **Step 3: Implement the service methods**

In `PlanService.kt`, after `updateSubPlan(...)` (~line 312), add. Note: `updateSubPlan` returns a full `SubPlanResponse` by re-loading options/ratings/votes/decision — reuse that exact shape by delegating to a private re-load, but the simplest correct approach mirrors `updateSubPlan`'s own tail. Build the response the same way:

```kotlin
    /** Set/replace a 안건's 기한. Lock-guarded by its plan. Records DEADLINE_SET. */
    fun setSubPlanDeadline(workspaceId: Long, subPlanId: Long, actorUserId: Long, deadline: java.time.LocalDate): SubPlanResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
        subPlan.deadline = deadline
        events.record(
            workspaceId = workspaceId,
            planId = subPlan.planId,
            subPlanId = subPlanId,
            type = PlanEventType.DEADLINE_SET,
            actorUserId = actorUserId,
            payload = mapOf("subPlanTitle" to subPlan.title, "deadline" to deadline.toString()),
        )
        return subPlanResponseOf(subPlan)
    }

    /** Clear a 안건's 기한. Lock-guarded. Records DEADLINE_CLEARED only if one existed. */
    fun clearSubPlanDeadline(workspaceId: Long, subPlanId: Long, actorUserId: Long): SubPlanResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
        if (subPlan.deadline != null) {
            subPlan.deadline = null
            events.record(
                workspaceId = workspaceId,
                planId = subPlan.planId,
                subPlanId = subPlanId,
                type = PlanEventType.DEADLINE_CLEARED,
                actorUserId = actorUserId,
                payload = mapOf("subPlanTitle" to subPlan.title),
            )
        }
        return subPlanResponseOf(subPlan)
    }

    /** Build a full SubPlanResponse (options + ratings + votes + active decision)
     *  for a single loaded 안건 — shared by updateSubPlan and the deadline writes. */
    private fun subPlanResponseOf(subPlan: SubPlan): SubPlanResponse {
        val options = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlan.id!!)
        val optionIds = options.mapNotNull { it.id }
        val ratingsByOption = if (optionIds.isEmpty()) emptyMap()
            else optionRatingRepository.findAllByOptionIdIn(optionIds).groupBy { it.optionId }
        val votesByOption = if (optionIds.isEmpty()) emptyMap()
            else optionVoteRepository.findAllByOptionIdIn(optionIds).groupBy { it.optionId }
        val decision = decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(subPlan.id!!)
        return subPlan.toResponse(
            options = options.map { it.toResponse(ratingsByOption[it.id] ?: emptyList(), votesByOption[it.id] ?: emptyList()) },
            decision = decision?.toResponse(),
        )
    }
```

> Optional tidy (do it if quick): `updateSubPlan` (~line 301–311) builds the same response inline — replace its tail with `return subPlanResponseOf(subPlan)` to DRY it up. Behavior is identical. Skip if it risks the existing `SubPlanServiceTest`; the new method is verified independently.

- [ ] **Step 4: Add the controller endpoints**

In `SubPlanController.kt`, after `update(...)` (~line 29), add:

```kotlin
    @PutMapping("/{subPlanId}/deadline")
    fun setDeadline(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable subPlanId: Long,
        @Valid @RequestBody request: SetDeadlineRequest,
    ): SubPlanResponse = service.setSubPlanDeadline(ws.id!!, subPlanId, me.userId, request.deadline)

    @DeleteMapping("/{subPlanId}/deadline")
    fun clearDeadline(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable subPlanId: Long,
    ): SubPlanResponse = service.clearSubPlanDeadline(ws.id!!, subPlanId, me.userId)
```

> `PutMapping` is already imported? No — `SubPlanController` imports `PatchMapping`, `PostMapping`, `DeleteMapping`. Add the import `import org.springframework.web.bind.annotation.PutMapping`.

- [ ] **Step 5: Run test to verify it passes, then full build**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanDeadlineServiceTest"` → PASS (4 tests).
Then: `./gradlew build` → BUILD SUCCESSFUL (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt \
        src/test/kotlin/com/shareddocs/backend/decision/SubPlanDeadlineServiceTest.kt
git commit -m "feat(decisions-be): subplan deadline set/clear endpoints + events (A.4)"
```

---

# Frontend (`shared-docs`)

> Frontend `main` baseline is `d7f806c`; work continues on the same `decisions-deadlines` branch. After each task: `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` at the end.

### Task 5: Types + API hooks

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`

- [ ] **Step 1: Extend types** in `types.ts`

In `PlanSummary`, add after `deletedAt`:
```ts
  deadline: string | null
  completedAt: string | null
```

In `PlanTree`, add after `lockedByUserId`:
```ts
  deadline: string | null
  completedAt: string | null
```

In `SubPlanNode`, add after `canvasY`:
```ts
  deadline: string | null
```

Extend `PlanEventType` (add to the union):
```ts
  | 'DEADLINE_SET' | 'DEADLINE_CLEARED'
```

Add a payload type in the `// ── Payloads ──` block:
```ts
export type SetDeadlinePayload = { deadline: string }   // YYYY-MM-DD
```

- [ ] **Step 2: Add the four mutation hooks** in `api.ts`

After `useUnlockPlan()` (end of the Plan mutations block), add:

```ts
export function useSetPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; deadline: string }) =>
      (await apiClient.put<PlanSummary>(`/api/plans/${v.id}/deadline`, { deadline: v.deadline })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useClearPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.delete<PlanSummary>(`/api/plans/${id}/deadline`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

After `useDeleteSubPlan()` (end of the SubPlan mutations block), add:

```ts
export function useSetSubPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; deadline: string }) =>
      (await apiClient.put<SubPlanNode>(`/api/subplans/${v.id}/deadline`, { deadline: v.deadline })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useClearSubPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.delete<SubPlanNode>(`/api/subplans/${id}/deadline`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc -b --noEmit` → PASS (hooks/types compile, not yet consumed).

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions-fe): deadline types + set/clear mutation hooks (A.4)"
```

---

### Task 6: `deadlineLabel` helper + `DeadlineChip` component

**Files:**
- Create: `src/features/decisions/deadlineLabel.ts`
- Create: `src/features/decisions/DeadlineChip.tsx`
- Create: `src/features/decisions/DeadlineChip.module.css`

- [ ] **Step 1: Write the pure helper** `deadlineLabel.ts`

```ts
export type DeadlineTone = 'danger' | 'accent' | 'neutral'

/** Local YYYY-MM-DD for a Date (used to read "today" without UTC drift). */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar-day difference target − base, both 'YYYY-MM-DD'. Positive = future. */
export function daysUntil(baseIso: string, targetIso: string): number {
  const [by, bm, bd] = baseIso.split('-').map(Number)
  const [ty, tm, td] = targetIso.split('-').map(Number)
  const base = Date.UTC(by, bm - 1, bd)
  const target = Date.UTC(ty, tm - 1, td)
  return Math.round((target - base) / 86_400_000)
}

/** Live D-day chip text + tone for a deadline relative to today. */
export function deadlineLabel(deadlineIso: string, todayIso: string): { text: string; tone: DeadlineTone } {
  const days = daysUntil(todayIso, deadlineIso)
  if (days < 0) return { text: '지남', tone: 'danger' }
  if (days === 0) return { text: '오늘', tone: 'accent' }
  if (days === 1) return { text: '내일', tone: 'accent' }
  return { text: `${days}일 남음`, tone: 'neutral' }
}

/** Frozen annotation for a settled (decided/completed) item with a deadline:
 *  was it settled on/before the deadline (기한 내) or after (기한 지나)? */
export function settledDeadlineLabel(deadlineIso: string, settledAtIso: string, noun: string): { text: string; tone: DeadlineTone } {
  const settledDay = toLocalDateString(new Date(settledAtIso))
  const onTime = daysUntil(deadlineIso, settledDay) <= 0
  return onTime ? { text: `기한 내 ${noun}`, tone: 'neutral' } : { text: `기한 지나 ${noun}`, tone: 'danger' }
}

/** Full date for the chip's title tooltip: 'YYYY.MM.DD'. */
export function fullDate(deadlineIso: string): string {
  const [y, m, d] = deadlineIso.split('-')
  return `${y}.${m}.${d}`
}
```

- [ ] **Step 2: Write `DeadlineChip.tsx`**

```tsx
import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Modal, Field, Label, Input, Button } from '../../components/ui'
import { deadlineLabel, settledDeadlineLabel, fullDate, toLocalDateString } from './deadlineLabel'
import styles from './DeadlineChip.module.css'

type Props = {
  deadline: string | null
  /** decidedAt / completedAt — when present with a deadline, show a frozen 기한 내/지나 annotation. */
  settledAt?: string | null
  settledNoun?: string            // '결정' | '완료'
  editable: boolean
  busy?: boolean
  onSet?: (deadline: string) => void
  onClear?: () => void
}

export default function DeadlineChip({ deadline, settledAt, settledNoun = '결정', editable, busy, onSet, onClear }: Props) {
  const [open, setOpen] = useState(false)

  // Frozen annotation: settled with a deadline → read-only 기한 내/지나.
  if (deadline && settledAt) {
    const { text, tone } = settledDeadlineLabel(deadline, settledAt, settledNoun)
    return <span className={`${styles.chip} ${styles[tone]}`} title={fullDate(deadline)}><CalendarClock size={12} />{text}</span>
  }

  // Live D-day (or ghost "기한" when none + editable).
  const live = deadline ? deadlineLabel(deadline, toLocalDateString(new Date())) : null

  if (!editable) {
    // Display-only (board cards, locked): show the chip if a deadline exists, else nothing.
    if (!live || !deadline) return null
    return <span className={`${styles.chip} ${styles[live.tone]}`} title={fullDate(deadline)}><CalendarClock size={12} />{live.text}</span>
  }

  // Editable: chip is a button that opens the date modal.
  return (
    <>
      {deadline && live ? (
        <button type="button" className={`${styles.chip} ${styles.button} ${styles[live.tone]}`} title={fullDate(deadline)}
                onClick={() => setOpen(true)} disabled={busy}><CalendarClock size={12} />{live.text}</button>
      ) : (
        <button type="button" className={`${styles.chip} ${styles.button} ${styles.ghost}`}
                onClick={() => setOpen(true)} disabled={busy}><CalendarClock size={12} />기한</button>
      )}
      {open && (
        <DeadlineModal
          current={deadline}
          busy={busy}
          onClose={() => setOpen(false)}
          onSet={(d) => { onSet?.(d); setOpen(false) }}
          onClear={() => { onClear?.(); setOpen(false) }}
        />
      )}
    </>
  )
}

function DeadlineModal({ current, busy, onClose, onSet, onClear }: {
  current: string | null; busy?: boolean; onClose: () => void; onSet: (d: string) => void; onClear: () => void
}) {
  const [value, setValue] = useState(current ?? '')
  return (
    <Modal
      open
      onClose={onClose}
      title="기한"
      footer={
        <>
          {current && <Button variant="ghost" onClick={onClear} disabled={busy}>없애기</Button>}
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" onClick={() => value && onSet(value)} disabled={busy || !value}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <Field>
        <Label htmlFor="deadline-input">날짜</Label>
        <Input id="deadline-input" type="date" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
    </Modal>
  )
}
```

- [ ] **Step 3: Write `DeadlineChip.module.css`** (tokens verified present: `--c-text-subtle`, `--c-border`, `--c-surface`, `--c-danger`, `--c-danger-soft`, `--c-danger-border`, `--c-accent`, `--c-accent-soft`, `--r-pill`, `--fs-xs`, `--sp-1`)

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: var(--r-pill);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-subtle);
  font-size: var(--fs-xs);
  line-height: 1.6;
  white-space: nowrap;
}

.button { cursor: pointer; font: inherit; font-size: var(--fs-xs); }
.button:hover { background: var(--c-surface-tint); }

.neutral { /* base look above */ }

.accent {
  color: var(--c-accent);
  border-color: var(--c-accent-soft-strong);
  background: var(--c-accent-soft);
}

.danger {
  color: var(--c-danger);
  border-color: var(--c-danger-border);
  background: var(--c-danger-soft);
}

.ghost {
  color: var(--c-text-subtle);
  border-style: dashed;
  background: none;
}
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/` → both clean.

```bash
git add src/features/decisions/deadlineLabel.ts src/features/decisions/DeadlineChip.tsx src/features/decisions/DeadlineChip.module.css
git commit -m "feat(decisions-fe): DeadlineChip + deadlineLabel helper (A.4)"
```

---

### Task 7: Wire chips into PlanDetail + SubPlanSection + DecisionList + timeline formatter

**Files:**
- Modify: `src/features/decisions/formatPlanEvent.tsx`
- Modify: `src/features/decisions/SubPlanSection.tsx`
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/DecisionList.tsx`

- [ ] **Step 1: Timeline formatter** — `formatPlanEvent.tsx`

(a) Add icons to the import and to the `ICONS` map:
```tsx
import { Flag, ListPlus, CirclePlus, CheckCircle2, RefreshCw, RotateCcw, Lock, LockOpen, CalendarClock, CalendarX, type LucideIcon } from 'lucide-react'
```
```tsx
  DEADLINE_SET: CalendarClock,
  DEADLINE_CLEARED: CalendarX,
```

(b) Add a date formatter above `planEventText` (date always renders `M월 D일`, prefixed `YYYY년 ` only when the deadline year differs from the event's year — always ends in `일`, so the particle `로` stays grammatical):
```tsx
function deadlineForEvent(iso: string | null | undefined, eventCreatedAt: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const eventYear = new Date(eventCreatedAt).getFullYear()
  return `${y !== eventYear ? `${y}년 ` : ''}${m}월 ${d}일`
}
```

(c) Add the two cases inside `planEventText`'s switch (before `default`). Branch plan vs 안건 on `e.subPlanId`:
```tsx
    case 'DEADLINE_SET': {
      const when = deadlineForEvent(p.deadline, e.createdAt)
      return e.subPlanId == null
        ? `${actor}님이 계획 기한을 ${when}로 정했어요`
        : `${actor}님이 ${q(p.subPlanTitle)} 안건 기한을 ${when}로 정했어요`
    }
    case 'DEADLINE_CLEARED':
      return e.subPlanId == null
        ? `${actor}님이 계획 기한을 없앴어요`
        : `${actor}님이 ${q(p.subPlanTitle)} 안건 기한을 없앴어요`
```

- [ ] **Step 2: SubPlanSection** — render the 안건 chip + accept handlers

In `SubPlanSection.tsx`:

(a) Import the chip:
```tsx
import DeadlineChip from './DeadlineChip'
```

(b) Add to `Props`:
```tsx
  onSetDeadline: (deadline: string) => void
  onClearDeadline: () => void
  deadlineBusy?: boolean
```
and destructure them in the function signature alongside the others.

(c) Render the chip in the header `titleWrap`, right after the `<Badge>`:
```tsx
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>{subPlan.title}</h2>
          <Badge>{STATUS_LABEL[subPlan.status]}</Badge>
          <DeadlineChip
            deadline={subPlan.deadline}
            settledAt={decision?.decidedAt ?? null}
            settledNoun="결정"
            editable={!locked && decision == null}
            busy={deadlineBusy}
            onSet={onSetDeadline}
            onClear={onClearDeadline}
          />
        </div>
```
(`decision` is already destructured at the top of the component: `const { decision } = subPlan`.)

- [ ] **Step 3: PlanDetail** — wire 안건 handlers + plan-level chip

In `PlanDetail.tsx`:

(a) Extend the `./api` import to add the four hooks:
```tsx
  useSetPlanDeadline, useClearPlanDeadline, useSetSubPlanDeadline, useClearSubPlanDeadline,
```
and import the chip:
```tsx
import DeadlineChip from './DeadlineChip'
```

(b) Instantiate the mutations (near the other mutation hooks, ~line 58):
```tsx
  const setPlanDeadline = useSetPlanDeadline()
  const clearPlanDeadline = useClearPlanDeadline()
  const setSubPlanDeadline = useSetSubPlanDeadline()
  const clearSubPlanDeadline = useClearSubPlanDeadline()
```

(c) In `renderSubPlan`, pass the new props to `SortableSubPlanSection`:
```tsx
      onSetDeadline={(deadline) => setSubPlanDeadline.mutate({ id: sp.id, deadline })}
      onClearDeadline={() => clearSubPlanDeadline.mutate(sp.id)}
      deadlineBusy={setSubPlanDeadline.isPending || clearSubPlanDeadline.isPending}
```

> `SortableSubPlanSection` types its props as `ComponentProps<typeof SubPlanSection> & {...}` and spreads `...sectionProps` straight into `SubPlanSection`, so the three new props flow through automatically — **no edit to `SortableSubPlanSection.tsx` is needed.**

(d) Add the plan-level chip in the `planBarActions` div (first child, before the lock button), passing completion as the settled state:
```tsx
            <div className={styles.planBarActions}>
              <DeadlineChip
                deadline={tree.deadline}
                settledAt={completed ? tree.completedAt : null}
                settledNoun="완료"
                editable={!locked && !completed}
                busy={setPlanDeadline.isPending || clearPlanDeadline.isPending}
                onSet={(deadline) => setPlanDeadline.mutate({ id: tree.id, deadline })}
                onClear={() => clearPlanDeadline.mutate(tree.id)}
              />
              {locked ? (
```

- [ ] **Step 4: DecisionList** — display-only chip on board + completed cards

In `DecisionList.tsx`:

(a) Import the chip:
```tsx
import DeadlineChip from './DeadlineChip'
```

(b) In `renderCard`, add the chip to `cardTop` after the badge block (display-only — `editable={false}`, so it renders a plain non-interactive span, safe inside the card `<button>`). For the `completed` view, pass `completedAt` so it shows the frozen 완료 annotation:
```tsx
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{p.title}</span>
          {p.lockedAt != null
            ? <Badge>잠김</Badge>
            : view === 'completed' ? <Badge>완료</Badge> : null}
          <DeadlineChip
            deadline={p.deadline}
            settledAt={view === 'completed' ? p.completedAt : null}
            settledNoun="완료"
            editable={false}
          />
        </div>
```

> The trash card (`renderTrashCard`) intentionally gets no chip — discarded plans aren't actionable.

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/formatPlanEvent.tsx src/features/decisions/SubPlanSection.tsx \
        src/features/decisions/PlanDetail.tsx src/features/decisions/DecisionList.tsx
git commit -m "feat(decisions-fe): deadline chips on plan/안건/board + timeline lines (A.4)"
```

---

## Final verification (after all tasks)

- [ ] Backend: `./gradlew build` → BUILD SUCCESSFUL (all tests, including the two new deadline test classes + the completedAt tests).
- [ ] Frontend: `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` succeeds.
- [ ] Manual smoke (optional, local with `dev-login`): on a plan, set a 안건 기한 → D-day chip appears, 기록 tab shows "…안건 기한을 M월 D일로 정했어요"; pass the date (or set a past date) → chip shows `지남` in red; decide the 안건 → chip freezes to `기한 내/지나 결정`; set a plan 기한 in the planBar → chip on the board card; complete the plan → board 완료 card shows `기한 내/지나 완료`; lock the plan → chips become read-only; clearing a 기한 logs `기한을 없앴어요`.
- [ ] Code-review over the whole `decisions-deadlines` diff (both repos).
- [ ] superpowers:finishing-a-development-branch (merge `--no-ff` to `main` in each repo → deploy: frontend Vercel, backend CD applies V22).

## What this plan intentionally defers / excludes

- No reminders / push notifications; no `/calendar` integration; no board sort/filter by deadline; no enforcement/blocking; no time-of-day; no option-level deadlines.
- Board/trash deadline chips are display-only (editing lives on PlanDetail) to avoid an interactive control nested inside the card `<button>`.
- No frontend unit test for `deadlineLabel` — the repo has no JS test runner; the function is kept pure so a test can be added if a runner lands.
