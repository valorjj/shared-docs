# Decisions D1b — Ratings, Decisions, Timeline/Feed (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Decisions backend by adding 평가(OptionRating) and 결정(Decision) write paths, the DECISION_* audit events, the per-계획 timeline + workspace decision-feed reads, and the read-side aggregation that fills the neutral DTO fields D1a stubbed (avgScore / ratingCount / ratings / decision / decidedCount).

**Architecture:** Layered Spring Boot (Controller → Service → Repository → JPA entity), reference-by-id FKs, RFC 7807 errors via `ApiException`, append-only `PlanEvent` audit log. Two new entities (`OptionRating`, `Decision`) and three new focused services (`RatingService`, `DecisionService`, `TimelineService`) sit beside the existing `PlanService`, which keeps ownership of plan-tree assembly and gains the ratings/decisions aggregation + correct delete-tree cascades. **No new migration** — V15 already created the `option_ratings` and `decisions` tables.

**Tech Stack:** Spring Boot 3.5.3, Kotlin 1.9.25, JPA/Hibernate (`ddl-auto: validate`), MariaDB, Flyway (already at V15), Bean Validation, Jackson. Tests: JUnit5 + `@SpringBootTest @ActiveProfiles("test") @Transactional` against `shared_docs_test`.

**Conventions reused verbatim from D1a (`com.shareddocs.backend.decision`):**
- Entities extend `BaseEntity` (id / createdAt / updatedAt / `@Version`). `@Column` names must match the V15 columns exactly. Mutable fields are `var`, immutable are `val` with `updatable = false`.
- Workspace scoping: every lookup goes through a `findByIdAndWorkspaceId`-style query so a foreign id yields a typed 404 (the `WorkspaceContextFilter` already proved membership before the controller runs; the service double-scopes by `workspaceId`).
- Controllers take `@CurrentWorkspace ws: Workspace` (use `ws.id!!`) and `@AuthenticationPrincipal me: AppPrincipal` (use `me.userId`). Bodies validated with `@Valid`.
- Audit events written **in the same transaction** as the mutation via the injected `PlanEventRecorder`.
- Tests seed via `WorkspaceService.create(ownerUserId, name, slug)` + `UserRepository.save(User(...))`, exactly like `OptionServiceTest`.

**Deviation from design spec §7 (intentional, documented here):** score-range enforcement uses Bean Validation `@field:Min(1) @field:Max(5)` on `RateOptionRequest` (→ automatic 400), matching the established `@field:Size` pattern on the other request DTOs, instead of a custom `RatingOutOfRange` exception. One fewer hand-rolled exception, same HTTP semantics.

**Carried D1a cleanups resolved in this plan:**
- `PlanService.getById` is used only by tests → **dropped** (Task 7); the two referencing tests switch to `getTree`.
- `PlanService.list` N+1 → replaced with bulk loads when computing `decidedCount` (Task 7).
- D1a's stub fields (`avgScore`/`ratingCount`/`ratings`/`decision`/`decidedCount`) get populated (Tasks 6–7).
- `SubPlanRepository.existsByPlanId` stays (still unused; harmless, leave as-is — not in scope).

---

## File Structure

**Create (main):**
- `decision/OptionRating.kt` — 평가 entity
- `decision/Decision.kt` — 결정 entity
- `decision/OptionRatingRepository.kt`
- `decision/DecisionRepository.kt`
- `decision/RatingService.kt` — upsert/delete a member's rating
- `decision/DecisionService.kt` — lock/reopen with supersession + DECISION_* events
- `decision/TimelineService.kt` — timeline + feed reads (payload JSON → map)
- `decision/RatingController.kt` — `PUT/DELETE /api/options/{id}/rating`
- `decision/DecisionController.kt` — `POST /api/subplans/{id}/decision` + `/reopen`
- `decision/TimelineController.kt` — `GET /api/plans/{id}/timeline` + `GET /api/decision-feed`

**Modify (main):**
- `decision/DecisionExceptions.kt` — add `NoActiveDecisionException` (409), `OptionInUseException` (409)
- `decision/DecisionDto.kt` — add `RateOptionRequest`, `LockDecisionRequest`
- `decision/SubPlanRepository.kt` — add `findAllByPlanIdIn`
- `decision/PlanService.kt` — aggregate ratings/decisions in `getTree`; `decidedCount` in `list`; fix delete-tree cascades; guard `deleteOption`; **drop `getById`**

**Create (test):**
- `decision/RatingServiceTest.kt`
- `decision/DecisionServiceTest.kt`
- `decision/DecisionAggregationTest.kt` — getTree ratings + list decidedCount + delete cascades
- `decision/TimelineServiceTest.kt`

**Modify (test):**
- `decision/PlanServiceTest.kt` — remove the `getById` test; switch the `delete` test's post-delete assertion to `getTree`

---

## Task 1: OptionRating entity + repository

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/OptionRating.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/OptionRatingRepository.kt`

- [ ] **Step 1: Write the entity**

`OptionRating.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/**
 * 평가 — one member's 1–5 score (+ optional comment) on a 선택지. Unique per
 * (option, user): a member edits their own rating in place (upsert). The aggregate
 * average is computed on read, never stored.
 */
