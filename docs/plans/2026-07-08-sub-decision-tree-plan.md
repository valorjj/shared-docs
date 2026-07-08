# Sub-Decision Tree (Life Story Board Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sub-decisions — a 계획 can have child 계획s (`plans.parent_plan_id`), navigated zoom-style with breadcrumb + floating tree navigator, created directly or by promoting an 안건.

**Architecture:** One nullable self-FK on `plans` turns the flat board into a tree. A sub-decision IS a full Plan, so every existing feature (안건/선택지/투표/기한/잠금/완료/휴지통/논의/기록/realtime) works on it unchanged. A single `GET /api/plans/{id}/hierarchy` endpoint feeds breadcrumb, 하위결정 section, and navigator. The board lists roots only; trash/purge cascade over subtrees; 안건 promotion moves its 선택지+투표 into a first 안건 of the new child plan.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + Flyway (backend repo `shared-docs-backend`); Vite + React 19 + TS + React Query + @xyflow/react (frontend repo `shared-docs`).

**Design spec:** `shared-docs/docs/plans/2026-07-08-life-story-board-design.md` (§4 V23, §5 API, §6 UX, §7 rules).

## Global Constraints

- Two repos: backend tasks run in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend`, frontend tasks in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs`. All paths below are repo-relative.
- All UI text Korean; icons are lucide-react only (never emoji).
- CSS Modules + tokens from `src/components/ui/tokens.css` — no hardcoded hex, no Tailwind. Cards never lift (hairline `--c-border`, `--c-surface-tint` hover); shadows only on floating surfaces.
- No setState in effect (wrapper + keyed-inner for forms).
- Frontend gates: `npx tsc -b --noEmit` (MUST use `-b`) and `npm run build`. Lint only files/folders you touched (`npx eslint src/features/decisions/`); repo-wide lint is red with pre-existing debt.
- Backend gate: `./gradlew test` (suite currently 230 tests green). Run single class: `./gradlew test --tests "com.shareddocs.backend.decision.<Class>"`.
- `parent_plan_id` is immutable after creation (no re-parenting). Foreign-workspace ids 404 (never 403). Errors are `ApiException` subclasses → RFC 7807.
- Every mutating service method ends with `changes.publish(workspaceId, planId)`.
- Commit after each task, conventional commits (`feat(decisions): …`).

---

### Task 1: V23 migration + `Plan.parentPlanId` + root-only board + create-with-parent

**Files:**
- Create: `src/main/resources/db/migration/V23__sub_decision_tree.sql`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/Plan.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (CreatePlanRequest, PlanSummaryResponse, PlanTreeResponse)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt` (add `SUBDECISION_ADDED`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (create validation, list/listCompleted root filter, `toSummary`/`getTree` mappers)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubDecisionTreeTest.kt`

**Interfaces:**
- Consumes: existing `PlanService.create/list/listCompleted/lock`, `PlanEventRepository.findAllByPlanIdOrderByCreatedAtDesc`.
- Produces: `Plan.parentPlanId: Long?` (immutable), `CreatePlanRequest.parentPlanId: Long?`, `PlanSummaryResponse.parentPlanId: Long?`, `PlanTreeResponse.parentPlanId: Long?`, `PlanEventType.SUBDECISION_ADDED`, repository methods `findAllByWorkspaceIdAndStatusAndParentPlanIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc`, `findAllByWorkspaceId`, `findAllByParentPlanId`, `findAllByWorkspaceIdAndDeletedAtIsNull`. Tasks 2–4 rely on all of these.

- [ ] **Step 1: Write the failing tests**

Create `src/test/kotlin/com/shareddocs/backend/decision/SubDecisionTreeTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
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
class SubDecisionTreeTest(
    @Autowired private val service: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val planEventRepository: PlanEventRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `create with parentPlanId links the child and the board lists roots only`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "자동차 구입"))
        val child = service.create(
            ws.id!!, owner.id!!,
            CreatePlanRequest(title = "브랜드 선정", parentPlanId = root.id),
        )

        assertEquals(root.id, child.parentPlanId)
        assertEquals(listOf(root.id), service.list(ws.id!!).map { it.id })
        assertEquals(null, service.getTree(ws.id!!, root.id).parentPlanId)
        assertEquals(root.id, service.getTree(ws.id!!, child.id).parentPlanId)
    }

    @Test
    fun `create records SUBDECISION_ADDED on the parent`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "자동차 구입"))
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "브랜드 선정", parentPlanId = root.id))

        val types = planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(root.id).map { it.type }
        assertTrue(PlanEventType.SUBDECISION_ADDED in types)
    }

    @Test
    fun `create 404s when the parent is in another workspace`() {
        val a = newUser()
        val b = newUser()
        val wsA = workspaces.create(a.id!!, "A", "a")
        val wsB = workspaces.create(b.id!!, "B", "b")
        val foreign = service.create(wsB.id!!, b.id!!, CreatePlanRequest(title = "남의 것"))

        assertThrows(PlanNotFoundException::class.java) {
            service.create(wsA.id!!, a.id!!, CreatePlanRequest(title = "child", parentPlanId = foreign.id))
        }
    }

    @Test
    fun `create 409s when the parent is locked`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "자동차 구입"))
        service.lock(ws.id!!, root.id, owner.id!!)

        assertThrows(PlanLockedException::class.java) {
            service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        }
    }

    @Test
    fun `completed children stay off the completed board`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        service.complete(ws.id!!, child.id, owner.id!!)

        assertEquals(emptyList<Long>(), service.listCompleted(ws.id!!).map { it.id })
    }
}
```

Note: `service.lock` / `service.complete` — match the existing signatures in `PlanService.kt` (they take `workspaceId, planId, actorUserId`; verify order when writing, `PlanLockServiceTest` / `PlanLifecycleServiceTest` show the exact calls).

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubDecisionTreeTest"`
Expected: COMPILE FAILURE — `parentPlanId` unresolved on `CreatePlanRequest`/responses, `SUBDECISION_ADDED` unresolved.

- [ ] **Step 3: Migration + entity + enum + DTOs + repository + service**

Create `src/main/resources/db/migration/V23__sub_decision_tree.sql`:

```sql
-- 하위결정 (Sub-decision tree) — Life Story Board Phase 1.
-- A 계획 may hang under a parent 계획; roots (parent_plan_id IS NULL) form the
-- life board. Immutable after creation (no re-parenting); RESTRICT keeps raw
-- hard-deletes honest — subtree purges are ordered in the service layer.
ALTER TABLE `plans`
  ADD COLUMN `parent_plan_id` bigint(20) DEFAULT NULL,
  ADD KEY `idx_plans_parent` (`parent_plan_id`),
  ADD CONSTRAINT `fk_plans_parent` FOREIGN KEY (`parent_plan_id`)
      REFERENCES `plans` (`id`) ON DELETE RESTRICT;
```

`Plan.kt` — add the field to the constructor (after `deadline`, before `completedAt` is fine):

```kotlin
    /** Parent 계획 when this is a 하위결정; null for life-board roots. Immutable — no re-parenting. */
    @Column(name = "parent_plan_id", updatable = false)
    val parentPlanId: Long? = null,
```

`PlanEnums.kt` — extend the enum (keep ≤40 chars):

```kotlin
    SUBDECISION_ADDED,
```

`DecisionDto.kt`:
- `CreatePlanRequest` gains `val parentPlanId: Long? = null` (no validation annotation).
- `PlanSummaryResponse` gains `val parentPlanId: Long?` (place after `groupLabel`).
- `PlanTreeResponse` gains `val parentPlanId: Long?` (place after `groupLabel`).

`PlanRepository.kt` — add four derived methods:

