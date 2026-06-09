# Decisions D3 — Interactive 안건 Canvas (drag · edges · create) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only D2 안건 canvas into an interactive one: drag nodes (positions persist), draw/delete directed edges between 안건, and create a new 안건 directly on the canvas at the viewport center.

**Architecture:** Backend adds the only missing piece — a `sub_plan_edges` table (V16) with entity/repo/service/controller, and `edges` on the plan-tree read. Drag-persistence backend already exists (`PATCH /api/subplans/{id}` accepts `canvasX/Y`). Frontend rewrites `PlanCanvas` from uncontrolled/read-only to controlled (`useNodesState`/`useEdgesState`), wires `onNodeDragStop` → debounced position PATCH, `onConnect` → create-edge, a custom deletable edge (click → ✕), and a viewport-center "+ 안건" toolbar via `useReactFlow().screenToFlowPosition`.

**Tech Stack:** Spring Boot 3.5.3 + Kotlin (JPA, Flyway, RFC 7807), MariaDB · Vite + React 19 + TS + CSS Modules + React Query + @xyflow/react@12.11.0.

---

## Design decisions locked for D3 (from brainstorm 2026-06-09)

1. **New 안건 placement** = **viewport center** (`screenToFlowPosition` of the canvas container center); position is persisted immediately on create.
2. **Edge interaction** = **handles + click-to-delete**. Drag from a node's right (source) handle to another's left (target) handle to connect. Click an edge to select it → a small ✕ appears at its midpoint → click ✕ to delete. Works with mouse and touch.
3. **Edge constraints** (backend) = **block self-loops + duplicates only**; any direction allowed, **cycles permitted** (YAGNI; matches spec `unique(source, target)`).

## Data model (new)

- **SubPlanEdge** — `workspaceId, planId, sourceSubPlanId, targetSubPlanId`. Unique `(source_sub_plan_id, target_sub_plan_id)`. Reference-by-id FKs, `ON DELETE RESTRICT` (consistent with the rest of the decision package). No `PlanEvent` is recorded for edges or for drag positions — they are live canvas state, like ratings (design spec §4).

## Canvas state model (read this before Tasks 6–8)

The 캔버스 tab mounts `PlanCanvas` **only when active** (unchanged from D2). In D3 the canvas is **controlled**: it seeds `useNodesState` / `useEdgesState` **once** from the initial tree (React seeds state from the initializer on first render only; later `tree` prop changes are ignored by the controlled state — this is intentional and avoids a setState-in-effect violation and viewport resets).

Consequences, by mutation:

- **Drag (`onNodeDragStop`)** → `PATCH /api/subplans/{id}` with `{canvasX, canvasY}`, **debounced** per node. Positions do not affect list/roadmap roll-ups, so this mutation **does not invalidate** any query (fire-and-forget; on error, surface nothing — the next drag re-saves).
- **Create edge (`onConnect`)** → `POST /api/plans/{planId}/edges`; on success append the returned edge (with its real id) to local `edges`. Edges are not shown in the 목록 view or roll-ups, so this **does not invalidate** the tree.
- **Delete edge (✕)** → `DELETE /api/edges/{id}`; on success remove from local `edges`. No invalidation.
- **Create 안건 (+ toolbar)** → `POST /api/plans/{planId}/subplans` then immediately `PATCH /api/subplans/{newId}` with the viewport-center position; on success append the node to local `nodes` **and** invalidate `decisionKeys.scope(activeId)` so the 목록 view + roadmap roll-ups stay correct. The **mounted canvas keeps its local node state** (it ignores the prop refetch), so there is no remount/flash; the next time the canvas mounts it reads the persisted node. This is the one canvas mutation that invalidates, and it is safe precisely because the controlled state ignores prop changes.

This model means: while you are on the canvas, what you see is your local edits; the background data is kept consistent for the 목록 view and for the next mount.

---

# PART A — Backend (`shared-docs-backend`)

> Branch note: do all work on a new branch `decisions-d3` (created by the executing skill). Backend `main` is at `82391af`.

### Task 1: V16 migration + `SubPlanEdge` entity + repository

**Files:**
- Create: `src/main/resources/db/migration/V16__sub_plan_edges.sql`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanEdge.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanEdgeRepository.kt`

- [ ] **Step 1: Write the migration**

`V16__sub_plan_edges.sql`:

```sql
-- D3 (Decisions canvas): directed edges between 안건 on a 계획's canvas
-- ("decide 동네 before 예산"). Purely additive — a new table, no change to
-- existing data. canvas_x/canvas_y already exist on sub_plans (V15), so node
-- drag persistence needs no migration; only edges do.