@Entity
@Table(
    name = "option_ratings",
    uniqueConstraints = [
        UniqueConstraint(name = "uq_option_ratings_option_user", columnNames = ["option_id", "user_id"]),
    ],
    indexes = [Index(name = "idx_option_ratings_option", columnList = "option_id")],
)
class OptionRating(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "option_id", nullable = false, updatable = false)
    val optionId: Long,

    @Column(name = "user_id", nullable = false, updatable = false)
    val userId: Long,

    @Column(nullable = false)
    var score: Int,

    @Column(columnDefinition = "text")
    var comment: String? = null,
) : BaseEntity()
```

- [ ] **Step 2: Write the repository**

`OptionRatingRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface OptionRatingRepository : JpaRepository<OptionRating, Long> {

    /** The current user's existing rating on an option, for upsert. */
    fun findByOptionIdAndUserId(optionId: Long, userId: Long): OptionRating?

    /** Bulk-load all ratings for a plan's options (tree aggregation, no N+1). */
    fun findAllByOptionIdIn(optionIds: Collection<Long>): List<OptionRating>
}
```

- [ ] **Step 3: Compile to verify mapping matches V15**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL. (Full Hibernate `validate` against the schema runs in Task 9's test pass; compiling here catches type errors early.)

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/OptionRating.kt \
        src/main/kotlin/com/shareddocs/backend/decision/OptionRatingRepository.kt
git commit -m "feat(decisions): OptionRating entity + repository (D1b)"
```

---

## Task 2: Decision entity + repository

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/Decision.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionRepository.kt`

- [ ] **Step 1: Write the entity**

`Decision.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

/**
 * 결정 — locks a chosen 선택지 on a 안건 with the reason and who/when. Re-deciding
 * inserts a NEW row and stamps `supersededAt` on the prior one; the current decision
 * for a 안건 is the latest row with supersededAt = null. Reopening just stamps
 * supersededAt on the current row. Full "we changed our mind" history is preserved
 * (append-only rows). decidedAt for the API = createdAt (BaseEntity).
 */
@Entity
@Table(
    name = "decisions",
    indexes = [
        Index(name = "idx_decisions_sub_plan", columnList = "sub_plan_id"),
        Index(name = "idx_decisions_workspace", columnList = "workspace_id"),
    ],
)
class Decision(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "sub_plan_id", nullable = false, updatable = false)
    val subPlanId: Long,

    @Column(name = "chosen_option_id", nullable = false, updatable = false)
    val chosenOptionId: Long,

    @Column(columnDefinition = "text", nullable = false, updatable = false)
    val reason: String,

    @Column(name = "decided_by_user_id", nullable = false, updatable = false)
    val decidedByUserId: Long,

    /** Null while this is the active decision; stamped when superseded or reopened. */
    @Column(name = "superseded_at")
    var supersededAt: Instant? = null,
) : BaseEntity()
```

- [ ] **Step 2: Write the repository**

`DecisionRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface DecisionRepository : JpaRepository<Decision, Long> {

    /** The active decision for a 안건 (null if none / reopened). */
    fun findFirstBySubPlanIdAndSupersededAtIsNull(subPlanId: Long): Decision?

    /** Active decisions across many 안건 — tree + roadmap roll-up, no N+1. */
    fun findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds: Collection<Long>): List<Decision>

    /** Every decision row for one 안건 (delete-tree). */
    fun findAllBySubPlanId(subPlanId: Long): List<Decision>

    /** Every decision row across many 안건 (plan delete-tree). */
    fun findAllBySubPlanIdIn(subPlanIds: Collection<Long>): List<Decision>

    /** Guard: a 선택지 referenced by any decision (active or historical) can't be deleted. */
    fun existsByChosenOptionId(chosenOptionId: Long): Boolean
}
```

- [ ] **Step 3: Compile**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/Decision.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionRepository.kt
git commit -m "feat(decisions): Decision entity + repository (D1b)"
```

---

## Task 3: New exceptions + request DTOs

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`

- [ ] **Step 1: Append the two new exceptions**

Add to the end of `DecisionExceptions.kt` (after `OptionNotInSubPlanException`):

```kotlin
/** Reopen was requested on a 안건 that has no active 결정. */
class NoActiveDecisionException :
    ApiException(HttpStatus.CONFLICT, "no-active-decision", "No active decision", "다시 열 결정이 없어요.")

/** A 선택지 referenced by a 결정 can't be deleted (would orphan decision history). */
class OptionInUseException :
    ApiException(HttpStatus.CONFLICT, "option-in-use", "Option in use", "결정에 사용된 선택지는 삭제할 수 없어요.")
```

- [ ] **Step 2: Add the request DTOs**

In `DecisionDto.kt`, add these imports next to the existing validation imports at the top:

```kotlin
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
```

Then add to the `// ── Requests ──` section (after `UpdateOptionRequest`):

```kotlin
/** Upsert the current member's 평가 on a 선택지. Range enforced by Bean Validation → 400. */
data class RateOptionRequest(
    @field:Min(1) @field:Max(5) val score: Int,
    @field:Size(max = 2000) val comment: String? = null,
)

/** Lock a 결정 on a 안건. `chosenOptionId` must belong to that 안건 (else 400). */
data class LockDecisionRequest(
    val chosenOptionId: Long,
    @field:NotBlank @field:Size(max = 2000) val reason: String,
)
```

(The response DTOs `RatingResponse`, `DecisionResponse`, `PlanEventResponse` already exist from D1a — do not redefine them.)