```kotlin
    fun findAllByWorkspaceIdAndStatusAndParentPlanIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(
        workspaceId: Long,
        status: PlanStatus,
    ): List<Plan>

    fun findAllByWorkspaceId(workspaceId: Long): List<Plan>

    fun findAllByWorkspaceIdAndDeletedAtIsNull(workspaceId: Long): List<Plan>

    fun findAllByParentPlanId(parentPlanId: Long): List<Plan>
```

`PlanService.kt`:
1. In `create(...)`, before `planRepository.save`, resolve + validate the parent, and pass it through:

```kotlin
        val parent = request.parentPlanId?.let {
            planRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(it, workspaceId)
                ?: throw PlanNotFoundException()
        }
        parent?.let { lockGuard.assertUnlocked(it) }
```

   Add `parentPlanId = parent?.id` to the `Plan(...)` constructor call. After the existing `PLAN_CREATED` event, add:

```kotlin
        if (parent != null) {
            events.record(
                workspaceId = workspaceId,
                planId = parent.id!!,
                subPlanId = null,
                type = PlanEventType.SUBDECISION_ADDED,
                actorUserId = actorUserId,
                payload = mapOf("title" to plan.title, "childPlanId" to plan.id!!.toString()),
            )
        }
```

2. In `list(...)` and `listCompleted(...)`, swap `findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc` for `findAllByWorkspaceIdAndStatusAndParentPlanIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc` (same args).
3. In the private `Plan.toSummary(...)` extension (~line 551) add `parentPlanId = parentPlanId,` to the `PlanSummaryResponse(...)` construction; in `getTree(...)` add `parentPlanId = plan.parentPlanId,` to the `PlanTreeResponse(...)` construction.

Note: `lockGuard.assertUnlocked(plan: Plan)` is the existing entity-overload used elsewhere in this service — reuse it, don't add a new guard.

- [ ] **Step 4: Run the new class, then the whole suite**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubDecisionTreeTest"` → PASS (5 tests)
Run: `./gradlew test` → PASS (230 existing + 5). If any existing test asserts the old list query name via behavior (e.g. a child plan visible on the board), fix the *test expectation only if it contradicts the new spec*; nothing else should regress because no existing test creates plans with parents.

- [ ] **Step 5: Commit**

```bash
git add src/main/resources/db/migration/V23__sub_decision_tree.sql src/main/kotlin/com/shareddocs/backend/decision/ src/test/kotlin/com/shareddocs/backend/decision/SubDecisionTreeTest.kt
git commit -m "feat(decisions): plans.parent_plan_id — sub-decision tree foundation (V23)"
```

---

### Task 2: Trash cascade over subtrees + `SUBDECISION_REMOVED` + trash heads

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (discard/restore/deleteForever/listTrash)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt` (discard passes actor)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt` (add `SUBDECISION_REMOVED`)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubDecisionTrashTest.kt`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanTrashServiceTest.kt` (existing `service.discard(ws, id)` calls gain the actor arg)

**Interfaces:**
- Consumes: Task 1's repository methods + `parentPlanId`.
- Produces: `PlanService.discard(workspaceId: Long, planId: Long, actorUserId: Long)` (SIGNATURE CHANGE — third param added), subtree-cascading `restore`/`deleteForever`, `listTrash` returning only "heads" (trashed plans whose parent is not trashed), `PlanEventType.SUBDECISION_REMOVED`, private helpers `collectSubtree(workspaceId, root): List<Plan>` and `purgeSinglePlan(plan: Plan)`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/kotlin/com/shareddocs/backend/decision/SubDecisionTrashTest.kt` (same class scaffold as Task 1's test — `@SpringBootTest @ActiveProfiles("test") @Transactional`, constructor-inject `PlanService`, `WorkspaceService`, `UserRepository`, `PlanEventRepository`, plus `@Autowired private val entityManager: jakarta.persistence.EntityManager`, and the same `newUser()` helper):

```kotlin
    @Test
    fun `discarding a parent trashes the whole subtree and lists only the head in trash`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        val grandchild = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "grand", parentPlanId = child.id))

        service.discard(ws.id!!, root.id, owner.id!!)
        entityManager.flush(); entityManager.clear()

        assertEquals(listOf(root.id), service.listTrash(ws.id!!).map { it.id })
        assertThrows(PlanNotFoundException::class.java) { service.getTree(ws.id!!, grandchild.id) }
    }

    @Test
    fun `restoring the head restores the whole subtree`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        service.discard(ws.id!!, root.id, owner.id!!)
        entityManager.flush(); entityManager.clear()

        service.restore(ws.id!!, root.id)
        entityManager.flush(); entityManager.clear()

        assertEquals(child.id, service.getTree(ws.id!!, child.id).id)
        assertEquals(emptyList<Long>(), service.listTrash(ws.id!!).map { it.id })
    }

    @Test
    fun `discarding a child alone records SUBDECISION_REMOVED on the live parent`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))

        service.discard(ws.id!!, child.id, owner.id!!)

        val types = planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(root.id).map { it.type }
        assertTrue(PlanEventType.SUBDECISION_REMOVED in types)
        assertEquals(listOf(child.id), service.listTrash(ws.id!!).map { it.id })
    }

    @Test
    fun `deleteForever purges the whole subtree deepest-first`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        val sp = service.addSubPlan(ws.id!!, child.id, owner.id!!, CreateSubPlanRequest(title = "안건"))
        service.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "선택지"))
        service.discard(ws.id!!, root.id, owner.id!!)
        entityManager.flush(); entityManager.clear()

        service.deleteForever(ws.id!!, root.id)
        entityManager.flush(); entityManager.clear()

        assertThrows(PlanNotFoundException::class.java) { service.getTree(ws.id!!, child.id) }
        assertEquals(emptyList<Long>(), service.listTrash(ws.id!!).map { it.id })
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubDecisionTrashTest"`
Expected: COMPILE FAILURE — `discard` has no 3-arg overload; `SUBDECISION_REMOVED` unresolved.

- [ ] **Step 3: Implement**

`PlanEnums.kt`: add `SUBDECISION_REMOVED,`.

`PlanService.kt` — replace `discard`, `restore`, `deleteForever`, `listTrash`; add helpers:

```kotlin
    /** Soft-delete a 계획 AND its entire subtree to the 휴지통. Idempotent. NOT lock-guarded. */
    fun discard(workspaceId: Long, planId: Long, actorUserId: Long) {
        val plan = requirePlan(workspaceId, planId)
        val now = Instant.now()
        collectSubtree(workspaceId, plan).forEach { if (it.deletedAt == null) it.deletedAt = now }
        val parentId = plan.parentPlanId
        if (parentId != null) {
            val parent = planRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(parentId, workspaceId)
            if (parent != null) {
                events.record(
                    workspaceId = workspaceId,
                    planId = parent.id!!,
                    subPlanId = null,
                    type = PlanEventType.SUBDECISION_REMOVED,
                    actorUserId = actorUserId,
                    payload = mapOf("title" to plan.title),
                )
            }
        }
        changes.publish(workspaceId, planId)
    }

    /** Restore a discarded 계획 and its subtree. Idempotent. */
    fun restore(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        collectSubtree(workspaceId, plan).forEach { it.deletedAt = null }
        changes.publish(workspaceId, planId)
    }

    fun deleteForever(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        purgeSubtree(plan)
        changes.publish(workspaceId, planId)
    }

    /** Trash shows only "heads": trashed plans whose parent is live (or absent). */
    @Transactional(readOnly = true)
    fun listTrash(workspaceId: Long): List<PlanSummaryResponse> {
        val all = planRepository.findAllByWorkspaceId(workspaceId)
        val byId = all.associateBy { it.id!! }
        val heads = all
            .filter { it.deletedAt != null }
            .filter { it.parentPlanId == null || byId[it.parentPlanId]?.deletedAt == null }
            .sortedByDescending { it.deletedAt }
        return summariesOf(heads)
    }

    /** The plan plus every descendant (any depth), trashed or not. */
    private fun collectSubtree(workspaceId: Long, root: Plan): List<Plan> {
        val byParent = planRepository.findAllByWorkspaceId(workspaceId).groupBy { it.parentPlanId }
        val out = mutableListOf(root)
        var frontier = listOf(root)
        while (frontier.isNotEmpty()) {
            val next = frontier.flatMap { byParent[it.id] ?: emptyList() }
            out += next
            frontier = next
        }
        return out
    }

    private fun purgeSubtree(plan: Plan) {
        planRepository.findAllByParentPlanId(plan.id!!).forEach { purgeSubtree(it) }
        purgeSinglePlan(plan)
    }
```