CREATE TABLE `sub_plan_edges` (
  `id`                   bigint(20)  NOT NULL AUTO_INCREMENT,
  `workspace_id`         bigint(20)  NOT NULL,
  `plan_id`              bigint(20)  NOT NULL,
  `source_sub_plan_id`   bigint(20)  NOT NULL,
  `target_sub_plan_id`   bigint(20)  NOT NULL,
  `version`              bigint(20)  NOT NULL DEFAULT 0,
  `created_at`           datetime(6) NOT NULL,
  `updated_at`           datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sub_plan_edges_src_tgt` (`source_sub_plan_id`, `target_sub_plan_id`),
  KEY `idx_sub_plan_edges_plan` (`plan_id`),
  KEY `idx_sub_plan_edges_workspace` (`workspace_id`),
  CONSTRAINT `fk_sub_plan_edges_plan` FOREIGN KEY (`plan_id`)
      REFERENCES `plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sub_plan_edges_source` FOREIGN KEY (`source_sub_plan_id`)
      REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sub_plan_edges_target` FOREIGN KEY (`target_sub_plan_id`)
      REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sub_plan_edges_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Write the entity**

`SubPlanEdge.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/**
 * A directed edge between two 안건 on a 계획's canvas ("decide 동네 before 예산").
 * Referenced to its plan + endpoints by id. Unique on (source, target); cycles
 * and any direction are allowed (the order is the members' intent, not enforced).
 */
@Entity
@Table(
    name = "sub_plan_edges",
    uniqueConstraints = [
        UniqueConstraint(name = "uq_sub_plan_edges_src_tgt", columnNames = ["source_sub_plan_id", "target_sub_plan_id"]),
    ],
    indexes = [
        Index(name = "idx_sub_plan_edges_plan", columnList = "plan_id"),
        Index(name = "idx_sub_plan_edges_workspace", columnList = "workspace_id"),
    ],
)
class SubPlanEdge(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "plan_id", nullable = false, updatable = false)
    val planId: Long,

    @Column(name = "source_sub_plan_id", nullable = false, updatable = false)
    val sourceSubPlanId: Long,

    @Column(name = "target_sub_plan_id", nullable = false, updatable = false)
    val targetSubPlanId: Long,
) : BaseEntity()
```

- [ ] **Step 3: Write the repository**

`SubPlanEdgeRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface SubPlanEdgeRepository : JpaRepository<SubPlanEdge, Long> {

    fun findAllByPlanId(planId: Long): List<SubPlanEdge>

    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): SubPlanEdge?

    fun existsBySourceSubPlanIdAndTargetSubPlanId(sourceSubPlanId: Long, targetSubPlanId: Long): Boolean

    /** Used when deleting a 안건 so edges don't block the RESTRICT FK. */
    fun findAllBySourceSubPlanIdOrTargetSubPlanId(sourceSubPlanId: Long, targetSubPlanId: Long): List<SubPlanEdge>
}
```

- [ ] **Step 4: Build to verify schema validates against the new table**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL (entity compiles; Hibernate `validate` runs at app/test boot, verified in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/main/resources/db/migration/V16__sub_plan_edges.sql \
        src/main/kotlin/com/shareddocs/backend/decision/SubPlanEdge.kt \
        src/main/kotlin/com/shareddocs/backend/decision/SubPlanEdgeRepository.kt
git commit -m "feat(decisions): sub_plan_edges table + entity/repo (D3)"
```

---

### Task 2: Edge exceptions + DTOs + `edges` on the tree response

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`

- [ ] **Step 1: Add the two new exceptions**

Append to `DecisionExceptions.kt` (after `OptionInUseException`):

```kotlin
/** An edge would loop a 안건 to itself. */
class EdgeSelfLoopException :
    ApiException(HttpStatus.BAD_REQUEST, "edge-self-loop", "Edge cannot loop to itself", "안건을 자기 자신과 연결할 수 없어요.")

/** An identical (source → target) edge already exists. */
class EdgeDuplicateException :
    ApiException(HttpStatus.CONFLICT, "edge-duplicate", "Edge already exists", "이미 연결된 안건이에요.")

class SubPlanEdgeNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "edge-not-found", "Edge not found", "연결을 찾을 수 없어요.")
```

(`SubPlanNotInPlanException` already exists and is reused for "an endpoint 안건 doesn't belong to this 계획".)

- [ ] **Step 2: Add the request + response DTOs and `edges` on the tree**

In `DecisionDto.kt`, add to the Requests section (after `LockDecisionRequest`):

```kotlin
/** Create a directed canvas edge between two 안건 of the same 계획. */
data class CreateEdgeRequest(
    val sourceSubPlanId: Long,
    val targetSubPlanId: Long,
)
```

Add to the Responses section (after `PlanEventResponse`):

```kotlin
data class SubPlanEdgeResponse(
    val id: Long,
    val sourceSubPlanId: Long,
    val targetSubPlanId: Long,
)
```

Add the `edges` field to `PlanTreeResponse` (after `subPlans`):

```kotlin
data class PlanTreeResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val status: PlanStatus,
    val canvasX: Double?,
    val canvasY: Double?,
    val groupLabel: String?,
    val createdByUserId: Long,
    val createdAt: Instant,
    val subPlans: List<SubPlanResponse>,
    val edges: List<SubPlanEdgeResponse>,
)
```

- [ ] **Step 3: Compile**

Run: `./gradlew compileKotlin`
Expected: FAIL — `PlanTreeResponse(...)` constructor call in `PlanService.getTree` now misses `edges`. (Fixed in Task 3.) This confirms the field is required.

- [ ] **Step 4: Commit** (after Task 3 compiles — do not commit a broken build; this task's files are committed together with Task 3.)

---

### Task 3: `EdgeService` logic, tree wiring, `EdgeController`

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/EdgeService.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/EdgeController.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (inject edge repo; populate `edges` in `getTree`; remove edges in `deleteSubPlan`/`delete`)

- [ ] **Step 1: Write `EdgeService`**

`EdgeService.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Canvas edges between 안건. Workspace scoping is passed by the controller
 * (@CurrentWorkspace, membership already proven by the filter); every lookup is
 * additionally scoped by workspaceId so a foreign id 404s. Edges are live canvas
 * state — no PlanEvent is recorded (consistent with ratings and drag positions).
 */
@Service
@Transactional
class EdgeService(
    private val planRepository: PlanRepository,
    private val subPlanRepository: SubPlanRepository,
    private val edgeRepository: SubPlanEdgeRepository,
) {
    fun create(workspaceId: Long, planId: Long, request: CreateEdgeRequest): SubPlanEdgeResponse {
        if (request.sourceSubPlanId == request.targetSubPlanId) throw EdgeSelfLoopException()
        planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()
        // Both endpoints must exist in this workspace AND belong to this plan.
        requireSubPlanInPlan(workspaceId, planId, request.sourceSubPlanId)
        requireSubPlanInPlan(workspaceId, planId, request.targetSubPlanId)
        if (edgeRepository.existsBySourceSubPlanIdAndTargetSubPlanId(request.sourceSubPlanId, request.targetSubPlanId)) {
            throw EdgeDuplicateException()
        }
        val edge = edgeRepository.save(
            SubPlanEdge(
                workspaceId = workspaceId,
                planId = planId,
                sourceSubPlanId = request.sourceSubPlanId,
                targetSubPlanId = request.targetSubPlanId,
            ),
        )
        return SubPlanEdgeResponse(id = edge.id!!, sourceSubPlanId = edge.sourceSubPlanId, targetSubPlanId = edge.targetSubPlanId)
    }

    fun delete(workspaceId: Long, edgeId: Long) {
        val edge = edgeRepository.findByIdAndWorkspaceId(edgeId, workspaceId) ?: throw SubPlanEdgeNotFoundException()
        edgeRepository.delete(edge)
    }

    private fun requireSubPlanInPlan(workspaceId: Long, planId: Long, subPlanId: Long) {
        val sp = subPlanRepository.findByIdAndWorkspaceId(subPlanId, workspaceId) ?: throw SubPlanNotFoundException()
        if (sp.planId != planId) throw SubPlanNotInPlanException()
    }
}
```

- [ ] **Step 2: Write `EdgeController`**

`EdgeController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/**
 * Canvas edges. Create is plan-scoped (POST /api/plans/{id}/edges); delete is
 * edge-scoped (DELETE /api/edges/{id}). Both scoped to the active workspace.
 */
@RestController
class EdgeController(
    private val service: EdgeService,
) {
    @PostMapping("/api/plans/{planId}/edges")
    fun create(
        @CurrentWorkspace ws: Workspace,
        @PathVariable planId: Long,
        @Valid @RequestBody request: CreateEdgeRequest,
    ): ResponseEntity<SubPlanEdgeResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.create(ws.id!!, planId, request))

    @DeleteMapping("/api/edges/{edgeId}")
    fun delete(@CurrentWorkspace ws: Workspace, @PathVariable edgeId: Long): ResponseEntity<Void> {
        service.delete(ws.id!!, edgeId)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 3: Wire edges into `PlanService`**

In `PlanService.kt`:

(a) Add the repo to the constructor (after `decisionRepository`):

```kotlin
    private val decisionRepository: DecisionRepository,
    private val subPlanEdgeRepository: SubPlanEdgeRepository,
    private val events: PlanEventRecorder,
```

(b) In `getTree`, after building `subPlanResponses` and before `return PlanTreeResponse(`, load edges:

```kotlin
        val edges = subPlanEdgeRepository.findAllByPlanId(planId)
            .map { SubPlanEdgeResponse(id = it.id!!, sourceSubPlanId = it.sourceSubPlanId, targetSubPlanId = it.targetSubPlanId) }
```

and add `edges = edges,` as the final argument of the `PlanTreeResponse(...)` call.

(c) In `deleteSubPlan`, before deleting decisions (edges reference the 안건 via RESTRICT FK, so remove them first):

```kotlin
    fun deleteSubPlan(workspaceId: Long, subPlanId: Long) {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        subPlanEdgeRepository.deleteAll(
            subPlanEdgeRepository.findAllBySourceSubPlanIdOrTargetSubPlanId(subPlanId, subPlanId),
        )
        val options = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId)
        // ... unchanged below ...
```

(d) In `delete` (whole plan), before `subPlanRepository.deleteAll(subPlans)` add:

```kotlin
        subPlanEdgeRepository.deleteAll(subPlanEdgeRepository.findAllByPlanId(planId))
```

- [ ] **Step 4: Compile**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit Tasks 2 + 3 together**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/EdgeService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/EdgeController.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt
git commit -m "feat(decisions): edge create/delete service + controller, edges on tree (D3)"
```

---

### Task 4: Backend tests

**Files:**
- Create: `src/test/kotlin/com/shareddocs/backend/decision/EdgeServiceTest.kt`

- [ ] **Step 1: Write the test**

`EdgeServiceTest.kt`:

```kotlin
package com.shareddocs.backend.decision

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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class EdgeServiceTest(
    @Autowired private val edges: EdgeService,
    @Autowired private val plans: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `create edge then it appears on the tree`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val b = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))

        val edge = edges.create(ws.id!!, plan.id, CreateEdgeRequest(a.id, b.id))

        val tree = plans.getTree(ws.id!!, plan.id)
        assertEquals(1, tree.edges.size)
        assertEquals(edge.id, tree.edges[0].id)
        assertEquals(a.id, tree.edges[0].sourceSubPlanId)
        assertEquals(b.id, tree.edges[0].targetSubPlanId)
    }

    @Test
    fun `self-loop is rejected`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        assertThrows(EdgeSelfLoopException::class.java) {
            edges.create(ws.id!!, plan.id, CreateEdgeRequest(a.id, a.id))
        }
    }

    @Test
    fun `duplicate edge is rejected`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val b = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))
        edges.create(ws.id!!, plan.id, CreateEdgeRequest(a.id, b.id))
        assertThrows(EdgeDuplicateException::class.java) {
            edges.create(ws.id!!, plan.id, CreateEdgeRequest(a.id, b.id))
        }
    }

    @Test
    fun `endpoint from another plan is rejected`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val planA = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "A"))
        val planB = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "B"))
        val a = plans.addSubPlan(ws.id!!, planA.id, owner.id!!, CreateSubPlanRequest(title = "a"))
        val b = plans.addSubPlan(ws.id!!, planB.id, owner.id!!, CreateSubPlanRequest(title = "b"))
        assertThrows(SubPlanNotInPlanException::class.java) {
            edges.create(ws.id!!, planA.id, CreateEdgeRequest(a.id, b.id))
        }
    }

    @Test
    fun `delete edge removes it from the tree`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val b = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))
        val edge = edges.create(ws.id!!, plan.id, CreateEdgeRequest(a.id, b.id))

        edges.delete(ws.id!!, edge.id)

        assertEquals(0, plans.getTree(ws.id!!, plan.id).edges.size)
    }

    @Test
    fun `delete edge 404s for a foreign workspace`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        val plan = plans.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = plans.addSubPlan(wsA.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val b = plans.addSubPlan(wsA.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))
        val edge = edges.create(wsA.id!!, plan.id, CreateEdgeRequest(a.id, b.id))
        assertThrows(SubPlanEdgeNotFoundException::class.java) { edges.delete(wsB.id!!, edge.id) }
    }

    @Test
    fun `deleting a 안건 with edges succeeds (edges removed first)`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val a = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val b = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))
        edges.create(ws.id!!, plan.id, CreateEdgeRequest(a.id, b.id))

        plans.deleteSubPlan(ws.id!!, a.id)

        val tree = plans.getTree(ws.id!!, plan.id)
        assertEquals(listOf("예산"), tree.subPlans.map { it.title })
        assertEquals(0, tree.edges.size)
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.EdgeServiceTest"`
Expected: 7 tests PASS. (Hibernate `validate` against V16 also runs at boot — a schema mismatch would fail startup.)

- [ ] **Step 3: Full build (whole suite green, schema validates)**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL (prior 76 tests + 7 new = 83).

- [ ] **Step 4: Commit**

```bash
git add src/test/kotlin/com/shareddocs/backend/decision/EdgeServiceTest.kt
git commit -m "test(decisions): edge create/validation/delete + 안건-with-edges delete (D3)"
```

---

# PART B — Frontend (`shared-docs`)

> Same branch `decisions-d3`. Frontend `main` is at `925da74`.

### Task 5: Edge/position types + API hooks

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`

- [ ] **Step 1: Add types**

In `types.ts`, add the edge type and put it on `PlanTree`:

```ts
export type SubPlanEdge = {
  id: number
  sourceSubPlanId: number
  targetSubPlanId: number
}
```

Add `edges: SubPlanEdge[]` to `PlanTree` (after `subPlans`):

```ts
export type PlanTree = {
  id: number
  title: string
  description: string | null
  status: PlanStatus
  canvasX: number | null
  canvasY: number | null
  groupLabel: string | null
  createdByUserId: number
  createdAt: string
  subPlans: SubPlanNode[]
  edges: SubPlanEdge[]
}
```

Add payload types (in the Payloads section):

```ts
export type CanvasPositionPayload = { canvasX: number; canvasY: number }
export type CreateEdgePayload = { sourceSubPlanId: number; targetSubPlanId: number }
```

- [ ] **Step 2: Add API hooks**

In `api.ts`, import the new types (extend the existing import) and add `SubPlanEdge`, `CanvasPositionPayload`, `CreateEdgePayload`:

```ts
import type {
  CanvasPositionPayload, CreateEdgePayload, CreatePlanPayload, LockDecisionPayload,
  OptionNode, PlanSummary, PlanTree, Rating, RatePayload, SubPlanEdge, SubPlanNode,
  TitleDescPayload, UpdatePlanPayload,
} from './types'
```

Add these hooks at the end of the file:

```ts
// ── Canvas (D3): drag positions + edges ──

/**
 * Persist a node's dragged position. Positions don't affect list/roadmap roll-ups
 * or the 목록 view, so this does NOT invalidate any query — the mounted canvas owns
 * its node state; the next mount reads the persisted value. Fire-and-forget.
 */
export function useMoveSubPlan() {
  return useMutation({
    mutationFn: async (v: { id: number; payload: CanvasPositionPayload }) => {
      await apiClient.patch(`/api/subplans/${v.id}`, v.payload)
    },
  })
}

/** Create an edge. Edges aren't shown in 목록/roll-ups, so no invalidation — the
 *  canvas appends the returned edge (with its real id) to local state. */
export function useCreateEdge(planId: number) {
  return useMutation({
    mutationFn: async (payload: CreateEdgePayload) =>
      (await apiClient.post<SubPlanEdge>(`/api/plans/${planId}/edges`, payload)).data,
  })
}

export function useDeleteEdge() {
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/edges/${id}`) },
  })
}

/** Create a 안건 from the canvas. Unlike useAddSubPlan, this DOES invalidate the
 *  scope so 목록 + roadmap roll-ups stay correct; the mounted canvas keeps its
 *  local node state (it ignores the prop refetch), so there is no remount/flash. */
export function useAddSubPlanOnCanvas(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (p: TitleDescPayload) =>
      (await apiClient.post<SubPlanNode>(`/api/plans/${planId}/subplans`, p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no consumer of `PlanTree.edges` yet; `usePlanTree` already returns it).

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions-fe): edge + canvas-position types and API hooks (D3)"
```

---

### Task 6: Make `SubPlanCanvasNode` connectable + a deletable edge component

**Files:**
- Modify: `src/features/decisions/SubPlanCanvasNode.tsx`
- Modify: `src/features/decisions/SubPlanCanvasNode.module.css`
- Create: `src/features/decisions/DeletableEdge.tsx`
- Create: `src/features/decisions/DeletableEdge.module.css`

- [ ] **Step 1: Add source/target handles to the node**

In `SubPlanCanvasNode.tsx`, import `Handle` and `Position`, and render two handles inside the node root. Update the imports and the returned JSX root:

```tsx
import { useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import styles from './SubPlanCanvasNode.module.css'
import type { SubPlanNode, SubPlanStatus } from './types'
```

Add the handles as the first two children of the `<div className={...node...}>`:

```tsx
  return (
    <div className={`${styles.node} ${statusClass}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <button type="button" className={`${styles.head} nodrag`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
```

(Everything else in the node is unchanged from D2.)

- [ ] **Step 2: Style the handles subtle (Bear-minimal)**

Append to `SubPlanCanvasNode.module.css`:

```css
/* Connection handles — small, quiet; only obvious on node hover. */
.handle {
  width: 8px;
  height: 8px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.node:hover .handle { opacity: 1; }
.handle:hover { border-color: var(--c-accent); }
```

- [ ] **Step 3: Write the deletable edge**

`DeletableEdge.tsx`:

> Deletion goes through React Flow's own `deleteElements` (which removes the edge from the flow's state and fires the `onEdgesDelete` callback that `Flow` wires to the backend in Task 7). This keeps the edge component free of any backend handler — no callback embedded in edge `data`, so no state-init ordering cycle in `Flow`.

```tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import styles from './DeletableEdge.module.css'

export type DeletableEdgeType = Edge<Record<string, never>, 'deletable'>

export default function DeletableEdge(
  { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }: EdgeProps<DeletableEdgeType>,
) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`${styles.delete} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={() => deleteElements({ edges: [{ id }] })}
            aria-label="연결 삭제"
          >
            <X size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
```

`DeletableEdge.module.css`:

```css
.delete {
  position: absolute;
  pointer-events: all;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--c-border);
  border-radius: var(--r-full, 999px);
  background: var(--c-surface);
  color: var(--c-text-secondary);
  cursor: pointer;
}
.delete:hover {
  border-color: var(--c-danger, #e5484d);
  color: var(--c-danger, #e5484d);
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/decisions/SubPlanCanvasNode.tsx \
        src/features/decisions/SubPlanCanvasNode.module.css \
        src/features/decisions/DeletableEdge.tsx \
        src/features/decisions/DeletableEdge.module.css
git commit -m "feat(decisions-fe): connectable node handles + deletable edge (D3)"
```

---

### Task 7: Rewrite `PlanCanvas` to interactive (drag persist · connect · create)

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx`
- Modify: `src/features/decisions/PlanCanvas.module.css`

This is the integration task. The canvas becomes controlled and editable. The canvas owns the "create 안건 on canvas" flow (it owns `screenToFlowPosition`, which the spawn position needs), so it renders its own `TitleDescModal` — the 목록 view's add path in `PlanDetail` is untouched.

- [ ] **Step 1: Rewrite `PlanCanvas.tsx`**

Replace the whole file with:

```tsx
import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType,
  useNodesState, useEdgesState, useReactFlow, addEdge,
  type Connection, type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { EmptyState, Button } from '../../components/ui'
import SubPlanCanvasNode, { type SubPlanCanvasNodeType } from './SubPlanCanvasNode'
import DeletableEdge, { type DeletableEdgeType } from './DeletableEdge'
import TitleDescModal from './TitleDescModal'
import { useMoveSubPlan, useCreateEdge, useDeleteEdge, useAddSubPlanOnCanvas } from './api'
import styles from './PlanCanvas.module.css'
import type { PlanTree, SubPlanNode } from './types'

const nodeTypes = { subplan: SubPlanCanvasNode }
const edgeTypes = { deletable: DeletableEdge }
const NODE_W = 260
const GAP_X = 64
const DRAG_SAVE_MS = 400

/** Auto-layout fallback for nodes never dragged (canvasX/Y null) — the D2 row. */
function nodePosition(sp: SubPlanNode, i: number) {
  return { x: sp.canvasX ?? i * (NODE_W + GAP_X), y: sp.canvasY ?? 0 }
}

function toNode(sp: SubPlanNode, i: number): SubPlanCanvasNodeType {
  return { id: String(sp.id), type: 'subplan', position: nodePosition(sp, i), data: { subPlan: sp } }
}

function toEdge(e: PlanTree['edges'][number]): DeletableEdgeType {
  return {
    id: String(e.id),
    source: String(e.sourceSubPlanId),
    target: String(e.targetSubPlanId),
    type: 'deletable',
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

type Props = { tree: PlanTree }

export default function PlanCanvas({ tree }: Props) {
  if (tree.subPlans.length === 0) {
    return (
      <div className={`${styles.canvas} ${styles.canvasEmpty}`}>
        <CanvasEmpty tree={tree} />
      </div>
    )
  }
  return (
    <ReactFlowProvider>
      <Flow tree={tree} />
    </ReactFlowProvider>
  )
}

/** Empty canvas: no React Flow context, so the first 안건 is created with a null
 *  position (auto-layout will place the single node on the next mount). */
function CanvasEmpty({ tree }: Props) {
  const [adding, setAdding] = useState(false)
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)
  return (
    <>
      <EmptyState
        title="안건이 없어요"
        description="안건을 추가하면 여기에 나타나요."
        action={<Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAdding(true)}>안건 추가</Button>}
      />
      <TitleDescModal
        open={adding} onClose={() => setAdding(false)} entityLabel="안건" busy={addSubPlanM.isPending}
        onSubmit={(p) => addSubPlanM.mutate(p, { onSuccess: () => setAdding(false) })}
      />
    </>
  )
}

function Flow({ tree }: Props) {
  // Seed controlled state ONCE from the initial tree (React reads an initializer
  // only on first render). Later tree refetches are intentionally ignored — the
  // canvas owns its state while mounted; the next mount re-reads fresh data.
  const [nodes, setNodes, onNodesChange] = useNodesState<SubPlanCanvasNodeType>(tree.subPlans.map(toNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState<DeletableEdgeType>(tree.edges.map(toEdge))
  const [adding, setAdding] = useState(false)

  const move = useMoveSubPlan()
  const createEdgeM = useCreateEdge(tree.id)
  const deleteEdgeM = useDeleteEdge()
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)

  const { screenToFlowPosition } = useReactFlow()
  const wrapRef = useRef<HTMLDivElement>(null)

  // Persist each node's final position, debounced per node id.
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const onNodeDragStop = useCallback<OnNodeDrag<SubPlanCanvasNodeType>>((_e, node) => {
    const timers = saveTimers.current
    const existing = timers.get(node.id)
    if (existing) clearTimeout(existing)
    timers.set(node.id, setTimeout(() => {
      move.mutate({ id: Number(node.id), payload: { canvasX: node.position.x, canvasY: node.position.y } })
      timers.delete(node.id)
    }, DRAG_SAVE_MS))
  }, [move])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    createEdgeM.mutate(
      { sourceSubPlanId: Number(c.source), targetSubPlanId: Number(c.target) },
      {
        onSuccess: (edge) => setEdges((es) => addEdge(toEdge(edge), es)),
        onError: (err) => window.alert((err as { body?: { detail?: string } }).body?.detail ?? '연결할 수 없어요.'),
      },
    )
  }, [createEdgeM, setEdges])

  // ✕ on a selected edge (and the Delete key) call React Flow's deleteElements,
  // which removes the edge locally and fires this — we persist the removal here.
  const onEdgesDelete = useCallback((deleted: DeletableEdgeType[]) => {
    deleted.forEach((e) => deleteEdgeM.mutate(Number(e.id)))
  }, [deleteEdgeM])

  // "+ 안건" spawns at the canvas viewport center, then persists that position.
  const addAtCenter = useCallback((payload: { title: string; description?: string }, done: () => void) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 }
    addSubPlanM.mutate(payload, {
      onSuccess: (sp) => {
        move.mutate({ id: sp.id, payload: { canvasX: center.x, canvasY: center.y } })
        setNodes((ns) => ns.concat({ id: String(sp.id), type: 'subplan', position: center, data: { subPlan: sp } }))
        done()
      },
    })
  }, [addSubPlanM, move, screenToFlowPosition, setNodes])

  return (
    <div className={styles.canvas} ref={wrapRef}>
      <div className={styles.toolbar}>
        <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAdding(true)}>안건 추가</Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <TitleDescModal
        open={adding} onClose={() => setAdding(false)} entityLabel="안건" busy={addSubPlanM.isPending}
        onSubmit={(p) => addAtCenter(p, () => setAdding(false))}
      />
    </div>
  )
}
```

> **Type note:** `OnNodeDrag<SubPlanCanvasNodeType>` is React Flow's exported handler type; typing the `useCallback` with it gives `node` the right type without hand-annotating the (DOM) event. `useNodesState`/`useEdgesState` are generic — pass the node/edge type so `nodes`/`edges`/setters are typed.

- [ ] **Step 2: Verify the `nodes`/`edges` props are accepted (controlled flow)**

The D2 canvas was uncontrolled (`defaultNodes`). D3 is controlled (`nodes` + `onNodesChange`). Both are valid React Flow v12 modes; the change is intentional. No `useMemo` on the seed arrays — they feed the `useXState` initializer, read once.

- [ ] **Step 3: Update `PlanCanvas.module.css`** (add the toolbar; keep D2 rules)

Merge `position: relative` into the existing `.canvas` rule (don't duplicate the selector), and append the toolbar:

```css
/* (existing .canvas rule — add `position: relative;` to it) */

.toolbar {
  position: absolute;
  top: var(--sp-2, 8px);
  right: var(--sp-2, 8px);
  z-index: 5;
}
```

Keep the existing `.canvasEmpty` and `:global(.react-flow__pane)` / `:global(.react-flow__attribution)` overrides from D2 unchanged.

- [ ] **Step 4: Type-check + lint the decisions feature**

Run: `npx tsc --noEmit && npx eslint src/features/decisions/`
Expected: PASS (0 errors in decisions files).

- [ ] **Step 5: Commit**

```bash
git add src/features/decisions/PlanCanvas.tsx src/features/decisions/PlanCanvas.module.css
git commit -m "feat(decisions-fe): interactive canvas — drag persist, edges, create 안건 (D3)"
```

---


### Task 8: Wire the new `PlanCanvas` into `PlanDetail`

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`

`PlanCanvas` now takes the whole `tree` (not `subPlans`) and owns its own add-안건 modal. Update the call site.

- [ ] **Step 1: Update the canvas render**

In `PlanDetail.tsx`, change the canvas branch from:

```tsx
          {view === 'canvas' ? (
            <PlanCanvas subPlans={tree.subPlans} />
          ) : (
```

to:

```tsx
          {view === 'canvas' ? (
            <PlanCanvas tree={tree} />
          ) : (
```

(No other change — the 목록 branch, all modals, and mutations are unchanged. The list-view add-안건 still uses `useAddSubPlan(planId)`; the canvas owns its own creation path via `useAddSubPlanOnCanvas`.)

- [ ] **Step 2: Type-check, lint, build**

Run: `npx tsc --noEmit && npx eslint src/features/decisions/ && npm run build`
Expected: tsc PASS; eslint 0 errors in decisions; `npm run build` succeeds.

> Note: the repo has ~24 **pre-existing** eslint errors in untouched calc/notes/sheets files (newer react-hooks rules) — out of scope, do not fix. Only `src/features/decisions/` must be clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions-fe): mount interactive PlanCanvas with full tree (D3)"
```

---

## Final verification (after all tasks)

- [ ] Backend: `./gradlew build` green (83 tests).
- [ ] Frontend: `npx tsc --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` succeeds.
- [ ] Manual smoke (optional, local): open a plan → 캔버스 tab → drag a node (reload: position persists) → drag from a node's right handle to another's left (edge appears) → click the edge → ✕ → delete → "안건 추가" spawns a node at center.
- [ ] Dispatch a final code-review over the whole `decisions-d3` diff (both repos).
- [ ] superpowers:finishing-a-development-branch.

## What this phase intentionally defers

- **D4** — workspace roadmap canvas (계획 nodes, lanes by `groupLabel`, drill-in, roll-up counts).
- **D5** — timeline/feed UI, empty states, mobile-read polish, light-theme React Flow controls.
- **Optimistic node drag while offline / multi-user live sync** — out of scope; positions are last-write-wins.
- **Cycle prevention (DAG)** — deliberately not enforced (brainstorm decision 3).
- **Bulk position save endpoint** — per-node debounced PATCH is enough at this scale (spec §10).
```