- [ ] **Step 3: Compile**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt
git commit -m "feat(decisions): rating/decision request DTOs + 409 exceptions (D1b)"
```

---

## Task 4: RatingService (upsert + delete)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/RatingService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/RatingServiceTest.kt`

- [ ] **Step 1: Write the failing test**

`RatingServiceTest.kt`:

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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RatingServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val ratings: RatingService,
    @Autowired private val ratingRepository: OptionRatingRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    /** Returns (workspaceId, optionId, userId). */
    private fun seedOption(): Triple<Long, Long, Long> {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val opt = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        return Triple(ws.id!!, opt.id, owner.id!!)
    }

    @Test
    fun `upsert inserts then updates the same row in place`() {
        val (wsId, optionId, userId) = seedOption()

        ratings.upsert(wsId, optionId, userId, RateOptionRequest(score = 4, comment = "좋아요"))
        val after1 = ratingRepository.findAllByOptionIdIn(listOf(optionId))
        assertEquals(1, after1.size)
        assertEquals(4, after1[0].score)

        val updated = ratings.upsert(wsId, optionId, userId, RateOptionRequest(score = 2, comment = null))
        val after2 = ratingRepository.findAllByOptionIdIn(listOf(optionId))
        assertEquals(1, after2.size)          // still one row (upsert, not insert)
        assertEquals(2, updated.score)
        assertNull(updated.comment)
    }

    @Test
    fun `upsert 404s for an option in another workspace`() {
        val (_, optionId, userId) = seedOption()
        val other = newUser()
        val wsOther = workspaces.create(other.id!!, "O", "o")
        assertThrows(OptionNotFoundException::class.java) {
            ratings.upsert(wsOther.id!!, optionId, userId, RateOptionRequest(score = 3))
        }
    }

    @Test
    fun `delete removes the rating and is a no-op when none exists`() {
        val (wsId, optionId, userId) = seedOption()
        ratings.upsert(wsId, optionId, userId, RateOptionRequest(score = 5))

        ratings.delete(wsId, optionId, userId)
        assertEquals(0, ratingRepository.findAllByOptionIdIn(listOf(optionId)).size)

        ratings.delete(wsId, optionId, userId) // idempotent — must not throw
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.RatingServiceTest"`
Expected: FAIL to compile (`RatingService` unresolved).

- [ ] **Step 3: Write the service**

`RatingService.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 평가 writes. A member upserts their own 1–5 rating on a 선택지 (unique per
 * option+user); deleting is idempotent. Ratings are LIVE STATE, not timeline
 * events — no PlanEvent is recorded (design decision #4). Aggregates are computed
 * on read in [PlanService.getTree]. Score range is enforced upstream by Bean
 * Validation on [RateOptionRequest].
 */
@Service
@Transactional
class RatingService(
    private val optionRepository: OptionRepository,
    private val optionRatingRepository: OptionRatingRepository,
) {
    fun upsert(workspaceId: Long, optionId: Long, userId: Long, request: RateOptionRequest): RatingResponse {
        requireOption(workspaceId, optionId)
        val existing = optionRatingRepository.findByOptionIdAndUserId(optionId, userId)
        val rating = if (existing != null) {
            existing.score = request.score
            existing.comment = request.comment?.trim()
            existing
        } else {
            optionRatingRepository.save(
                OptionRating(
                    workspaceId = workspaceId,
                    optionId = optionId,
                    userId = userId,
                    score = request.score,
                    comment = request.comment?.trim(),
                ),
            )
        }
        return RatingResponse(userId = rating.userId, score = rating.score, comment = rating.comment)
    }

    /** Idempotent — removing a non-existent rating is a no-op (caller still returns 204). */
    fun delete(workspaceId: Long, optionId: Long, userId: Long) {
        requireOption(workspaceId, optionId)
        optionRatingRepository.findByOptionIdAndUserId(optionId, userId)
            ?.let { optionRatingRepository.delete(it) }
    }

    private fun requireOption(workspaceId: Long, optionId: Long): Option =
        optionRepository.findByIdAndWorkspaceId(optionId, workspaceId) ?: throw OptionNotFoundException()
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.RatingServiceTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/RatingService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/RatingServiceTest.kt
git commit -m "feat(decisions): RatingService upsert/delete + tests (D1b)"
```

---

## Task 5: DecisionService (lock + reopen + supersession)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/DecisionServiceTest.kt`

- [ ] **Step 1: Write the failing test**

`DecisionServiceTest.kt`:

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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DecisionServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val decisions: DecisionService,
    @Autowired private val decisionRepository: DecisionRepository,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    /** Returns (workspaceId, subPlanId, optionA.id, optionB.id, userId). */
    private data class Seed(val wsId: Long, val subPlanId: Long, val optA: Long, val optB: Long, val user: Long)

    private fun seed(): Seed {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val a = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        val b = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "판교"))
        return Seed(ws.id!!, sp.id, a.id, b.id, owner.id!!)
    }

    @Test
    fun `lock creates the active decision and records DECISION_LOCKED`() {
        val s = seed()
        val d = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(s.optA, reason = "교통"))

        assertEquals(s.optA, d.chosenOptionId)
        assertEquals("교통", d.reason)
        val active = decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(s.subPlanId)
        assertEquals(d.id, active?.id)
        assertEquals(PlanEventType.DECISION_LOCKED, events.findAll().sortedByDescending { it.id }.first().type)
    }

    @Test
    fun `re-lock supersedes the prior decision and records DECISION_CHANGED`() {
        val s = seed()
        val first = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(s.optA, reason = "처음"))
        val second = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(s.optB, reason = "변경"))

        // exactly one active, and it's the new one
        val active = decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(s.subPlanId)
        assertEquals(second.id, active?.id)
        assertEquals(s.optB, active?.chosenOptionId)
        // prior row is superseded, history preserved (2 rows total for this 안건)
        assertEquals(2, decisionRepository.findAllBySubPlanId(s.subPlanId).size)
        val prior = decisionRepository.findAllBySubPlanId(s.subPlanId).first { it.id == first.id }
        assert(prior.supersededAt != null)
        assertEquals(PlanEventType.DECISION_CHANGED, events.findAll().sortedByDescending { it.id }.first().type)
    }

    @Test
    fun `reopen clears the active decision and records DECISION_REOPENED`() {
        val s = seed()
        decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(s.optA, reason = "r"))

        decisions.reopen(s.wsId, s.subPlanId, s.user)

        assertNull(decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(s.subPlanId))
        assertEquals(PlanEventType.DECISION_REOPENED, events.findAll().sortedByDescending { it.id }.first().type)
    }

    @Test
    fun `reopen with no active decision throws NoActiveDecisionException`() {
        val s = seed()
        assertThrows(NoActiveDecisionException::class.java) {
            decisions.reopen(s.wsId, s.subPlanId, s.user)
        }
    }

    @Test
    fun `lock with an option from another sub-plan throws OptionNotInSubPlanException`() {
        val s = seed()
        // an option under a different 안건 of the same plan
        val plan2sp = plans.addSubPlan(s.wsId, plans.create(s.wsId, s.user, CreatePlanRequest(title = "P2")).id, s.user, CreateSubPlanRequest(title = "다른"))
        val foreignOpt = plans.addOption(s.wsId, plan2sp.id, s.user, CreateOptionRequest(title = "x"))
        assertThrows(OptionNotInSubPlanException::class.java) {
            decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(foreignOpt.id, reason = "r"))
        }
    }

    @Test
    fun `lock 404s for a sub-plan in another workspace`() {
        val s = seed()
        val other = newUser()
        val wsOther = workspaces.create(other.id!!, "O", "o")
        assertThrows(SubPlanNotFoundException::class.java) {
            decisions.lock(wsOther.id!!, s.subPlanId, s.user, LockDecisionRequest(s.optA, reason = "r"))
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionServiceTest"`
Expected: FAIL to compile (`DecisionService` unresolved).

- [ ] **Step 3: Write the service**

`DecisionService.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 결정 lifecycle. Locking inserts a new decision row and supersedes any current one
 * (first lock = DECISION_LOCKED, re-lock = DECISION_CHANGED). Reopening stamps
 * supersededAt on the current row (DECISION_REOPENED). Any member may do either
 * (soft lock, design decision #3); every transition appends a PlanEvent in the same
 * transaction. The chosen 선택지 must belong to the 안건 (else 400). The full chain of
 * superseded rows is the "we changed our mind" history.
 */
@Service
@Transactional
class DecisionService(
    private val subPlanRepository: SubPlanRepository,
    private val optionRepository: OptionRepository,
    private val decisionRepository: DecisionRepository,
    private val events: PlanEventRecorder,
) {
    fun lock(workspaceId: Long, subPlanId: Long, actorUserId: Long, request: LockDecisionRequest): DecisionResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        val option = optionRepository.findByIdAndWorkspaceId(request.chosenOptionId, workspaceId)
            ?: throw OptionNotFoundException()
        if (option.subPlanId != subPlanId) throw OptionNotInSubPlanException()

        val current = decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(subPlanId)
        val isChange = current != null
        current?.let { it.supersededAt = Instant.now() }

        val decision = decisionRepository.save(
            Decision(
                workspaceId = workspaceId,
                subPlanId = subPlanId,
                chosenOptionId = option.id!!,
                reason = request.reason.trim(),
                decidedByUserId = actorUserId,
            ),
        )
        events.record(
            workspaceId = workspaceId,
            planId = subPlan.planId,
            subPlanId = subPlanId,
            type = if (isChange) PlanEventType.DECISION_CHANGED else PlanEventType.DECISION_LOCKED,
            actorUserId = actorUserId,
            payload = mapOf("optionTitle" to option.title, "reason" to decision.reason),
        )
        return decision.toResponse()
    }

    fun reopen(workspaceId: Long, subPlanId: Long, actorUserId: Long) {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        val current = decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(subPlanId)
            ?: throw NoActiveDecisionException()
        current.supersededAt = Instant.now()
        events.record(
            workspaceId = workspaceId,
            planId = subPlan.planId,
            subPlanId = subPlanId,
            type = PlanEventType.DECISION_REOPENED,
            actorUserId = actorUserId,
            payload = mapOf("subPlanTitle" to subPlan.title),
        )
    }

    private fun requireSubPlan(workspaceId: Long, subPlanId: Long): SubPlan =
        subPlanRepository.findByIdAndWorkspaceId(subPlanId, workspaceId) ?: throw SubPlanNotFoundException()

    private fun Decision.toResponse() = DecisionResponse(
        id = id!!,
        chosenOptionId = chosenOptionId,
        reason = reason,
        decidedByUserId = decidedByUserId,
        decidedAt = createdAt!!,
    )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionServiceTest"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/DecisionServiceTest.kt
git commit -m "feat(decisions): DecisionService lock/reopen with supersession + events (D1b)"
```

---

## Task 6: SubPlanRepository bulk query (prep for aggregation)

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanRepository.kt`

- [ ] **Step 1: Add the bulk finder**

Add this method inside the `SubPlanRepository` interface (after `existsByPlanId`):

```kotlin
    /** All 안건 for several 계획 at once — roadmap roll-up without N+1. */
    fun findAllByPlanIdIn(planIds: Collection<Long>): List<SubPlan>
```

- [ ] **Step 2: Compile**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/SubPlanRepository.kt
git commit -m "feat(decisions): SubPlanRepository.findAllByPlanIdIn for roll-up (D1b)"
```

---

## Task 7: PlanService aggregation + delete-tree cascades + drop getById

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/DecisionAggregationTest.kt`

This task makes `PlanService` depend on `OptionRatingRepository` and `DecisionRepository`, populates the D1a stub fields, replaces `list`'s N+1, fixes the delete-tree cascades (ratings/decisions are RESTRICT FKs that must be deleted before options/sub_plans), guards `deleteOption`, and removes the now-unused `getById`.

- [ ] **Step 1: Write the failing aggregation test**

`DecisionAggregationTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
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
class DecisionAggregationTest(
    @Autowired private val plans: PlanService,
    @Autowired private val ratings: RatingService,
    @Autowired private val decisions: DecisionService,
    @Autowired private val ratingRepository: OptionRatingRepository,
    @Autowired private val decisionRepository: DecisionRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `getTree aggregates ratings into avgScore, ratingCount and ratings list`() {
        val u1 = newUser()
        val u2 = newUser()
        val ws = workspaces.create(u1.id!!, "W", "w")
        val plan = plans.create(ws.id!!, u1.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, u1.id!!, CreateSubPlanRequest(title = "동네"))
        val opt = plans.addOption(ws.id!!, sp.id, u1.id!!, CreateOptionRequest(title = "마포"))
        ratings.upsert(ws.id!!, opt.id, u1.id!!, RateOptionRequest(score = 4))
        ratings.upsert(ws.id!!, opt.id, u2.id!!, RateOptionRequest(score = 2, comment = "별로"))

        val node = plans.getTree(ws.id!!, plan.id).subPlans.first { it.id == sp.id }
        val optResp = node.options.first { it.id == opt.id }
        assertEquals(3.0, optResp.avgScore)     // (4 + 2) / 2
        assertEquals(2, optResp.ratingCount)
        assertEquals(2, optResp.ratings.size)
    }

    @Test
    fun `getTree surfaces the active decision and marks the 안건 DECIDED`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val opt = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        decisions.lock(ws.id!!, sp.id, owner.id!!, LockDecisionRequest(opt.id, reason = "교통"))

        val node = plans.getTree(ws.id!!, plan.id).subPlans.first { it.id == sp.id }
        assertEquals(SubPlanStatus.DECIDED, node.status)
        assertNotNull(node.decision)
        assertEquals(opt.id, node.decision!!.chosenOptionId)
    }

    @Test
    fun `list reports decidedCount per plan`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val decided = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산")) // undecided
        val opt = plans.addOption(ws.id!!, decided.id, owner.id!!, CreateOptionRequest(title = "마포"))
        decisions.lock(ws.id!!, decided.id, owner.id!!, LockDecisionRequest(opt.id, reason = "r"))

        val summary = plans.list(ws.id!!).first { it.id == plan.id }
        assertEquals(2, summary.subPlanCount)
        assertEquals(1, summary.decidedCount)
    }

    @Test
    fun `deleteOption is blocked while a decision references it, allowed otherwise`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val chosen = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        val other = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "판교"))
        ratings.upsert(ws.id!!, other.id, owner.id!!, RateOptionRequest(score = 3)) // has a rating
        decisions.lock(ws.id!!, sp.id, owner.id!!, LockDecisionRequest(chosen.id, reason = "r"))

        assertThrows(OptionInUseException::class.java) { plans.deleteOption(ws.id!!, chosen.id) }

        // 'other' is rated but not decided → deletes, taking its rating with it
        plans.deleteOption(ws.id!!, other.id)
        assertTrue(ratingRepository.findAllByOptionIdIn(listOf(other.id)).isEmpty())
    }

    @Test
    fun `delete plan cascades through decisions and ratings`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val opt = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        ratings.upsert(ws.id!!, opt.id, owner.id!!, RateOptionRequest(score = 5))
        decisions.lock(ws.id!!, sp.id, owner.id!!, LockDecisionRequest(opt.id, reason = "r"))

        plans.delete(ws.id!!, plan.id) // must not throw on RESTRICT FKs

        assertThrows(PlanNotFoundException::class.java) { plans.getTree(ws.id!!, plan.id) }
        assertTrue(ratingRepository.findAllByOptionIdIn(listOf(opt.id)).isEmpty())
        assertTrue(decisionRepository.findAllBySubPlanId(sp.id).isEmpty())
    }

    @Test
    fun `deleteSubPlan cascades through its decisions and ratings`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val opt = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        ratings.upsert(ws.id!!, opt.id, owner.id!!, RateOptionRequest(score = 5))
        decisions.lock(ws.id!!, sp.id, owner.id!!, LockDecisionRequest(opt.id, reason = "r"))

        plans.deleteSubPlan(ws.id!!, sp.id) // must not throw

        assertTrue(plans.getTree(ws.id!!, plan.id).subPlans.isEmpty())
        assertTrue(ratingRepository.findAllByOptionIdIn(listOf(opt.id)).isEmpty())
        assertTrue(decisionRepository.findAllBySubPlanId(sp.id).isEmpty())
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionAggregationTest"`
Expected: FAIL — `avgScore` is null / `decidedCount` is 0 / `deleteOption` does not throw / delete may hit a constraint violation (D1a behavior).