`purgeSinglePlan(plan: Plan)` = the current `deleteForever` body verbatim, minus the leading `requirePlan` and the trailing `changes.publish` (i.e., from `val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)` through `planRepository.delete(plan)`, with `planId` replaced by `plan.id!!`).

Adapt `listTrash`'s old body: it previously used `findAllByWorkspaceIdAndDeletedAtIsNotNullOrderByDeletedAtDesc` + `summariesOf(...)` — keep `summariesOf` exactly as called before (match its existing parameter shape when editing).

`PlanController.kt` — discard endpoint passes the actor:

```kotlin
    @DeleteMapping("/{planId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun discard(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
    ) = service.discard(ws.id!!, planId, me.userId)
```

(Match the existing 204 idiom in the file — if it returns `ResponseEntity<Void>` instead of `@ResponseStatus`, keep that shape and just add the `me` param.)

`PlanTrashServiceTest.kt`: update every `service.discard(wsId, planId)` call to `service.discard(wsId, planId, <the test's user id>)`.

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubDecisionTrashTest"` → PASS
Run: `./gradlew test` → PASS (all green, including updated PlanTrashServiceTest).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/ src/test/kotlin/com/shareddocs/backend/decision/
git commit -m "feat(decisions): subtree trash cascade + SUBDECISION_REMOVED event"
```

---

### Task 3: Hierarchy endpoint (`GET /api/plans/{id}/hierarchy`)

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (add `PlanHierarchyNode`, `PlanHierarchyResponse`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (add `getHierarchy`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt` (add endpoint)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanHierarchyTest.kt`

**Interfaces:**
- Consumes: Task 1's `findAllByWorkspaceIdAndDeletedAtIsNull`, existing `SubPlanRepository.findAllByPlanIdIn`, `DecisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull`.
- Produces (frontend contract — Task 5 mirrors these):

```kotlin
data class PlanHierarchyNode(
    val id: Long,
    val parentPlanId: Long?,
    val title: String,
    val status: PlanStatus,
    val deadline: LocalDate?,
    val completedAt: Instant?,
    val lockedAt: Instant?,
    val canvasX: Double?,
    val canvasY: Double?,
    val subPlanCount: Int,
    val decidedCount: Int,
    val childCount: Int,
    val createdAt: Instant,
)

data class PlanHierarchyResponse(
    val rootId: Long,
    /** Ancestors of the requested plan, root first, direct parent last. Empty for roots. */
    val ancestorIds: List<Long>,
    /** Every live plan in the root's subtree (including the root and the requested plan). */
    val nodes: List<PlanHierarchyNode>,
)
```

- [ ] **Step 1: Write the failing tests**

Create `src/test/kotlin/com/shareddocs/backend/decision/PlanHierarchyTest.kt` (same scaffold + `newUser()` as Task 1):

```kotlin
    @Test
    fun `hierarchy from a middle node returns root, ancestors, and the full subtree with counts`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "자동차 구입"))
        val mid = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "브랜드 선정", parentPlanId = root.id))
        val leaf = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "중고 vs 신차", parentPlanId = mid.id))
        val sp = service.addSubPlan(ws.id!!, mid.id, owner.id!!, CreateSubPlanRequest(title = "국산 vs 수입"))
        service.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "국산"))

        val h = service.getHierarchy(ws.id!!, mid.id)

        assertEquals(root.id, h.rootId)
        assertEquals(listOf(root.id), h.ancestorIds)
        assertEquals(setOf(root.id, mid.id, leaf.id), h.nodes.map { it.id }.toSet())
        val midNode = h.nodes.first { it.id == mid.id }
        assertEquals(1, midNode.subPlanCount)
        assertEquals(0, midNode.decidedCount)
        assertEquals(1, midNode.childCount)
        assertEquals(root.id, midNode.parentPlanId)
    }

    @Test
    fun `hierarchy of a root plan has empty ancestors and rootId equal to itself`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "solo"))

        val h = service.getHierarchy(ws.id!!, root.id)

        assertEquals(root.id, h.rootId)
        assertEquals(emptyList<Long>(), h.ancestorIds)
        assertEquals(listOf(root.id), h.nodes.map { it.id })
    }

    @Test
    fun `hierarchy 404s for a trashed plan and excludes trashed children`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        service.discard(ws.id!!, child.id, owner.id!!)

        assertThrows(PlanNotFoundException::class.java) { service.getHierarchy(ws.id!!, child.id) }
        assertEquals(listOf(root.id), service.getHierarchy(ws.id!!, root.id).nodes.map { it.id })
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanHierarchyTest"`
Expected: COMPILE FAILURE — `getHierarchy` unresolved.

- [ ] **Step 3: Implement**

`DecisionDto.kt`: add the two data classes from the Interfaces block above.

`PlanService.kt`:

```kotlin
    @Transactional(readOnly = true)
    fun getHierarchy(workspaceId: Long, planId: Long): PlanHierarchyResponse {
        val current = planRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(planId, workspaceId)
            ?: throw PlanNotFoundException()
        val all = planRepository.findAllByWorkspaceIdAndDeletedAtIsNull(workspaceId)
        val byId = all.associateBy { it.id!! }
        val byParent = all.groupBy { it.parentPlanId }

        // Walk up to the root (visited-guard is defensive; immutable parents can't cycle).
        val ancestors = mutableListOf<Plan>()
        val seen = mutableSetOf(current.id!!)
        var cursor = current
        while (true) {
            val parent = cursor.parentPlanId?.let { byId[it] } ?: break
            if (!seen.add(parent.id!!)) break
            ancestors.add(0, parent)
            cursor = parent
        }
        val root = ancestors.firstOrNull() ?: current

        // BFS the whole subtree under the root.
        val subtree = mutableListOf(root)
        var frontier = listOf(root)
        while (frontier.isNotEmpty()) {
            val next = frontier.flatMap { byParent[it.id] ?: emptyList() }
            subtree += next
            frontier = next
        }

        // Roll-ups without N+1 (same pattern as summariesOf).
        val planIds = subtree.map { it.id!! }
        val subPlans = subPlanRepository.findAllByPlanIdIn(planIds)
        val subPlanIds = subPlans.mapNotNull { it.id }
        val decidedSubPlanIds =
            if (subPlanIds.isEmpty()) emptySet()
            else decisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds)
                .map { it.subPlanId }.toSet()
        val subPlansByPlan = subPlans.groupBy { it.planId }

        return PlanHierarchyResponse(
            rootId = root.id!!,
            ancestorIds = ancestors.map { it.id!! },
            nodes = subtree.map { p ->
                val sps = subPlansByPlan[p.id] ?: emptyList()
                PlanHierarchyNode(
                    id = p.id!!,
                    parentPlanId = p.parentPlanId,
                    title = p.title,
                    status = p.status,
                    deadline = p.deadline,
                    completedAt = p.completedAt,
                    lockedAt = p.lockedAt,
                    canvasX = p.canvasX,
                    canvasY = p.canvasY,
                    subPlanCount = sps.size,
                    decidedCount = sps.count { it.id in decidedSubPlanIds },
                    childCount = (byParent[p.id] ?: emptyList()).size,
                    createdAt = p.createdAt!!,
                )
            },
        )
    }
```