- [ ] **Step 3: Update PlanService — constructor + getTree**

In `PlanService.kt`, add the two repositories to the constructor:

```kotlin
@Service
@Transactional
class PlanService(
    private val planRepository: PlanRepository,
    private val subPlanRepository: SubPlanRepository,
    private val optionRepository: OptionRepository,
    private val planEventRepository: PlanEventRepository,
    private val optionRatingRepository: OptionRatingRepository,
    private val decisionRepository: DecisionRepository,
    private val events: PlanEventRecorder,
) {
```

Replace the whole `getTree` function with:

```kotlin
    @Transactional(readOnly = true)
    fun getTree(workspaceId: Long, planId: Long): PlanTreeResponse {
        val plan = requirePlan(workspaceId, planId)
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        val subPlanIds = subPlans.mapNotNull { it.id }
        val options = if (subPlanIds.isEmpty()) {
            emptyList()
        } else {
            optionRepository.findAllBySubPlanIdInOrderBySortOrderAscIdAsc(subPlanIds)
        }
        val optionsBySubPlan = options.groupBy { it.subPlanId }
        val optionIds = options.mapNotNull { it.id }
        // Bulk-load ratings + active decisions for the whole plan — no N+1.
        val ratingsByOption = if (optionIds.isEmpty()) {
            emptyMap()
        } else {
            optionRatingRepository.findAllByOptionIdIn(optionIds).groupBy { it.optionId }
        }
        val decisionBySubPlan = if (subPlanIds.isEmpty()) {
            emptyMap()
        } else {
            decisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds).associateBy { it.subPlanId }
        }
        val subPlanResponses = subPlans.map { sp ->
            val opts = (optionsBySubPlan[sp.id] ?: emptyList())
                .map { it.toResponse(ratingsByOption[it.id] ?: emptyList()) }
            sp.toResponse(options = opts, decision = decisionBySubPlan[sp.id]?.toResponse())
        }
        return PlanTreeResponse(
            id = plan.id!!,
            title = plan.title,
            description = plan.description,
            status = plan.status,
            canvasX = plan.canvasX,
            canvasY = plan.canvasY,
            groupLabel = plan.groupLabel,
            createdByUserId = plan.createdByUserId,
            createdAt = plan.createdAt!!,
            subPlans = subPlanResponses,
        )
    }
```

- [ ] **Step 4: Update PlanService — replace `list`, delete `getById`**

Replace the whole `list` function with the bulk version (no N+1):

```kotlin
    @Transactional(readOnly = true)
    fun list(workspaceId: Long): List<PlanSummaryResponse> {
        val plans = planRepository.findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId)
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

Then **delete the entire `getById` function** (the `@Transactional(readOnly = true) fun getById(...)` block) — it is unused by any controller and its only callers (tests) are updated in Step 7.

- [ ] **Step 5: Update PlanService — delete-tree cascades + deleteOption guard**

Replace the whole `delete` function with:

```kotlin
    /**
     * Hard-delete the whole tree. FK constraints are ON DELETE RESTRICT, so remove
     * references deepest-first: decisions (→ options, sub_plans) and ratings (→ options)
     * before options, then events, sub_plans, and finally the plan.
     */
    fun delete(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        val subPlanIds = subPlans.mapNotNull { it.id }
        val options = if (subPlanIds.isEmpty()) {
            emptyList()
        } else {
            optionRepository.findAllBySubPlanIdInOrderBySortOrderAscIdAsc(subPlanIds)
        }
        val optionIds = options.mapNotNull { it.id }
        if (subPlanIds.isNotEmpty()) {
            decisionRepository.deleteAll(decisionRepository.findAllBySubPlanIdIn(subPlanIds))
        }
        if (optionIds.isNotEmpty()) {
            optionRatingRepository.deleteAll(optionRatingRepository.findAllByOptionIdIn(optionIds))
        }
        optionRepository.deleteAll(options)
        planEventRepository.deleteAll(planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(planId))
        subPlanRepository.deleteAll(subPlans)
        planRepository.delete(plan)
    }