`PlanController.kt`:

```kotlin
    @GetMapping("/{planId}/hierarchy")
    fun hierarchy(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): PlanHierarchyResponse =
        service.getHierarchy(ws.id!!, planId)
```

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanHierarchyTest"` → PASS
Run: `./gradlew test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/ src/test/kotlin/com/shareddocs/backend/decision/PlanHierarchyTest.kt
git commit -m "feat(decisions): plan hierarchy endpoint — ancestors + subtree with counts"
```

---

### Task 4: 안건 promotion (`POST /api/subplans/{id}/promote`)

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/OptionRepository.kt` (native repoint)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/OptionVoteRepository.kt` (native repoint)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt` (add `SUBPLAN_PROMOTED`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (add `promoteSubPlan`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt` (add endpoint)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubPlanPromotionTest.kt`

**Interfaces:**
- Consumes: Task 1's `parentPlanId` on `Plan` + `CreatePlanRequest`; existing `SubPlanDecidedException` (409 `subplan-decided`), `findFirstBySubPlanIdAndSupersededAtIsNull`, `findAllBySourceSubPlanIdOrTargetSubPlanId`.
- Produces: `PlanService.promoteSubPlan(workspaceId: Long, subPlanId: Long, actorUserId: Long): PlanSummaryResponse` (returns the NEW child plan, 201 from controller), `OptionRepository.repointAllBySubPlanId(from, to): Int`, `OptionVoteRepository.repointAllBySubPlanId(from, to): Int`, `PlanEventType.SUBPLAN_PROMOTED`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/kotlin/com/shareddocs/backend/decision/SubPlanPromotionTest.kt` (same scaffold; additionally inject `OptionVoteRepository`, `PlanEventRepository`, `jakarta.persistence.EntityManager`, and the decision-locking service — find its class name + `lockDecision` signature in `DecisionServiceTest.kt` and inject the same way):

```kotlin
    @Test
    fun `promote creates a child plan, moves options and votes under a landing 안건, deletes the original`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val parent = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "자동차 구입"))
        val sp = service.addSubPlan(ws.id!!, parent.id, owner.id!!, CreateSubPlanRequest(title = "브랜드 선정"))
        val optA = service.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "현대"))
        service.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "기아"))
        optionVoteRepository.save(OptionVote(workspaceId = ws.id!!, subPlanId = sp.id, optionId = optA.id, userId = owner.id!!))

        val child = service.promoteSubPlan(ws.id!!, sp.id, owner.id!!)
        entityManager.flush(); entityManager.clear()

        assertEquals(parent.id, child.parentPlanId)
        assertEquals("브랜드 선정", child.title)
        val childTree = service.getTree(ws.id!!, child.id)
        assertEquals(1, childTree.subPlans.size)
        val landing = childTree.subPlans.first()
        assertEquals("브랜드 선정", landing.title)
        assertEquals(listOf("현대", "기아"), landing.options.map { it.title })
        assertEquals(listOf(owner.id!!), landing.options.first { it.title == "현대" }.voterUserIds)
        // original 안건 is gone from the parent
        assertEquals(emptyList<Long>(), service.getTree(ws.id!!, parent.id).subPlans.map { it.id })
    }

    @Test
    fun `promote is blocked when the 안건 has an active decision`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val parent = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "p"))
        val sp = service.addSubPlan(ws.id!!, parent.id, owner.id!!, CreateSubPlanRequest(title = "s"))
        val opt = service.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "o"))
        // lock a decision using the same call DecisionServiceTest uses (adjust to its exact signature)
        decisionService.lockDecision(ws.id!!, sp.id, owner.id!!, LockDecisionRequest(chosenOptionId = opt.id, reason = "이유"))

        assertThrows(SubPlanDecidedException::class.java) {
            service.promoteSubPlan(ws.id!!, sp.id, owner.id!!)
        }
    }

    @Test
    fun `promote is blocked on a locked plan`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val parent = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "p"))
        val sp = service.addSubPlan(ws.id!!, parent.id, owner.id!!, CreateSubPlanRequest(title = "s"))
        service.lock(ws.id!!, parent.id, owner.id!!)

        assertThrows(PlanLockedException::class.java) { service.promoteSubPlan(ws.id!!, sp.id, owner.id!!) }
    }

    @Test
    fun `promote records SUBPLAN_PROMOTED on the parent and PLAN_CREATED on the child`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val parent = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "p"))
        val sp = service.addSubPlan(ws.id!!, parent.id, owner.id!!, CreateSubPlanRequest(title = "s"))

        val child = service.promoteSubPlan(ws.id!!, sp.id, owner.id!!)

        assertTrue(PlanEventType.SUBPLAN_PROMOTED in planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(parent.id).map { it.type })
        assertTrue(PlanEventType.PLAN_CREATED in planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(child.id).map { it.type })
    }
```

Note for the implementer: the decision-locking call in test 2 — find the exact service + request type in `DecisionServiceTest.kt` (it locks a decision on a 안건) and mirror it; the request DTO is named like `LockDecisionRequest(chosenOptionId, reason)` in `DecisionDto.kt`. A promoted 안건 whose decision was later REOPENED must promote fine (supersededAt != null does not block) — that's covered implicitly by using only `findFirstBySubPlanIdAndSupersededAtIsNull`.

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanPromotionTest"`
Expected: COMPILE FAILURE — `promoteSubPlan` unresolved.

- [ ] **Step 3: Implement**