```

Replace the whole `deleteSubPlan` function with:

```kotlin
    fun deleteSubPlan(workspaceId: Long, subPlanId: Long) {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        val options = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId)
        val optionIds = options.mapNotNull { it.id }
        decisionRepository.deleteAll(decisionRepository.findAllBySubPlanId(subPlanId))
        if (optionIds.isNotEmpty()) {
            optionRatingRepository.deleteAll(optionRatingRepository.findAllByOptionIdIn(optionIds))
        }
        optionRepository.deleteAll(options)
        subPlanRepository.delete(subPlan)
    }
```

Replace the whole `deleteOption` function with:

```kotlin
    fun deleteOption(workspaceId: Long, optionId: Long) {
        val option = requireOption(workspaceId, optionId)
        // A decision (active or superseded) points at this option via RESTRICT FK —
        // deleting would orphan decision history, so refuse.
        if (decisionRepository.existsByChosenOptionId(optionId)) throw OptionInUseException()
        optionRatingRepository.deleteAll(optionRatingRepository.findAllByOptionIdIn(listOf(optionId)))
        optionRepository.delete(option)
    }
```

- [ ] **Step 6: Update PlanService — the Option mapper**

Replace the existing private `Option.toResponse()` mapper with a ratings-aware version (default arg keeps the write-path call sites — `addOption`/`updateOption`/`updateSubPlan` — returning neutral rating fields; those are write echoes, and `getTree` is the single source of aggregated truth):

```kotlin
    private fun Option.toResponse(ratings: List<OptionRating> = emptyList()): OptionResponse {
        val scores = ratings.map { it.score }
        return OptionResponse(
            id = id!!,
            title = title,
            description = description,
            sortOrder = sortOrder,
            avgScore = if (scores.isEmpty()) null else scores.average(),
            ratingCount = scores.size,
            ratings = ratings.map { RatingResponse(userId = it.userId, score = it.score, comment = it.comment) },
        )
    }
```

(Leave the `DecisionResponse?` parameter threading in `SubPlan.toResponse` and the `subPlanStatus` helper exactly as they are — they already handle a non-null decision → `DECIDED`.)

- [ ] **Step 7: Update PlanServiceTest for the dropped getById**

In `PlanServiceTest.kt`:

1. **Remove** the entire test `fun \`getById returns the plan, or 404 for a foreign workspace id\`()` (lines covering that test).
2. In `fun \`delete removes the plan and is 404 afterwards\`()`, replace the post-delete assertion that calls `service.getById(...)` with `service.getTree(...)`:

```kotlin
        service.delete(ws.id!!, plan.id)

        assertThrows(PlanNotFoundException::class.java) {
            service.getTree(ws.id!!, plan.id)
        }
        assertTrue(service.list(ws.id!!).isEmpty())
```

(The foreign-workspace 404 case is already covered by `PlanTreeTest.\`getTree 404s for a foreign workspace\``, so no coverage is lost.)

- [ ] **Step 8: Run the affected tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionAggregationTest" --tests "com.shareddocs.backend.decision.PlanServiceTest" --tests "com.shareddocs.backend.decision.PlanTreeTest" --tests "com.shareddocs.backend.decision.SubPlanServiceTest" --tests "com.shareddocs.backend.decision.OptionServiceTest"`
Expected: PASS (all decision service/aggregation tests green; no regressions).

- [ ] **Step 9: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt \
        src/test/kotlin/com/shareddocs/backend/decision/DecisionAggregationTest.kt
git commit -m "feat(decisions): aggregate ratings/decisions + cascade deletes, drop getById (D1b)"
```

---

## Task 8: TimelineService (timeline + feed)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/TimelineService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/TimelineServiceTest.kt`

- [ ] **Step 1: Write the failing test**

`TimelineServiceTest.kt`:

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
class TimelineServiceTest(
    @Autowired private val plans: PlanService,
    @Autowired private val decisions: DecisionService,
    @Autowired private val timeline: TimelineService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `timeline returns this plan's events newest-first with a parsed payload`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = plans.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val opt = plans.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "마포"))
        decisions.lock(ws.id!!, sp.id, owner.id!!, LockDecisionRequest(opt.id, reason = "교통"))

        val events = timeline.timeline(ws.id!!, plan.id)

        // newest-first: DECISION_LOCKED, OPTION_ADDED, SUBPLAN_ADDED, PLAN_CREATED
        assertEquals(PlanEventType.DECISION_LOCKED, events.first().type)
        assertEquals(PlanEventType.PLAN_CREATED, events.last().type)
        // the decision event's payload was JSON-serialized then parsed back to a map
        assertEquals("교통", events.first().payload?.get("reason"))
    }

    @Test
    fun `timeline 404s for a plan in another workspace`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        val plan = plans.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        assertThrows(PlanNotFoundException::class.java) { timeline.timeline(wsB.id!!, plan.id) }
    }

    @Test
    fun `feed returns workspace events newest-first within the limit`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val p1 = plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P1"))
        plans.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P2"))
        plans.addSubPlan(ws.id!!, p1.id, owner.id!!, CreateSubPlanRequest(title = "동네"))

        val all = timeline.feed(ws.id!!, 50)
        assertEquals(3, all.size) // 2x PLAN_CREATED + 1x SUBPLAN_ADDED
        assertEquals(PlanEventType.SUBPLAN_ADDED, all.first().type) // newest first

        val capped = timeline.feed(ws.id!!, 1)
        assertEquals(1, capped.size)
        assertTrue(all.map { it.id }.contains(capped.first().id))
    }

    @Test
    fun `feed scopes to the workspace`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        plans.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "A-plan"))

        assertTrue(timeline.feed(wsB.id!!, 50).isEmpty())
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.TimelineServiceTest"`
Expected: FAIL to compile (`TimelineService` unresolved).

- [ ] **Step 3: Write the service**