`OptionRepository.kt` — native update (JPA can't re-point `updatable=false` columns via dirty checking; native bypasses the mapping):

```kotlin
    /** Promotion only: move every 선택지 of one 안건 onto another. Clears the persistence
     *  context (native update bypasses it), so re-read anything you still need after calling. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE options SET sub_plan_id = :toSubPlanId WHERE sub_plan_id = :fromSubPlanId", nativeQuery = true)
    fun repointAllBySubPlanId(@Param("fromSubPlanId") fromSubPlanId: Long, @Param("toSubPlanId") toSubPlanId: Long): Int
```

Imports: `org.springframework.data.jpa.repository.Modifying`, `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`.

`OptionVoteRepository.kt` — same shape against `option_votes`:

```kotlin
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE option_votes SET sub_plan_id = :toSubPlanId WHERE sub_plan_id = :fromSubPlanId", nativeQuery = true)
    fun repointAllBySubPlanId(@Param("fromSubPlanId") fromSubPlanId: Long, @Param("toSubPlanId") toSubPlanId: Long): Int
```

`PlanEnums.kt`: add `SUBPLAN_PROMOTED,`.

`PlanService.kt`:

```kotlin
    /**
     * 안건 → 하위결정 전환. Creates a child plan carrying title/description/deadline;
     * existing 선택지 (+ votes, ratings ride along by option id) land under a first
     * 안건 of the same title; the original 안건 row and its edges/superseded
     * decisions are removed. One-way. Blocked when decided (409) or locked (409).
     */
    fun promoteSubPlan(workspaceId: Long, subPlanId: Long, actorUserId: Long): PlanSummaryResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
        if (decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(subPlanId) != null) {
            throw SubPlanDecidedException()
        }
        val parent = requirePlan(workspaceId, subPlan.planId)
        val title = subPlan.title
        val description = subPlan.description
        val deadline = subPlan.deadline
        val parentId = parent.id!!

        val child = planRepository.save(
            Plan(
                workspaceId = workspaceId,
                title = title,
                description = description,
                createdByUserId = actorUserId,
                parentPlanId = parentId,
                deadline = deadline,
            ),
        )
        val childId = child.id!!
        val hadOptions = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId).isNotEmpty()
        if (hadOptions) {
            val landing = subPlanRepository.save(
                SubPlan(
                    workspaceId = workspaceId,
                    planId = childId,
                    title = title,
                    sortOrder = 0,
                    createdByUserId = actorUserId,
                ),
            )
            // Native updates flush+clear the persistence context — only ids/values
            // captured above are safe to use afterwards.
            optionRepository.repointAllBySubPlanId(subPlanId, landing.id!!)
            optionVoteRepository.repointAllBySubPlanId(subPlanId, landing.id!!)
        }
        subPlanEdgeRepository.deleteAll(
            subPlanEdgeRepository.findAllBySourceSubPlanIdOrTargetSubPlanId(subPlanId, subPlanId),
        )
        decisionRepository.deleteAll(decisionRepository.findAllBySubPlanId(subPlanId))
        subPlanRepository.findByIdAndWorkspaceId(subPlanId, workspaceId)?.let { subPlanRepository.delete(it) }
        events.record(
            workspaceId = workspaceId,
            planId = parentId,
            subPlanId = null,
            type = PlanEventType.SUBPLAN_PROMOTED,
            actorUserId = actorUserId,
            payload = mapOf("title" to title, "childPlanId" to childId.toString()),
        )
        events.record(
            workspaceId = workspaceId,
            planId = childId,
            subPlanId = null,
            type = PlanEventType.PLAN_CREATED,
            actorUserId = actorUserId,
            payload = mapOf("title" to title),
        )
        changes.publish(workspaceId, parentId)
        val subPlanCount = if (hadOptions) 1 else 0
        return planRepository.findByIdAndWorkspaceId(childId, workspaceId)!!
            .toSummary(subPlanCount = subPlanCount, decidedCount = 0)
    }
```

(`toSummary` — match the existing private extension's exact parameter list when editing; the re-fetch of the child avoids returning a detached entity after the native updates.)

`SubPlanController.kt`:

```kotlin
    @PostMapping("/{subPlanId}/promote")
    fun promote(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable subPlanId: Long,
    ): ResponseEntity<PlanSummaryResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.promoteSubPlan(ws.id!!, subPlanId, me.userId))
```

Add the missing imports (`AppPrincipal`, `AuthenticationPrincipal`, `ResponseEntity`, `HttpStatus`) matching `PlanController.kt`'s import style.

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanPromotionTest"` → PASS
Run: `./gradlew test` → PASS (full suite).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/ src/test/kotlin/com/shareddocs/backend/decision/SubPlanPromotionTest.kt
git commit -m "feat(decisions): promote an 안건 into a 하위결정 (options+votes move along)"
```

---

### Task 5: Frontend types + API hooks + timeline copy

**Files (frontend repo):**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`
- Modify: `src/features/decisions/formatPlanEvent.tsx`

**Interfaces:**
- Consumes: Task 3/4 response shapes.
- Produces (Tasks 6–8 rely on these exact names): `PlanHierarchyNode`, `PlanHierarchy`, `decisionKeys.hierarchy(wsId, planId)`, `usePlanHierarchy(planId)`, `usePromoteSubPlan()`, `useMovePlan()`, `CreatePlanPayload.parentPlanId?`, `PlanSummary.parentPlanId`, `PlanTree.parentPlanId`.

- [ ] **Step 1: types.ts**

Add `parentPlanId: number | null` to BOTH `PlanSummary` and `PlanTree` (after `groupLabel`). Extend `CreatePlanPayload`:

```ts
export type CreatePlanPayload = { title: string; description?: string; groupLabel?: string; parentPlanId?: number }
```

Add after `PlanTree`:

```ts
export type PlanHierarchyNode = {
  id: number
  parentPlanId: number | null
  title: string
  status: PlanStatus
  deadline: string | null
  completedAt: string | null
  lockedAt: string | null
  canvasX: number | null
  canvasY: number | null
  subPlanCount: number
  decidedCount: number
  childCount: number
  createdAt: string
}

export type PlanHierarchy = {
  rootId: number
  ancestorIds: number[]
  nodes: PlanHierarchyNode[]
}
```

Extend the `PlanEventType` union with `| 'SUBDECISION_ADDED' | 'SUBDECISION_REMOVED' | 'SUBPLAN_PROMOTED'`.

- [ ] **Step 2: api.ts**

Add to `decisionKeys`:

```ts
  hierarchy: (wsId: number | null, planId: number) => ['decisions', wsId, 'hierarchy', planId] as const,
```

Add three hooks (same shapes as `usePlanTree` / `useDeleteSubPlan` in this file):

```ts
export function usePlanHierarchy(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.hierarchy(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanHierarchy>(`/api/plans/${planId}/hierarchy`)).data,
    enabled: activeId != null && Number.isFinite(planId),
  })
}

export function usePromoteSubPlan() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (subPlanId: number) =>
      (await apiClient.post<PlanSummary>(`/api/subplans/${subPlanId}/promote`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

/** Position-only persist for a sub-decision node on the parent canvas.
 *  Mirror useMoveSubPlan's invalidation behavior exactly (canvas state is
 *  seeded once; check that hook and copy its onSuccess — or absence of one). */
export function useMovePlan() {
  return useMutation({
    mutationFn: async (p: { id: number } & CanvasPositionPayload) =>
      (await apiClient.patch<PlanSummary>(`/api/plans/${p.id}`, { canvasX: p.canvasX, canvasY: p.canvasY })).data,
  })
}
```

Import `PlanHierarchy` in the type import list. The hierarchy key sits under the `['decisions', wsId]` prefix, so the realtime change feed invalidates it automatically — zero extra wiring.

- [ ] **Step 3: formatPlanEvent.tsx**

Read the file; it renders a line per `PlanEvent` keyed by `type` with `payload.title`. Add three cases following its existing pattern, with exactly this copy (`title` from payload):

- `SUBDECISION_ADDED` → `하위결정 '{title}'을(를) 추가했어요`
- `SUBDECISION_REMOVED` → `하위결정 '{title}'을(를) 휴지통으로 보냈어요`
- `SUBPLAN_PROMOTED` → `안건 '{title}'을(를) 하위결정으로 전환했어요`

- [ ] **Step 4: Gates + commit**

Run: `npx tsc -b --noEmit` → clean. `npx eslint src/features/decisions/` → no NEW errors (pre-existing debt may exist elsewhere).

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts src/features/decisions/formatPlanEvent.tsx
git commit -m "feat(decisions): hierarchy/promote/move-plan API surface + new event copy"
```

---

### Task 6: 하위결정 section + breadcrumb + zoom transition + complete annotation

**Files (frontend repo):**
- Create: `src/features/decisions/SubDecisionSection.tsx`
- Create: `src/features/decisions/SubDecisionSection.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

**Interfaces:**
- Consumes: `usePlanHierarchy`, `useCreatePlan` (exists in api.ts, used by DecisionList), `PlanModal` (props `{ open, onClose, initial?, groupOptions?, busy?, onSubmit }`), `deadlineLabel`/`toLocalDateString` from `./deadlineLabel`.
- Produces: `<SubDecisionSection childPlans onOpen onAdd locked />`; PlanDetail computes `childPlans: PlanHierarchyNode[]` and `hierarchy` — Task 7/8 reuse both.

- [ ] **Step 1: SubDecisionSection component**

`src/features/decisions/SubDecisionSection.tsx`:

```tsx
import { Plus, GitFork } from 'lucide-react'
import { deadlineLabel, toLocalDateString } from './deadlineLabel'
import type { PlanHierarchyNode } from './types'
import styles from './SubDecisionSection.module.css'

type Props = {
  childPlans: PlanHierarchyNode[]
  locked: boolean
  onOpen: (id: number) => void
  onAdd: () => void
}

/** 하위결정 cards under the 안건 list. A card zooms into the child plan's own page. */
export default function SubDecisionSection({ childPlans, locked, onOpen, onAdd }: Props) {
  if (childPlans.length === 0 && locked) return null
  return (
    <section className={styles.section} aria-label="하위결정">
      <h2 className={styles.heading}>
        <GitFork size={14} aria-hidden /> 하위결정
      </h2>
      <div className={styles.grid}>
        {childPlans.map((c) => {
          const dday = c.deadline ? deadlineLabel(c.deadline, toLocalDateString(new Date())).text : null
          return (
            <button key={c.id} type="button" className={styles.card} onClick={() => onOpen(c.id)}>
              <span className={styles.cardTitle}>{c.title}</span>
              <span className={styles.meta}>
                <span className={c.status === 'COMPLETED' ? styles.done : styles.progress}>
                  {c.status === 'COMPLETED' ? '완료' : '진행 중'}
                </span>
                {dday && <span>{dday}</span>}
                <span>안건 {c.decidedCount}/{c.subPlanCount}</span>
                {c.childCount > 0 && <span>하위 {c.childCount}</span>}
              </span>
            </button>
          )
        })}
        {!locked && (
          <button type="button" className={styles.addCard} onClick={onAdd}>
            <Plus size={14} aria-hidden /> 하위결정 추가
          </button>
        )}
      </div>
    </section>
  )
}
```

`src/features/decisions/SubDecisionSection.module.css`:

```css
.section {
  margin-top: var(--sp-6);
}

.heading {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-muted);
  margin: 0 0 var(--sp-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-3);
}

.card,
.addCard {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  background: var(--c-surface);
  cursor: pointer;
  text-align: left;
  transition: background var(--t-fast);
}

.card:hover,
.addCard:hover {
  background: var(--c-surface-tint);
}

.cardTitle {
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--c-text);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}

.progress {
  color: var(--c-primary);
}

.done {
  color: var(--c-text-muted);
}

.addCard {
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-style: dashed;
  border-color: var(--c-border-dashed);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
```

- [ ] **Step 2: PlanDetail — hierarchy data, breadcrumb, BackLink-to-parent, section mount, child-create modal, zoom, complete annotation**

All edits in `src/features/decisions/PlanDetail.tsx` (anchors reference the current code):

1. Imports: add `Link, useNavigate` to the `react-router-dom` import; add `usePlanHierarchy, useCreatePlan, usePromoteSubPlan` to the `./api` import block (promote is wired in Task 8 but importing now is fine); add `import SubDecisionSection from './SubDecisionSection'` and `import PlanModal from './PlanModal'`; add `GitFork` to the lucide import (Task 8 uses it too).
2. After `usePlanTree`:

```tsx
  const { data: hierarchy } = usePlanHierarchy(planId)
  const navigate = useNavigate()
  const hierarchyById = useMemo(
    () => new Map((hierarchy?.nodes ?? []).map((n) => [n.id, n] as const)),
    [hierarchy],
  )
  const childPlans = useMemo(
    () => (hierarchy?.nodes ?? []).filter((n) => n.parentPlanId === planId),
    [hierarchy, planId],
  )
  const createChild = useCreatePlan()
  const [addingChild, setAddingChild] = useState(false)
```

3. Breadcrumb + parent-aware BackLink. Replace `<BackLink to="/decisions" mobileOnly>결정</BackLink>` with:

```tsx
        <BackLink
          to={tree?.parentPlanId != null ? `/decisions/${tree.parentPlanId}` : '/decisions'}
          mobileOnly
        >
          {tree?.parentPlanId != null ? hierarchyById.get(tree.parentPlanId)?.title ?? '상위 결정' : '결정'}
        </BackLink>
        {tree && (
          <nav className={styles.breadcrumb} aria-label="상위 결정 경로">
            <Link to="/decisions">결정</Link>
            {(hierarchy?.ancestorIds ?? []).length > 2 ? (
              <>
                <span className={styles.crumbSep}>›</span>
                <span className={styles.crumbEllipsis}>…</span>
                {hierarchy!.ancestorIds.slice(-1).map((id) => (
                  <span key={id}>
                    <span className={styles.crumbSep}>›</span>
                    <Link to={`/decisions/${id}`}>{hierarchyById.get(id)?.title ?? '…'}</Link>
                  </span>
                ))}
              </>
            ) : (
              (hierarchy?.ancestorIds ?? []).map((id) => (
                <span key={id}>
                  <span className={styles.crumbSep}>›</span>
                  <Link to={`/decisions/${id}`}>{hierarchyById.get(id)?.title ?? '…'}</Link>
                </span>
              ))
            )}
            <span className={styles.crumbSep}>›</span>
            <span className={styles.crumbCurrent} aria-current="page">{tree.title}</span>
          </nav>
        )}
```

4. Zoom-in transition: on the `tree && (` wrapper div (the one that gets `styles.split` when discussion is open), add `key={planId}` and append the zoom class:

```tsx
        <div key={planId} className={`${discussionOpen ? styles.split : styles.mainWrap} ${styles.zoomEnter}`}>
```

(If the current code passes `undefined` when not split, introduce `styles.mainWrap {}` as an empty hook class — the important part is `zoomEnter` always present and `key={planId}` forcing remount per plan so the animation replays on zoom navigation.)

5. Mount the section in the list view, after the 안건 list block and before the Fab (i.e., immediately after the `{tree.subPlans.length === 0 ? … : (…)}` expression inside `view === 'list'`):

```tsx
              <SubDecisionSection
                childPlans={childPlans}
                locked={locked}
                onOpen={(id) => navigate(`/decisions/${id}`)}
                onAdd={() => setAddingChild(true)}
              />
```

6. Child-create modal — add next to the other modals at the bottom:

```tsx
      <PlanModal
        open={addingChild}
        onClose={() => setAddingChild(false)}
        busy={createChild.isPending}
        onSubmit={(p) =>
          createChild.mutate(
            { ...p, parentPlanId: planId },
            { onSuccess: () => setAddingChild(false) },
          )
        }
      />
```

7. Complete-confirm annotation — in `lifecycleControls`, replace the 완료 branch's `onClick`:

```tsx
          onClick={() => {
            const open = childPlans.filter((c) => c.status === 'ACTIVE').length
            const msg = open > 0
              ? `미완료 하위결정 ${open}개가 있어요. 그래도 완료할까요?`
              : '이 계획을 완료할까요?'
            if (window.confirm(msg)) completePlan.mutate(tree.id)
          }}
```

- [ ] **Step 3: PlanDetail.module.css additions**

```css
.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
  color: var(--c-text-subtle);
  margin-bottom: var(--sp-2);
}

.breadcrumb a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--c-text);
  text-decoration: underline;
}

.crumbSep {
  color: var(--c-text-placeholder);
  padding: 0 2px;
}

.crumbEllipsis {
  color: var(--c-text-placeholder);
}

.crumbCurrent {
  color: var(--c-text);
  font-weight: var(--fw-medium);
}

.mainWrap {
  /* hook class so zoomEnter can always ride alongside split */
}

.zoomEnter {
  animation: zoom-enter var(--t-base);
}

@keyframes zoom-enter {
  from {
    opacity: 0;
    transform: scale(0.975);
  }
}

@media (max-width: 767px) {
  .breadcrumb {
    display: none; /* BackLink covers mobile */
  }
}

@media (prefers-reduced-motion: reduce) {
  .zoomEnter {
    animation: none;
  }
}
```

- [ ] **Step 4: Gates + commit**

Run: `npx tsc -b --noEmit` → clean; `npm run build` → success; `npx eslint src/features/decisions/` → no new errors.
Manual spot-check (`npm run dev`): open a plan → create 하위결정 → card appears → click card → zoom animation into child page → breadcrumb `결정 › parent › child` → click parent crumb → back.

```bash
git add src/features/decisions/
git commit -m "feat(decisions): 하위결정 section, breadcrumb, zoom-in navigation"
```

---

### Task 7: Floating tree navigator

**Files (frontend repo):**
- Create: `src/features/decisions/PlanTreeNavigator.tsx`
- Create: `src/features/decisions/PlanTreeNavigator.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx` (mount)

**Interfaces:**
- Consumes: `PlanHierarchy` from Task 5, `hierarchy` already fetched in PlanDetail (Task 6).
- Produces: `<PlanTreeNavigator hierarchy currentId />` — self-contained floating toggle + panel; renders nothing when the tree has ≤1 node.

- [ ] **Step 1: Component**

`src/features/decisions/PlanTreeNavigator.tsx`:

```tsx
import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTree, X } from 'lucide-react'
import { IconButton } from '../../components/ui'
import type { PlanHierarchy, PlanHierarchyNode } from './types'
import styles from './PlanTreeNavigator.module.css'

type Props = { hierarchy: PlanHierarchy; currentId: number }

const MAX_INDENT_DEPTH = 4

/** Floating tree navigator — the whole decision tree from the root ancestor,
 *  current node highlighted, click to jump. Collapsed to a floating button. */
export default function PlanTreeNavigator({ hierarchy, currentId }: Props) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  if (hierarchy.nodes.length <= 1) return null

  const byParent = new Map<number | null, PlanHierarchyNode[]>()
  hierarchy.nodes.forEach((n) => {
    const key = n.id === hierarchy.rootId ? null : n.parentPlanId
    byParent.set(key, [...(byParent.get(key) ?? []), n])
  })

  const renderNode = (node: PlanHierarchyNode, depth: number): ReactElement => (
    <li key={node.id} className={styles.item}>
      <button
        type="button"
        className={`${styles.node}${node.id === currentId ? ' ' + styles.current : ''}`}
        style={{ paddingLeft: `${Math.min(depth, MAX_INDENT_DEPTH) * 14 + 10}px` }}
        onClick={() => {
          if (node.id !== currentId) {
            navigate(`/decisions/${node.id}`)
            setOpen(false)
          }
        }}
      >
        <span
          className={`${styles.dot} ${node.status === 'COMPLETED' ? styles.dotDone : styles.dotActive}`}
          aria-hidden
        />
        <span className={styles.nodeTitle}>
          {depth > MAX_INDENT_DEPTH ? '› ' : ''}
          {node.title}
        </span>
      </button>
      {(byParent.get(node.id) ?? []).length > 0 && (
        <ul className={styles.children}>
          {(byParent.get(node.id) ?? []).map((c) => renderNode(c, depth + 1))}
        </ul>
      )}
    </li>
  )

  const root = hierarchy.nodes.find((n) => n.id === hierarchy.rootId)
  if (!root) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.toggle}
          aria-label="결정 트리 열기"
          onClick={() => setOpen(true)}
        >
          <ListTree size={18} aria-hidden />
        </button>
      )}
      {open && (
        <div className={styles.panel} role="navigation" aria-label="결정 트리">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>결정 트리</span>
            <IconButton variant="ghost" size="sm" label="닫기" onClick={() => setOpen(false)}>
              <X size={14} />
            </IconButton>
          </div>
          <ul className={styles.tree}>{renderNode(root, 0)}</ul>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Styles**

`src/features/decisions/PlanTreeNavigator.module.css`:

```css
.toggle {
  position: fixed;
  right: var(--sp-4);
  bottom: 96px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--c-border);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  color: var(--c-text-muted);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  z-index: 30;
}

.toggle:hover {
  background: var(--c-surface-tint);
  color: var(--c-text);
}

.panel {
  position: fixed;
  right: var(--sp-4);
  bottom: 96px;
  width: 260px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: var(--shadow-md);
  z-index: 30;
  overflow: hidden;
}

.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--c-border);
}