`TimelineService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Read side of the audit log. A 계획's timeline is its events newest-first; the
 * workspace feed is the same events across all 계획, capped. Both deserialize the
 * stored JSON payload back into a label map for the UI. The timeline scopes the
 * plan by workspace so a foreign plan id 404s; the feed is already workspace-scoped
 * by query (membership proven by the filter).
 */
@Service
@Transactional(readOnly = true)
class TimelineService(
    private val planRepository: PlanRepository,
    private val planEventRepository: PlanEventRepository,
    private val objectMapper: ObjectMapper,
) {
    fun timeline(workspaceId: Long, planId: Long): List<PlanEventResponse> {
        planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()
        return planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(planId).map { it.toResponse() }
    }

    fun feed(workspaceId: Long, limit: Int): List<PlanEventResponse> =
        planEventRepository
            .findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId, PageRequest.of(0, limit.coerceIn(1, 100)))
            .map { it.toResponse() }

    private fun PlanEvent.toResponse(): PlanEventResponse = PlanEventResponse(
        id = id!!,
        planId = planId,
        subPlanId = subPlanId,
        type = type,
        actorUserId = actorUserId,
        payload = payload?.let {
            @Suppress("UNCHECKED_CAST")
            objectMapper.readValue(it, Map::class.java) as Map<String, Any?>
        },
        createdAt = createdAt!!,
    )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.TimelineServiceTest"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/TimelineService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/TimelineServiceTest.kt
git commit -m "feat(decisions): TimelineService timeline + feed reads (D1b)"
```

---

## Task 9: Controllers (rating, decision, timeline) + final build

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/RatingController.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionController.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/TimelineController.kt`

(No controller tests — consistent with D1a, which tests at the service layer. The controllers are thin delegators.)

- [ ] **Step 1: Write RatingController**

`RatingController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 평가 endpoints — the current user's rating on a 선택지 (user implicit from principal). */
@RestController
@RequestMapping("/api/options/{optionId}/rating")
class RatingController(
    private val service: RatingService,
) {
    @PutMapping
    fun upsert(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable optionId: Long,
        @Valid @RequestBody request: RateOptionRequest,
    ): RatingResponse = service.upsert(ws.id!!, optionId, me.userId, request)

    @DeleteMapping
    fun delete(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable optionId: Long,
    ): ResponseEntity<Void> {
        service.delete(ws.id!!, optionId, me.userId)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 2: Write DecisionController**

`DecisionController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 결정 endpoints — lock (or re-lock, which supersedes) and reopen a 안건's decision. */
@RestController
@RequestMapping("/api/subplans/{subPlanId}/decision")
class DecisionController(
    private val service: DecisionService,
) {
    @PostMapping
    fun lock(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable subPlanId: Long,
        @Valid @RequestBody request: LockDecisionRequest,
    ): ResponseEntity<DecisionResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.lock(ws.id!!, subPlanId, me.userId, request))

    @PostMapping("/reopen")
    fun reopen(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable subPlanId: Long,
    ): ResponseEntity<Void> {
        service.reopen(ws.id!!, subPlanId, me.userId)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 3: Write TimelineController**

`TimelineController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** History reads — a 계획's timeline and the workspace-wide decision feed. */
@RestController
class TimelineController(
    private val service: TimelineService,
) {
    @GetMapping("/api/plans/{planId}/timeline")
    fun timeline(
        @CurrentWorkspace ws: Workspace,
        @PathVariable planId: Long,
    ): List<PlanEventResponse> = service.timeline(ws.id!!, planId)

    @GetMapping("/api/decision-feed")
    fun feed(
        @CurrentWorkspace ws: Workspace,
        @RequestParam(defaultValue = "50") limit: Int,
    ): List<PlanEventResponse> = service.feed(ws.id!!, limit)
}
```

- [ ] **Step 4: Full build + full test run**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL. All decision tests green (D1a's 15 + D1b's new ~19), Hibernate `validate` passes against V15 (entities map cleanly to `option_ratings` / `decisions`), no regressions across the whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/RatingController.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionController.kt \
        src/main/kotlin/com/shareddocs/backend/decision/TimelineController.kt
git commit -m "feat(decisions): rating/decision/timeline REST controllers (D1b)"
```

---

## Done criteria

- 평가 upsert/delete, 결정 lock/reopen (with supersession history + DECISION_* events), timeline + feed all work and are workspace-isolated (foreign ids 404; cross-workspace feed empty).
- `getTree` populates `avgScore`/`ratingCount`/`ratings`/`decision`, and marks decided 안건 `DECIDED`; `list` reports `decidedCount` without N+1.
- Delete-tree cascades through ratings + decisions; `deleteOption` refuses an option referenced by a decision (409).
- `getById` removed; no dead code introduced by this phase.
- `./gradlew build` green. No new migration (V15 already has the tables).

## After D1b

Next is **D1-frontend**: a plain (non-canvas) CRUD UI to exercise this model end-to-end (create 계획/안건/선택지, rate, lock/reopen, view timeline) before any React Flow canvas work (D2+). The API surface this phase exposes:

```
PUT    /api/options/{id}/rating          # upsert {score 1-5, comment?}
DELETE /api/options/{id}/rating
POST   /api/subplans/{id}/decision       # lock {chosenOptionId, reason}  (re-lock supersedes)
POST   /api/subplans/{id}/decision/reopen
GET    /api/plans/{id}/timeline
GET    /api/decision-feed?limit=50
```