.panelTitle {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-muted);
}

.tree,
.children {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree {
  overflow-y: auto;
  padding: var(--sp-2) 0;
}

.node {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: 6px 10px;
  border: 0;
  background: none;
  cursor: pointer;
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  text-align: left;
  transition: background var(--t-fast);
}

.node:hover {
  background: var(--c-surface-tint);
  color: var(--c-text);
}

.current {
  background: var(--c-primary-soft);
  color: var(--c-text);
  font-weight: var(--fw-medium);
}

.dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
}

.dotActive {
  background: var(--c-primary);
}

.dotDone {
  background: var(--c-border-strong);
}

.nodeTitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .toggle {
    bottom: 152px; /* clear the 안건-추가 FAB */
  }

  .panel {
    inset: auto 0 0 0;
    width: auto;
    max-height: 70vh;
    border-radius: var(--r-lg) var(--r-lg) 0 0;
    box-shadow: var(--shadow-lg);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

- [ ] **Step 3: Mount in PlanDetail**

Inside the `tree && (…)` block, as a sibling AFTER the split/main wrapper div (so it floats independent of layout):

```tsx
      {tree && hierarchy && <PlanTreeNavigator hierarchy={hierarchy} currentId={planId} />}
```

Add `import PlanTreeNavigator from './PlanTreeNavigator'`.

- [ ] **Step 4: Gates + commit**

Run: `npx tsc -b --noEmit` && `npm run build` → clean. Manual: tree with ≥2 nodes shows the floating button; open → jump to another node → panel closes, page zooms; single-plan tree shows nothing.

```bash
git add src/features/decisions/PlanTreeNavigator.tsx src/features/decisions/PlanTreeNavigator.module.css src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): floating tree navigator"
```

---

### Task 8: Canvas sub-decision nodes + 안건 promote action

**Files (frontend repo):**
- Create: `src/features/decisions/SubDecisionCanvasNode.tsx`
- Create: `src/features/decisions/SubDecisionCanvasNode.module.css`
- Modify: `src/features/decisions/PlanCanvas.tsx`
- Modify: `src/features/decisions/SubPlanSection.tsx` (promote IconButton)
- Modify: `src/features/decisions/PlanDetail.tsx` (promote wiring + childPlans → canvas)

**Interfaces:**
- Consumes: `childPlans` from Task 6, `usePromoteSubPlan`/`useMovePlan` from Task 5, existing `nodeTypes`/`toNode`/`useNodesState` structure in PlanCanvas, `SubPlanSection` actions div.
- Produces: `PlanCanvas` accepts `childPlans: PlanHierarchyNode[]`; `SubPlanSection` accepts `onPromote?: () => void` (auto-flows through `SortableSubPlanSection`'s `ComponentProps` passthrough).

- [ ] **Step 1: Canvas node component**

`src/features/decisions/SubDecisionCanvasNode.tsx`:

```tsx
import { memo } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { GitFork } from 'lucide-react'
import type { PlanHierarchyNode } from './types'
import styles from './SubDecisionCanvasNode.module.css'

export type SubDecisionCanvasNodeData = { plan: PlanHierarchyNode }
export type SubDecisionCanvasNodeType = Node<SubDecisionCanvasNodeData, 'subdecision'>

/** Compact circular-ish canvas node for a 하위결정 — click (in PlanCanvas's
 *  onNodeClick) zooms into the child plan's own page. No handles: sub-decision
 *  nodes don't join the 안건 edge graph. */
function SubDecisionCanvasNode({ data }: NodeProps<SubDecisionCanvasNodeType>) {
  const p = data.plan
  return (
    <div className={`${styles.node}${p.status === 'COMPLETED' ? ' ' + styles.done : ''}`}>
      <GitFork size={13} aria-hidden />
      <span className={styles.title}>{p.title}</span>
      <span className={styles.count}>{p.decidedCount}/{p.subPlanCount}</span>
    </div>
  )
}

export default memo(SubDecisionCanvasNode)
```

`src/features/decisions/SubDecisionCanvasNode.module.css`:

```css
.node {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border: 1px solid var(--c-primary);
  border-radius: var(--r-pill);
  background: var(--c-primary-soft);
  color: var(--c-text);
  font-size: var(--fs-sm);
  cursor: pointer;
  max-width: 220px;
}

.done {
  border-color: var(--c-border-strong);
  background: var(--c-surface-sunken);
  color: var(--c-text-muted);
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  flex: none;
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}
```

- [ ] **Step 2: PlanCanvas edits**

In `src/features/decisions/PlanCanvas.tsx` (anchors from current code):

1. Props: `type Props = { tree: PlanTree; childPlans: PlanHierarchyNode[]; locked: boolean }` (add `childPlans`; thread it into the inner `Flow` component the same way `tree` flows). Import `SubDecisionCanvasNode, { type SubDecisionCanvasNodeType }` and `type PlanHierarchyNode`, plus `useNavigate` from `react-router-dom` and `useMovePlan` from `./api`.
2. Register the node type:

```ts
const nodeTypes = { subplan: SubPlanCanvasNode, subdecision: SubDecisionCanvasNode }
```

3. Node union + builder (next to `toNode`):

```ts
type CanvasNode = SubPlanCanvasNodeType | SubDecisionCanvasNodeType

function toChildNode(p: PlanHierarchyNode, i: number): SubDecisionCanvasNodeType {
  return {
    id: `plan-${p.id}`,
    type: 'subdecision',
    position: { x: p.canvasX ?? i * (220 + 48), y: p.canvasY ?? 340 },
    data: { plan: p },
  }
}
```

(The `plan-` id prefix keeps plan ids from colliding with 안건 ids in the same flow.)

4. Seed both kinds — change the `useNodesState` call:

```ts
const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([
  ...tree.subPlans.map(toNode),
  ...childPlans.map(toChildNode),
])
```

5. Click-to-zoom — add to the `<ReactFlow>` props:

```tsx
onNodeClick={(_, node) => {
  if (node.type === 'subdecision') navigate(`/decisions/${(node.data as SubDecisionCanvasNodeData).plan.id}`)
}}
```

(`const navigate = useNavigate()` in the inner Flow component; import `SubDecisionCanvasNodeData` type.)

6. Drag persist — in the existing `onNodeDragStop` handler, branch by type: if `node.type === 'subdecision'`, call `movePlan.mutate({ id: (node.data as SubDecisionCanvasNodeData).plan.id, canvasX: node.position.x, canvasY: node.position.y })` (with `const movePlan = useMovePlan()`); else keep the existing `useMoveSubPlan` path unchanged. Follow the existing handler's debounce/guard structure exactly — only add the branch.
7. `PlanDetail.tsx`: pass the new prop — `<PlanCanvas tree={tree} childPlans={childPlans} locked={locked} />`.

- [ ] **Step 3: Promote action on 안건**

`SubPlanSection.tsx`:
1. Props: add `onPromote?: () => void`.
2. In the `!locked` actions div, before the 수정 IconButton, add (only for undecided 안건 — `subPlan.decision == null`; match how the component reads `decision` locally):

```tsx
    {onPromote && subPlan.decision == null && (
      <IconButton variant="ghost" size="sm" label="하위결정으로 전환" onClick={onPromote}>
        <GitFork size={14} />
      </IconButton>
    )}
```

Add `GitFork` to the lucide import. (`SortableSubPlanSection` passes all props through via `ComponentProps<typeof SubPlanSection>` — no change needed there.)

`PlanDetail.tsx` — in `renderSubPlan`, add alongside the other callbacks:

```tsx
      onPromote={() => {
        if (!window.confirm(`'${sp.title}' 안건을 하위결정으로 전환할까요? 선택지와 투표는 새 계획으로 옮겨져요.`)) return
        promote.mutate(sp.id, { onSuccess: (p) => navigate(`/decisions/${p.id}`) })
      }}
```

with `const promote = usePromoteSubPlan()` near the other mutations, and add `promote.isPending` into the existing `busy={…}` chain.

- [ ] **Step 4: Gates + commit**

Run: `npx tsc -b --noEmit` && `npm run build` → clean; `npx eslint src/features/decisions/` → no new errors.
Manual: canvas shows pill nodes for children below the 안건 row; drag one, reload → position kept; click → zooms in. Promote an 안건 with options+votes → lands on the new child page with a same-titled 안건 carrying the options; parent's 기록 shows the promotion line.

```bash
git add src/features/decisions/
git commit -m "feat(decisions): canvas sub-decision nodes + 안건 promotion action"
```

---

### Task 9: Docs sync, full gates, deploy

**Files:**
- Modify: `CLAUDE.md` (frontend repo — feature table + header)
- Both repos: final verification + push

**Interfaces:** none — bookkeeping and ship.

- [ ] **Step 1: CLAUDE.md**

1. Add to the feature-status table: `| Decisions 하위결정 tree (Life Story Board Phase 1) | **Shipped 2026-07-08.** plans.parent_plan_id (V23), root-only board, subtree trash cascade, GET /api/plans/{id}/hierarchy, 하위결정 section + breadcrumb + zoom navigation + floating tree navigator + canvas nodes, 안건→하위결정 promotion (POST /api/subplans/{id}/promote). Design/plan: docs/plans/2026-07-08-life-story-board-design.md + 2026-07-08-sub-decision-tree-plan.md. Phases 2 (자료+댓글) and 3 (스토리 뷰) pending. |`
2. While in the file: the header still says decisions realtime collab is "built + reviewed on branch …, pending smoke+merge" — it merged and deployed 2026-07-07. Reword that sentence to "**shipped to production 2026-07-07**" (keep the rest of the sentence's architecture summary).
3. Update the "Flyway owns the schema (latest V22)" line to V23.

- [ ] **Step 2: Full gates, both repos**

Backend: `./gradlew test` → all green (~245+).
Frontend: `npx tsc -b --noEmit` && `npm run build` && `npx eslint src/features/decisions/` → clean.

- [ ] **Step 3: Commit docs, push both repos, verify deploy locally**

```bash
# frontend repo
git add CLAUDE.md docs/plans/2026-07-08-sub-decision-tree-plan.md
git commit -m "docs: sub-decision tree shipped (Life Story Board Phase 1)"
git push origin main
# backend repo
git push origin main
```

This machine IS the CD runner: verify with `docker logs shared-docs-backend 2>&1 | grep -i flyway | tail -3` (expect "Migrating schema … to version 23 - sub decision tree → Successfully applied") and `curl -s localhost:8090/actuator/health` (expect `"status":"UP"`). Vercel builds the frontend cloud-side.

- [ ] **Step 4: Manual smoke checklist (user)**

- Create 하위결정 from a plan page; zoom in via card, canvas node, and navigator; breadcrumb + BackLink round-trips.
- Promote an 안건 carrying 선택지 + a vote; confirm the vote survives on the landing 안건.
- Trash a parent → child pages 404; trash tab shows only the parent; restore brings both back.
- Complete a parent with an open child → confirm shows "미완료 하위결정 1개".
- Second browser: watch a 하위결정 appear live via the change feed.
