# Plan Discussion Surface + Vote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vote on 선택지 (one live, named vote per member per 안건, snapshotted onto the Decision at 확정), plus a split-view discussion surface on PlanDetail (lazy 1:1 note + comments) with entity-link chips extended to plan/안건/선택지.

**Architecture:** Two independently shippable parts. **Part 1 (Tasks 1–4):** `OptionVote` mirroring `OptionRating`, guarded by `PlanLockGuard` + a new decided-안건 guard; `DecisionService.lock` snapshots the tally into `decisions.vote_snapshot`; list-view vote UI + decide-modal pre-fill. **Part 2 (Tasks 5–8):** nullable `plans.discussion_note_id` with an idempotent lazy-create endpoint; `EntityKind` += plan/subplan/option through indexer + search; a responsive discussion pane reusing `NoteEditorBody` + `Comments`.

**Tech Stack:** Spring Boot 3.5 + Kotlin, JPA (`ddl-auto: validate`) + Flyway (MariaDB :3307), JUnit `@SpringBootTest`; React 19 + TS, React Query, Tiptap v3, `@xyflow/react`, lucide-react, CSS Modules.

**Design doc:** `docs/plans/2026-06-11-plan-discussion-vote-design.md`

**Repos & branches:** backend = `shared-docs-backend` (new branch `plan-discussion-vote`); frontend = `shared-docs` (existing branch `plan-discussion-vote`, already holds the design doc).

**Backend test prereq:** `test` profile runs against MariaDB `localhost:3307`, schema `shared_docs_test`; Flyway migrates on context start. Focused run: `./gradlew test --tests "com.shareddocs.backend.decision.VoteServiceTest"`.

**Frontend gates:** `npx tsc -b --noEmit` (MUST use `-b` — plain `tsc --noEmit` checks zero files), `npx eslint src/features/decisions/` (lint touched folders only; whole-tree is red with pre-existing debt), `npm run build` (authoritative).

**Ship points:** merge+push after Task 4 (deploys V20) and after Task 8 (deploys V21). CD applies Flyway on the prod runner; user confirms green (this `gh` can't see valorjj Actions).

**Deliberate deviations from the spec** (record here so review doesn't flag them as drift):
- Two Flyway migrations (V20 votes, V21 discussion note) instead of the spec's one — the parts ship separately.
- Canvas nodes show the vote tally **read-only**; casting happens in 목록. The canvas seeds React Flow state once and ignores refetches (D3 state model), so a live-mutating vote control there would display stale tallies.
- The 안건 footer button is the existing single decide button, relabeled **결과 확정하기** when votes exist (pre-selecting the leader) and **결정하기** otherwise — one button, per the one-primary rule, rather than a second button next to 결정하기.

---

## Part 1 — Vote (backend Tasks 1–3, frontend Task 4)

### Task 1: Backend — `OptionVote` entity, V20 migration, tree DTO exposure

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionVote.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionVoteRepository.kt`
- Create: `shared-docs-backend/src/main/resources/db/migration/V20__option_votes.sql`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/Decision.kt` (add `voteSnapshot`)
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (`OptionResponse.voterUserIds`, `DecisionResponse.voteSnapshot`)
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (tree aggregation + delete cascades + `toResponse` echoes)
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/VoteServiceTest.kt` (create; Task 1 exercises only the tree-shape tests — the rest compile against Task 2's API and go green there)

- [ ] **Step 1: Branch**

```bash
cd shared-docs-backend && git checkout main && git pull && git checkout -b plan-discussion-vote
```

- [ ] **Step 2: Entity + repository**

`OptionVote.kt` — mirrors `OptionRating`; `optionId` is `val` because a moved vote is delete+insert (the unique key is per-안건, not per-선택지):

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

@Entity
@Table(
    name = "option_votes",
    uniqueConstraints = [
        UniqueConstraint(name = "uq_option_votes_subplan_user", columnNames = ["sub_plan_id", "user_id"]),
    ],
    indexes = [Index(name = "idx_option_votes_option", columnList = "option_id")],
)
class OptionVote(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "sub_plan_id", nullable = false, updatable = false)
    val subPlanId: Long,

    @Column(name = "option_id", nullable = false, updatable = false)
    val optionId: Long,

    @Column(name = "user_id", nullable = false, updatable = false)
    val userId: Long,
) : BaseEntity()
```

`OptionVoteRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface OptionVoteRepository : JpaRepository<OptionVote, Long> {
    /** The member's current vote on an 안건 (unique by design), for cast/move/retract. */
    fun findBySubPlanIdAndUserId(subPlanId: Long, userId: Long): OptionVote?

    /** Bulk-load for tree aggregation — no N+1. */
    fun findAllByOptionIdIn(optionIds: Collection<Long>): List<OptionVote>

    /** All votes on one 안건, for the 확정 snapshot. */
    fun findAllBySubPlanId(subPlanId: Long): List<OptionVote>

    fun deleteAllByOptionId(optionId: Long)
    fun deleteAllBySubPlanId(subPlanId: Long)
    fun deleteAllBySubPlanIdIn(subPlanIds: Collection<Long>)
}
```

- [ ] **Step 3: Migration `V20__option_votes.sql`**

```sql
-- Vote (Decisions backlog A.4, part 1): one live, named vote per member per 안건.
-- Unique (sub_plan_id, user_id) enforces "move, don't accumulate". FKs RESTRICT;
-- service-level cascades clean votes on option/안건/plan hard-deletes (mirrors ratings).
-- decisions.vote_snapshot: tally JSON frozen at 확정 — the diary record; null when undecided-by-vote.
CREATE TABLE `option_votes` (
  `id`            bigint(20) NOT NULL AUTO_INCREMENT,
  `workspace_id`  bigint(20) NOT NULL,
  `sub_plan_id`   bigint(20) NOT NULL,
  `option_id`     bigint(20) NOT NULL,
  `user_id`       bigint(20) NOT NULL,
  `created_at`    datetime(6) NOT NULL,
  `updated_at`    datetime(6) NOT NULL,
  `version`       bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_option_votes_subplan_user` (`sub_plan_id`, `user_id`),
  KEY `idx_option_votes_option` (`option_id`),
  CONSTRAINT `fk_option_votes_subplan` FOREIGN KEY (`sub_plan_id`) REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_votes_option`  FOREIGN KEY (`option_id`)   REFERENCES `options` (`id`)   ON DELETE RESTRICT,
  CONSTRAINT `fk_option_votes_user`    FOREIGN KEY (`user_id`)     REFERENCES `users` (`id`)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `decisions` ADD COLUMN `vote_snapshot` text DEFAULT NULL;
```

Before writing the FK clauses, open `V15__decisions.sql` and mirror whatever FK/charset treatment `option_ratings` actually uses — consistency beats this sketch.

- [ ] **Step 4: `Decision.voteSnapshot` + DTO fields**

In `Decision.kt`, after `decidedByUserId`:

```kotlin
    /** Tally JSON frozen at 확정 ([{optionId,title,count,voters:[name]}]); null when no votes existed. */
    @Column(name = "vote_snapshot", columnDefinition = "text", updatable = false)
    val voteSnapshot: String? = null,
```

(`Decision` is constructed only in `DecisionService.lock` — add the constructor arg there in Task 3; default `null` keeps Task 1 compiling.)

In `DecisionDto.kt`: add `val voterUserIds: List<Long>` to `OptionResponse` (after `ratings`) and `val voteSnapshot: String?` to `DecisionResponse` (raw JSON string; the frontend parses). Update `Decision.toResponse()` (wherever it lives — `DecisionService` or the DTO file) to pass `voteSnapshot = this.voteSnapshot`.

- [ ] **Step 5: Tree aggregation + delete cascades in `PlanService`**

In `getTree`, next to the existing `ratingsByOption` bulk-load:

```kotlin
val votesByOption = if (optionIds.isEmpty()) emptyMap()
    else optionVoteRepository.findAllByOptionIdIn(optionIds).groupBy { it.optionId }
```

Thread `votes = votesByOption[it.id] ?: emptyList()` into `Option.toResponse(...)` and set `voterUserIds = votes.map { v -> v.userId }`. Give the `toResponse` vote parameter a default `emptyList()` so the `addOption`/`updateOption` echoes compile unchanged.

In the delete paths (mirror exactly where ratings are cleaned today): `deleteOption` → `optionVoteRepository.deleteAllByOptionId(...)`; `deleteSubPlan` → `deleteAllBySubPlanId(...)`; the plan hard-delete (`/forever`) → `deleteAllBySubPlanIdIn(subPlanIds)`. The FK is RESTRICT, so a missed path fails loudly in tests, not silently.

- [ ] **Step 6: Failing tests (tree shape)**

Create `VoteServiceTest.kt` with the `RatingServiceTest` fixture style (constructor-injected `@Autowired`, `newUser()`, a `seed()` returning ws/plan/subplan/two-option ids — copy the seed from `PlanLockServiceTest`). Task 1 runs only these two; the rest of the class arrives with Task 2:

```kotlin
@Test
fun `tree exposes empty voterUserIds before anyone votes`() {
    val s = seed()
    val opt = plans.getTree(s.wsId, s.planId).subPlans.first().options.first()
    assertEquals(emptyList<Long>(), opt.voterUserIds)
}

@Test
fun `option hard-delete cleans its votes`() {
    val s = seed()
    votes.cast(s.wsId, s.optA, s.user)            // compiles after Task 2
    plans.deleteOption(s.wsId, s.optB, s.user)    // match the real deleteOption signature
    plans.deleteOption(s.wsId, s.optA, s.user)    // RESTRICT FK would explode if cascade is missed
}
```

(Adjust `deleteOption` arguments to the real signature when writing — check `PlanService`.)

- [ ] **Step 7: Verify `validate` passes + commit**

```bash
./gradlew test --tests "com.shareddocs.backend.decision.VoteServiceTest" || true   # compile red expected until Task 2
./gradlew compileKotlin
git add -A && git commit -m "feat: OptionVote entity + V20 migration + tree voterUserIds"
```

---

### Task 2: Backend — `VoteService` + controller + both guards

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/VoteService.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/VoteController.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt` (add `SubPlanDecidedException`)
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/VoteServiceTest.kt` (extend)

- [ ] **Step 1: Write the failing tests** (append to `VoteServiceTest`)

```kotlin
@Test
fun `cast creates one vote and re-cast on the same option is a no-op`() {
    val s = seed()
    votes.cast(s.wsId, s.optA, s.user)
    votes.cast(s.wsId, s.optA, s.user)
    assertEquals(1, voteRepository.findAllBySubPlanId(s.subPlanId).size)
}

@Test
fun `cast on a sibling option moves the vote`() {
    val s = seed()
    votes.cast(s.wsId, s.optA, s.user)
    votes.cast(s.wsId, s.optB, s.user)
    val all = voteRepository.findAllBySubPlanId(s.subPlanId)
    assertEquals(1, all.size)
    assertEquals(s.optB, all[0].optionId)
}

@Test
fun `retract deletes my vote and is a no-op when absent or elsewhere`() {
    val s = seed()
    votes.retract(s.wsId, s.optA, s.user)              // absent → no-op
    votes.cast(s.wsId, s.optA, s.user)
    votes.retract(s.wsId, s.optB, s.user)              // my vote is on A → no-op
    assertEquals(1, voteRepository.findAllBySubPlanId(s.subPlanId).size)
    votes.retract(s.wsId, s.optA, s.user)
    assertEquals(0, voteRepository.findAllBySubPlanId(s.subPlanId).size)
}

@Test
fun `cast 404s for an option in another workspace`() {
    val s = seed()
    val other = newUser()
    val wsOther = workspaces.create(other.id!!, "O", "o")
    assertThrows(OptionNotFoundException::class.java) { votes.cast(wsOther.id!!, s.optA, other.id!!) }
}

@Test
fun `cast and retract are 409 on a locked plan`() {
    val s = seed()
    plans.lock(s.wsId, s.planId, s.user)
    assertThrows(PlanLockedException::class.java) { votes.cast(s.wsId, s.optA, s.user) }
    assertThrows(PlanLockedException::class.java) { votes.retract(s.wsId, s.optA, s.user) }
}

@Test
fun `cast is 409 on a decided 안건 and works again after reopen`() {
    val s = seed()
    decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(chosenOptionId = s.optA, reason = "사유"))
    assertThrows(SubPlanDecidedException::class.java) { votes.cast(s.wsId, s.optB, s.user) }
    decisions.reopen(s.wsId, s.subPlanId, s.user)
    votes.cast(s.wsId, s.optB, s.user)
    assertEquals(1, voteRepository.findAllBySubPlanId(s.subPlanId).size)
}

@Test
fun `tree carries voterUserIds after casting`() {
    val s = seed()
    votes.cast(s.wsId, s.optA, s.user)
    val opt = plans.getTree(s.wsId, s.planId).subPlans.first().options.first { it.id == s.optA }
    assertEquals(listOf(s.user), opt.voterUserIds)
}
```

- [ ] **Step 2: Run to verify red**

```bash
./gradlew test --tests "com.shareddocs.backend.decision.VoteServiceTest"
```
Expected: compilation failure (`votes`, `SubPlanDecidedException` unresolved).

- [ ] **Step 3: Exception**

Append to `DecisionExceptions.kt`:

```kotlin
/** A vote write hit an 안건 whose decision is locked. Reopen to vote again. */
class SubPlanDecidedException :
    ApiException(HttpStatus.CONFLICT, "subplan-decided", "SubPlan already decided", "이미 결정이 확정된 안건이에요. 다시 열면 투표할 수 있어요.")
```

- [ ] **Step 4: Service**

`VoteService.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class VoteService(
    private val optionRepository: OptionRepository,
    private val optionVoteRepository: OptionVoteRepository,
    private val decisionRepository: DecisionRepository,
    private val lockGuard: PlanLockGuard,
) {
    /** Cast or move my single vote on the option's 안건. Re-cast on the same option is a no-op. */
    fun cast(workspaceId: Long, optionId: Long, userId: Long) {
        val option = requireVotable(workspaceId, optionId)
        val existing = optionVoteRepository.findBySubPlanIdAndUserId(option.subPlanId, userId)
        if (existing != null) {
            if (existing.optionId == option.id) return
            optionVoteRepository.delete(existing)
            optionVoteRepository.flush() // free the (sub_plan_id, user_id) unique slot before the insert
        }
        optionVoteRepository.save(
            OptionVote(workspaceId = workspaceId, subPlanId = option.subPlanId, optionId = option.id!!, userId = userId),
        )
    }

    /** Retract my vote if it sits on this option; idempotent otherwise (caller returns 204 either way). */
    fun retract(workspaceId: Long, optionId: Long, userId: Long) {
        val option = requireVotable(workspaceId, optionId)
        optionVoteRepository.findBySubPlanIdAndUserId(option.subPlanId, userId)
            ?.takeIf { it.optionId == option.id }
            ?.let { optionVoteRepository.delete(it) }
    }

    private fun requireVotable(workspaceId: Long, optionId: Long): Option {
        val option = optionRepository.findByIdAndWorkspaceId(optionId, workspaceId) ?: throw OptionNotFoundException()
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
        if (decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(option.subPlanId) != null) {
            throw SubPlanDecidedException()
        }
        return option
    }
}
```

- [ ] **Step 5: Controller** (path shape mirrors `RatingController`)

`VoteController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/options/{optionId}/vote")
class VoteController(
    private val service: VoteService,
) {
    @PutMapping
    fun cast(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable optionId: Long,
    ): ResponseEntity<Void> {
        service.cast(ws.id!!, optionId, me.userId)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping
    fun retract(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable optionId: Long,
    ): ResponseEntity<Void> {
        service.retract(ws.id!!, optionId, me.userId)
        return ResponseEntity.noContent().build()
    }
}
```

(No request body, no response body — the tree read is the single source of vote truth.)

- [ ] **Step 6: Green + commit**

```bash
./gradlew test --tests "com.shareddocs.backend.decision.VoteServiceTest"
git add -A && git commit -m "feat: vote cast/move/retract with lock + decided guards"
```

---

### Task 3: Backend — snapshot at 확정 + event tally

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (if `toResponse` lives there)
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/DecisionSnapshotTest.kt` (create)

- [ ] **Step 1: Failing tests**

`DecisionSnapshotTest.kt` — same fixture style as `VoteServiceTest` (copy `newUser`/`seed`):

```kotlin
@Test
fun `확정 with votes stores the tally snapshot`() {
    val s = seed()
    val voter2 = newUser().also { workspaces.addMemberForTest(s.wsId, it.id!!) } // use the real member-add helper; if none exists, votes from s.user alone suffice — drop voter2
    votes.cast(s.wsId, s.optA, s.user)
    val d = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(chosenOptionId = s.optA, reason = "사유"))
    val stored = decisionRepository.findById(d.id).get()
    assertNotNull(stored.voteSnapshot)
    assertTrue(stored.voteSnapshot!!.contains("\"count\":1"))
    assertTrue(stored.voteSnapshot!!.contains("마포"))      // option title captured
}

@Test
fun `확정 without votes stores null snapshot`() {
    val s = seed()
    val d = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(chosenOptionId = s.optA, reason = "사유"))
    assertNull(decisionRepository.findById(d.id).get().voteSnapshot)
}

@Test
fun `re-decide snapshots fresh while the superseded decision keeps its original`() {
    val s = seed()
    votes.cast(s.wsId, s.optA, s.user)
    val first = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(chosenOptionId = s.optA, reason = "1차"))
    decisions.reopen(s.wsId, s.subPlanId, s.user)
    votes.cast(s.wsId, s.optB, s.user)
    val second = decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(chosenOptionId = s.optB, reason = "2차"))
    val firstStored = decisionRepository.findById(first.id).get()
    val secondStored = decisionRepository.findById(second.id).get()
    assertTrue(firstStored.voteSnapshot!!.contains("마포"))
    assertTrue(secondStored.voteSnapshot!!.contains("판교"))
}

@Test
fun `DECISION_LOCKED payload carries the vote summary when votes exist`() {
    val s = seed()
    votes.cast(s.wsId, s.optA, s.user)
    decisions.lock(s.wsId, s.subPlanId, s.user, LockDecisionRequest(chosenOptionId = s.optA, reason = "사유"))
    val ev = events.findAllByPlanIdOrderByCreatedAtDesc(s.planId).first { it.type == PlanEventType.DECISION_LOCKED }
    assertTrue(ev.payload!!.contains("1표"))
}
```

Run red: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionSnapshotTest"`.

- [ ] **Step 2: Implement snapshot in `DecisionService.lock`**

Add deps `optionVoteRepository: OptionVoteRepository`, `userRepository: UserRepository`, `objectMapper: ObjectMapper` to the constructor. Add a DTO near the service:

```kotlin
/** One snapshot line: how an option polled at 확정. Stored as JSON on Decision.voteSnapshot. */
data class VoteSnapshotEntry(val optionId: Long, val title: String, val count: Int, val voters: List<String>)
```

In `lock`, after resolving `option` and before constructing the `Decision`:

```kotlin
val votes = optionVoteRepository.findAllBySubPlanId(subPlanId)
val voteSnapshot: String? = if (votes.isEmpty()) null else {
    val titles = optionRepository.findAllBySubPlanIdInOrderBySortOrderAscIdAsc(listOf(subPlanId))
    val names = userRepository.findAllById(votes.map { it.userId }.distinct()).associate { it.id!! to it.name }
    val entries = titles.mapNotNull { opt ->
        val vs = votes.filter { it.optionId == opt.id }
        if (vs.isEmpty()) null
        else VoteSnapshotEntry(opt.id!!, opt.title, vs.size, vs.map { v -> names[v.userId] ?: "알 수 없음" })
    }
    objectMapper.writeValueAsString(entries)
}
```

Pass `voteSnapshot = voteSnapshot` into the `Decision(...)` constructor. Then extend the event payload (votes exist only):

```kotlin
payload = buildMap {
    put("optionTitle", option.title)
    put("reason", decision.reason)
    if (votes.isNotEmpty()) put("voteSummary", "${votes.size}표 중 ${votes.count { it.optionId == option.id }}표")
},
```

(Match the existing `events.record` payload type — if it takes `Map<String, String>`, `buildMap` as above is fine.)

- [ ] **Step 3: Green + full suite + commit**

```bash
./gradlew test --tests "com.shareddocs.backend.decision.DecisionSnapshotTest"
./gradlew clean test
git add -A && git commit -m "feat: vote tally snapshot on Decision at 확정 + event summary"
```

Expected: full suite green (`ddl-auto: validate` proves entity↔V20 match).

---

### Task 4: Frontend — vote UI, decide pre-fill, ship Part 1

**Files:**
- Modify: `shared-docs/src/features/decisions/types.ts`
- Modify: `shared-docs/src/features/decisions/api.ts`
- Modify: `shared-docs/src/features/decisions/OptionRow.tsx` + `OptionRow.module.css`
- Modify: `shared-docs/src/features/decisions/SubPlanSection.tsx`
- Modify: `shared-docs/src/features/decisions/PlanDetail.tsx`
- Modify: `shared-docs/src/features/decisions/DecisionModal.tsx` + `DecisionModal.module.css`
- Modify: `shared-docs/src/features/decisions/SubPlanCanvasNode.tsx` + `SubPlanCanvasNode.module.css`
- Modify: `shared-docs/src/features/decisions/formatPlanEvent.tsx`
- Modify: `shared-docs/src/features/decisions/Timeline.tsx` (only if snapshot display needs it; payload-driven is preferred)

- [ ] **Step 1: Types**

In `types.ts`: add `voterUserIds: number[]` to `OptionNode`; add `voteSnapshot: string | null` to `DecisionInfo`. Add:

```typescript
export type VoteSnapshotEntry = { optionId: number; title: string; count: number; voters: string[] }
```

- [ ] **Step 2: Hooks** (in `api.ts`, next to `useRateOption`)

```typescript
export function useCastVote() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (optionId: number) => { await apiClient.put(`/api/options/${optionId}/vote`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

export function useRetractVote() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (optionId: number) => { await apiClient.delete(`/api/options/${optionId}/vote`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: `OptionRow` vote affordance**

Props gain `decided: boolean`, `onVote: () => void`, `onRetractVote: () => void`. In the head, between `.avg` and `.actions`:

```tsx
{(() => {
  const iVoted = option.voterUserIds.includes(myUserId)
  const frozen = !!locked || decided
  return (
    <button
      type="button"
      className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
      disabled={busy || frozen}
      aria-pressed={iVoted}
      title={iVoted ? '투표 취소' : '투표'}
      onClick={() => (iVoted ? onRetractVote() : onVote())}
    >
      <Vote size={13} />
      {option.voterUserIds.length > 0 && <span>{option.voterUserIds.length}</span>}
    </button>
  )
})()}
```

(`Vote` from `lucide-react`. When frozen the tally stays visible — only the click is disabled.) In the expanded body, under the ratings block, voter names:

```tsx
{option.voterUserIds.length > 0 && (
  <p className={styles.voters}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
)}
```

`OptionRow.module.css` additions (hairline pill, token-only):

```css
.vote {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; font-size: var(--fs-xs); color: var(--c-text-muted);
  background: none; border: 1px solid var(--c-border); border-radius: 999px; cursor: pointer;
}
.vote:hover:not(:disabled) { background: var(--c-surface-tint); }
.vote:disabled { cursor: default; opacity: .6; }
.voteOn { color: var(--c-primary); border-color: var(--c-primary); background: var(--c-primary-soft); }
.voters { font-size: var(--fs-xs); color: var(--c-text-subtle); margin: 0; }
```

- [ ] **Step 4: `SubPlanSection` pass-through + button label**

Pass `decided={subPlan.decision != null}`, `onVote={() => onVote(o)}`, `onRetractVote={() => onRetractVote(o)}` into each `OptionRow` (add the two callbacks to `SubPlanSection`'s props, typed `(option: OptionNode) => void`). Relabel the decide button:

```tsx
{!decision && subPlan.options.length > 0 && (
  <Button variant="soft" size="sm" onClick={onDecide} disabled={busy}>
    {subPlan.options.some((o) => o.voterUserIds.length > 0) ? '결과 확정하기' : '결정하기'}
  </Button>
)}
```

- [ ] **Step 5: `PlanDetail` wiring + decide pre-fill**

Add `const castVote = useCastVote()` and `const retractVote = useRetractVote()`; include `castVote.isPending || retractVote.isPending` in the `busy` expression passed to `renderSubPlan`. Wire `onVote={(o) => castVote.mutate(o.id)}` and `onRetractVote={(o) => retractVote.mutate(o.id)}` through `SortableSubPlanSection` → `SubPlanSection`. Pre-fill the modal — leading option, tie → none:

```tsx
const leadingOptionId = (sp: SubPlanNode): number | null => {
  const max = Math.max(...sp.options.map((o) => o.voterUserIds.length))
  if (max <= 0) return null
  const leaders = sp.options.filter((o) => o.voterUserIds.length === max)
  return leaders.length === 1 ? leaders[0].id : null
}
```

```tsx
<DecisionModal
  ...
  currentChosenId={decidingFor?.decision?.chosenOptionId ?? (decidingFor ? leadingOptionId(decidingFor) : null)}
  ...
/>
```

(An existing decision still wins the pre-select — changing a decision should start from the current choice, not the tally.)

- [ ] **Step 6: `DecisionModal` tally hint**

In the option label row, after `optionAvg`:

```tsx
{o.voterUserIds.length > 0 && <span className={styles.optionVotes}>{o.voterUserIds.length}표</span>}
```

```css
.optionVotes { font-size: var(--fs-xs); color: var(--c-primary); }
```

- [ ] **Step 7: Decision banner tally**

In `SubPlanSection.tsx`, the 결정됨 banner shows how the group leaned when the snapshot exists (parse defensively — old decisions have null):

```tsx
const snapshot: VoteSnapshotEntry[] | null = useMemo(() => {
  if (!decision?.voteSnapshot) return null
  try { return JSON.parse(decision.voteSnapshot) as VoteSnapshotEntry[] } catch { return null }
}, [decision?.voteSnapshot])
const chosenTally = snapshot?.find((e) => e.optionId === decision?.chosenOptionId)
const totalVotes = snapshot?.reduce((n, e) => n + e.count, 0) ?? 0
```

In the banner body, after the reason:

```tsx
{chosenTally && <span className={styles.bannerVotes}> · {totalVotes}표 중 {chosenTally.count}표</span>}
```

```css
.bannerVotes { color: var(--c-text-muted); font-size: var(--fs-xs); }
```

- [ ] **Step 8: Canvas tally (read-only) + timeline summary**

`SubPlanCanvasNode.tsx`, in the expanded option row after `optionTitle`:

```tsx
{o.voterUserIds.length > 0 && <span className={styles.optionVotes}>{o.voterUserIds.length}표</span>}
```

(.module.css: same `.optionVotes` rule as above.) In `formatPlanEvent.tsx`, where `DECISION_LOCKED`/`DECISION_CHANGED` sentences are built, append the tally when present: `payload?.voteSummary` → `… (3표 중 2표)`. Follow the file's existing payload-access pattern exactly.

- [ ] **Step 9: Gates + manual check + ship Part 1**

```bash
cd shared-docs && npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build
```

Manual (`npm run dev` + backend `bootRun`): cast on one 선택지 → pill fills, tally 1; cast on a sibling → moves; click again → retracts; second account (dev-login) → named voters line; lock plan → pill disabled, tally visible; decided 안건 → pill disabled; 결과 확정하기 → modal opens with leader pre-selected; decide → timeline entry shows `…표`; 기록 tab renders.

```bash
# backend
cd shared-docs-backend && git checkout main && git merge --no-ff plan-discussion-vote && git push
# frontend
cd shared-docs && git add -A && git commit -m "feat: vote UI + decide pre-fill (A.4 part 1)" && git checkout main && git merge --no-ff plan-discussion-vote && git push
```

User confirms prod CD green (V20 applied). Re-create/continue the `plan-discussion-vote` branches for Part 2.

---

## Part 2 — Discussion surface (backend Tasks 5–6, frontend Tasks 7–8)

### Task 5: Backend — `discussion_note_id` + lazy-create endpoint

**Files:**
- Create: `shared-docs-backend/src/main/resources/db/migration/V21__plan_discussion_note.sql`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/Plan.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanDiscussionService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/PlanDiscussionServiceTest.kt` (create)

- [ ] **Step 1: Failing tests**

```kotlin
@Test
fun `first open creates and links a workspace note titled after the plan`() {
    val s = seed()
    val note = discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)
    assertEquals("P 논의", note.title)
    assertEquals(Visibility.WORKSPACE, note.visibility)
    assertEquals(note.id, planRepository.findById(s.planId).get().discussionNoteId)
}

@Test
fun `second open returns the same note without creating another`() {
    val s = seed()
    val first = discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)
    val second = discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)
    assertEquals(first.id, second.id)
}

@Test
fun `soft-deleted linked note is replaced by a fresh one`() {
    val s = seed()
    val first = discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)
    noteService.delete(first.id, s.wsId, s.user)   // match the real soft-delete signature
    val second = discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)
    assertNotEquals(first.id, second.id)
    assertEquals(second.id, planRepository.findById(s.planId).get().discussionNoteId)
}

@Test
fun `works on a locked plan`() {
    val s = seed()
    plans.lock(s.wsId, s.planId, s.user)
    discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)   // must not throw
}

@Test
fun `linked note flipped PRIVATE yields 409 for non-authors and the note for its author`() {
    val s = seed()
    val note = discussion.ensureDiscussionNote(s.wsId, s.planId, s.user)
    noteService.update(note.id, UpdateNoteRequest(visibility = Visibility.PRIVATE), s.wsId, s.user) // match real signature
    val outsiderInWs = newUser() // add as ws member via the real membership helper
    assertThrows(DiscussionNotePrivateException::class.java) {
        discussion.ensureDiscussionNote(s.wsId, s.planId, outsiderInWs.id!!)
    }
    assertEquals(note.id, discussion.ensureDiscussionNote(s.wsId, s.planId, s.user).id)
}

@Test
fun `404 on a deleted plan`() {
    val s = seed()
    plans.delete(s.wsId, s.planId)   // match real discard signature
    assertThrows(PlanNotFoundException::class.java) { discussion.ensureDiscussionNote(s.wsId, s.planId, s.user) }
}
```

(Adapt the note-service call signatures to the real `NoteService` API while writing — the behaviors, not the exact helper names, are the contract.) Run red.

- [ ] **Step 2: Migration `V21__plan_discussion_note.sql`**

```sql
-- Discussion surface (Decisions backlog A.4, part 2): lazy 1:1 discussion note per 계획.
-- ON DELETE SET NULL: a hard-deleted note must not strand its plan — the next pane
-- open simply lazy-creates a fresh note (same code path as null).
ALTER TABLE `plans`
  ADD COLUMN `discussion_note_id` bigint(20) DEFAULT NULL,
  ADD CONSTRAINT `fk_plans_discussion_note` FOREIGN KEY (`discussion_note_id`)
      REFERENCES `notes` (`id`) ON DELETE SET NULL;
```

`Plan.kt`, after `lockedByUserId`:

```kotlin
    /** Lazy 1:1 discussion note; null until first pane open. ON DELETE SET NULL in V21. */
    @Column(name = "discussion_note_id")
    var discussionNoteId: Long? = null,
```

- [ ] **Step 3: Service + exception + endpoint**

`DecisionExceptions.kt`:

```kotlin
/** The plan's discussion note was flipped PRIVATE by its author — don't fork a second one. */
class DiscussionNotePrivateException :
    ApiException(HttpStatus.CONFLICT, "discussion-note-private", "Discussion note is private", "논의 노트가 비공개로 전환되어 있어요. 노트 작성자만 열 수 있어요.")
```

`PlanDiscussionService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteRepository
import com.shareddocs.backend.note.NoteResponse
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.Visibility
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class PlanDiscussionService(
    private val planRepository: PlanRepository,
    private val noteRepository: NoteRepository,
    private val noteService: NoteService,
) {
    /**
     * Idempotent ensure: return the live linked note, or create+link one.
     * NOT lock-guarded — discussion stays open on a locked plan by design.
     * Races resolve via Plan's optimistic version: the loser's whole tx
     * (note insert + FK write) rolls back and the controller retries once.
     */
    @Transactional
    fun ensureDiscussionNote(workspaceId: Long, planId: Long, actorUserId: Long): NoteResponse {
        val plan = planRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(planId, workspaceId)
            ?: throw PlanNotFoundException()

        plan.discussionNoteId?.let { linkedId ->
            val linked = noteRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(linkedId, workspaceId)
            if (linked.isPresent) {
                val note = linked.get()
                if (note.visibility == Visibility.PRIVATE && note.createdBy.id != actorUserId) {
                    throw DiscussionNotePrivateException()
                }
                return NoteResponse.from(note)
            }
            // linked note soft-deleted → fall through and re-create (same path as null)
        }

        val created = noteService.create(
            CreateNoteRequest(title = "${plan.title} 논의", visibility = Visibility.WORKSPACE),
            workspaceId,
            actorUserId,
        )
        plan.discussionNoteId = created.id
        return created
    }
}
```

`PlanController.kt` — inject `PlanDiscussionService`, add:

```kotlin
@PostMapping("/{planId}/discussion-note")
fun discussionNote(
    @CurrentWorkspace ws: Workspace,
    @AuthenticationPrincipal me: AppPrincipal,
    @PathVariable planId: Long,
): NoteResponse =
    try {
        discussion.ensureDiscussionNote(ws.id!!, planId, me.userId)
    } catch (e: org.springframework.orm.ObjectOptimisticLockingFailureException) {
        // concurrent first-open: loser's tx rolled back wholesale; the winner's note now exists
        discussion.ensureDiscussionNote(ws.id!!, planId, me.userId)
    }
```

- [ ] **Step 4: Green + full suite + commit**

```bash
./gradlew test --tests "com.shareddocs.backend.decision.PlanDiscussionServiceTest"
./gradlew clean test
git add -A && git commit -m "feat: lazy 1:1 plan discussion note + V21"
```

---

### Task 6: Backend — chips: `EntityKind` += plan/subplan/option

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/EntityRef.kt` (EntityKind constants)
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/EntityRefIndexer.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/search/EntitySearch.kt` (service: search + preview branches; `EntityHit`/`EntityPreview` gain `planId`)
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt`, `SubPlanRepository.kt`, `OptionRepository.kt` (finder + search methods)
- Test: extend the existing indexer test class (find it: `grep -rl EntityRefIndexer src/test`) + the search test class similarly

- [ ] **Step 1: Failing tests** — find the existing classes first (`grep -rl "EntityRefIndexer\|EntitySearchService" src/test`) and follow their fixture style for ws/user/note seeding; the decision tree seed is the same `seed()` used in `VoteServiceTest`. The chip body format is fixed:

```kotlin
private fun chip(kind: String, id: Long) = """<span data-type="entity-link" data-kind="$kind" data-id="$id"></span>"""

@Test
fun `indexes plan, subplan and option chips and drops deleted or cross-workspace targets`() {
    val s = seed()                                       // ws + plan + subplan + options
    val foreign = seed()                                 // a second workspace's plan
    plans.delete(s.wsId, deadPlanId)                     // seed one extra plan, then soft-delete it (match real discard signature)
    val body = "<p>" +
        chip(EntityKind.PLAN, s.planId) + chip(EntityKind.SUBPLAN, s.subPlanId) + chip(EntityKind.OPTION, s.optA) +
        chip(EntityKind.PLAN, deadPlanId) + chip(EntityKind.PLAN, foreign.planId) +
        "</p>"
    indexer.reindex(noteId, s.wsId, body)                // note created in s.wsId via the class's note fixture
    val refs = entityRefRepository.findAll().filter { it.fromNoteId == noteId }
    assertEquals(setOf(EntityKind.PLAN to s.planId, EntityKind.SUBPLAN to s.subPlanId, EntityKind.OPTION to s.optA),
        refs.map { it.toKind to it.toId }.toSet())
}

@Test
fun `search returns decision kinds with owning planId on subplan and option hits`() {
    val s = seed()                                       // subplan title "동네"
    val hits = searchService.search("동네", 8, s.wsId, s.user)
    val sp = hits.first { it.kind == EntityKind.SUBPLAN }
    assertEquals(s.subPlanId, sp.id)
    assertEquals(s.planId, sp.planId)
}
```

(Repository/field names from the real test classes win over this sketch — the assertions are the contract.)

- [ ] **Step 2: Kinds + indexer**

`EntityKind`:

```kotlin
const val PLAN = "plan"
const val SUBPLAN = "subplan"
const val OPTION = "option"

val ALL = setOf(NOTE, SHEET, PURCHASE, TODO, ANNIVERSARY, RECIPE, LINK, PLAN, SUBPLAN, OPTION)
```

`EntityRefIndexer.filterToExistingTargets` — three new branches (inject the three repositories):

```kotlin
EntityKind.PLAN -> plans.findAllByIdInAndWorkspaceIdAndDeletedAtIsNull(ids, workspaceId).mapNotNull { it.id }.toSet()
EntityKind.SUBPLAN -> subPlans.findAllByIdInAndWorkspaceId(ids, workspaceId).mapNotNull { it.id }.toSet()
EntityKind.OPTION -> options.findAllByIdInAndWorkspaceId(ids, workspaceId).mapNotNull { it.id }.toSet()
```

Add the missing repository methods (derived queries; `PlanRepository` needs the `DeletedAtIsNull` variant):

```kotlin
fun findAllByIdInAndWorkspaceIdAndDeletedAtIsNull(ids: Collection<Long>, workspaceId: Long): List<Plan>   // PlanRepository
fun findAllByIdInAndWorkspaceId(ids: Collection<Long>, workspaceId: Long): List<SubPlan>                  // SubPlanRepository
fun findAllByIdInAndWorkspaceId(ids: Collection<Long>, workspaceId: Long): List<Option>                   // OptionRepository
```

- [ ] **Step 3: Search + preview**

`EntityHit` and `EntityPreview` gain `val planId: Long? = null` (additive; existing kinds keep null). In `EntitySearchService.search`, mirror the existing per-kind branch structure for the three kinds — plan hits search active plans by title; subplan/option hits carry the owning `planId` (option resolves it via its 안건) and use the plan title as `hint`. Repository search methods, e.g.:

```kotlin
// SubPlanRepository — title search joined to its plan for the hint + planId
@Query("""
    SELECT sp FROM SubPlan sp
    WHERE sp.workspaceId = :workspaceId AND LOWER(sp.title) LIKE LOWER(CONCAT('%', :q, '%'))
    ORDER BY sp.updatedAt DESC
""")
fun searchByTitle(@Param("workspaceId") workspaceId: Long, @Param("q") q: String, pageable: Pageable): List<SubPlan>
```

(Adapt to however the existing kinds do paging/limits — read the service first and copy its idiom, including the empty-`q` recent-first behavior. Exclude soft-deleted plans' subplans/options from results: filter hits whose plan is deleted, via a bulk plan lookup.) `preview()` gets the same three branches (title + plan-title hint).

- [ ] **Step 4: Green + full suite + commit**

```bash
./gradlew clean test
git add -A && git commit -m "feat: entity-link kinds plan/subplan/option in indexer + search"
```

---

### Task 7: Frontend — chips for decision kinds + deep-link landing

**Files:**
- Modify: `shared-docs/src/features/notes/editor/extensions/EntityLink.ts`
- Modify: `shared-docs/src/features/notes/editor/extensions/EntityLinkChip.tsx`
- Modify: `shared-docs/src/features/notes/editor/extensions/MentionCommand.ts`
- Modify: `shared-docs/src/features/notes/editor/extensions/MentionMenuPopup.tsx` (kind labels, if it maps kind→Korean label)
- Modify: `shared-docs/src/features/decisions/PlanDetail.tsx` (`?subplan=` / `?option=` landing)

- [ ] **Step 1: Extension kinds + planId attr**

`EntityLink.ts`: add `'plan' | 'subplan' | 'option'` to `EntityKind` and `ENTITY_KINDS`. Add a `planId` node attribute alongside `title` (immutable in the domain — 안건/선택지 never change plan):

```typescript
planId: {
  default: null,
  parseHTML: (el: HTMLElement) => {
    const raw = el.getAttribute('data-plan-id')
    return raw ? Number(raw) : null
  },
  renderHTML: (attrs: { planId: number | null }) =>
    attrs.planId != null ? { 'data-plan-id': String(attrs.planId) } : {},
},
```

`MentionCommand.ts`: `MentionItem` gains `planId?: number | null`; the insert `attrs` gain `planId: props.planId ?? null`.

- [ ] **Step 2: Chip rendering + navigation**

`EntityLinkChip.tsx`: the three new kinds render from the stored `data-title` (static fallback path, like purchase/todo today — no live cache). Icon map: `plan` → `Vote`, `subplan` → `ListTree`, `option` → `CircleDot` (all lucide). Extend `navTarget` (signature gains the attr):

```typescript
function navTarget(kind: EntityKind, id: number, planId: number | null): string {
  switch (kind) {
    // ...existing cases unchanged...
    case 'plan': return `/decisions/${id}`
    case 'subplan': return planId != null ? `/decisions/${planId}?subplan=${id}` : '/decisions'
    case 'option': return planId != null ? `/decisions/${planId}?option=${id}` : '/decisions'
  }
}
```

Pass the node's `planId` attr at the existing call site. `MentionMenuPopup.tsx`: if it renders per-kind Korean labels, add 계획/안건/선택지.

- [ ] **Step 3: PlanDetail landing**

Read `useSearchParams()`; when the tree loads, resolve the target 안건 (`?subplan=N` directly; `?option=M` → the subplan containing option M) and scroll to it once via the existing `jumpToSubPlan`:

```tsx
const [searchParams] = useSearchParams()
const jumpedRef = useRef(false)
useEffect(() => {
  if (!tree || jumpedRef.current) return
  const spParam = searchParams.get('subplan')
  const optParam = searchParams.get('option')
  let targetId: number | null = spParam ? Number(spParam) : null
  if (targetId == null && optParam != null) {
    const optId = Number(optParam)
    targetId = tree.subPlans.find((sp) => sp.options.some((o) => o.id === optId))?.id ?? null
  }
  if (targetId != null) {
    jumpedRef.current = true
    jumpToSubPlan(targetId)
    // transient accent flash: reuse the hover accent layer, then clear
    setHoveredSubPlanId(targetId)
    setTimeout(() => setHoveredSubPlanId(null), 1600)
  }
}, [tree, searchParams])
```

(The setState here is a timeout-driven transient, not props-mirroring — house rule 6 targets the latter. If review balks, scroll-only is the fallback.)

- [ ] **Step 4: Gates + commit**

```bash
npx tsc -b --noEmit && npx eslint src/features/notes/editor/extensions/ src/features/decisions/ && npm run build
git add -A && git commit -m "feat: entity chips for 계획/안건/선택지 + deep-link landing"
```

Manual: in a note, type `@` → 계획/안건/선택지 appear in suggestions; insert an 안건 chip → click → lands on the plan scrolled to that 안건; delete the plan → chip tombstones.

---### Task 8: Frontend — discussion pane (split-view), ship Part 2

**Files:**
- Modify: `shared-docs/src/features/decisions/api.ts` (`useDiscussionNote`)
- Create: `shared-docs/src/features/decisions/DiscussionPane.tsx` + `DiscussionPane.module.css`
- Modify: `shared-docs/src/features/decisions/PlanDetail.tsx` + `PlanDetail.module.css`

- [ ] **Step 1: Ensure-note hook** (idempotent POST behind a query — re-running it is safe by design)

```typescript
import type { Note } from '../notes/types'

export function useDiscussionNote(planId: number, enabled: boolean) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: [...decisionKeys.tree(activeId, planId), 'discussion-note'],
    queryFn: async () => (await apiClient.post<Note>(`/api/plans/${planId}/discussion-note`)).data,
    enabled: enabled && activeId != null && Number.isFinite(planId),
    staleTime: 60 * 1000,
    retry: false, // 409 discussion-note-private must surface, not retry
  })
}
```

- [ ] **Step 2: `DiscussionPane`**

New component. Content: read-only note title heading; `NoteEditorBody` with the 600ms debounced autosave (copy the `pendingBody`/`autosaveTimer` ref pattern **from `SharedNoteView.tsx`**, including flush-on-unmount, but mutate via the notes feature's own update hook so `noteKeys` invalidate and the notes list stays fresh); `Comments` below a hairline divider:

```tsx
import { Comments } from '../../components/Comments'   // match the real export style

// inside the component, after the editor body:
<div className={styles.commentsWrap}>
  <Comments pageId={`note-${note.id}`} title="댓글" />
</div>
```

States: loading → `Skeleton`; 409 `discussion-note-private` → calm message ("논의 노트가 비공개로 전환되어 있어요.") via the existing `apiError`/problem-detail body shape; loaded → editor + comments. Key the editor by `note.id` (re-mount on re-create after deletion — house rule 6 pattern).

`DiscussionPane.module.css` — full-height column, hairline left border, tokens only:

```css
.pane { display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--c-border); padding-left: var(--sp-4); }
.title { font-family: var(--font-serif); font-size: var(--fs-lg); font-weight: var(--fw-semi); margin: 0 0 var(--sp-2); }
.editorWrap { flex: 1; min-height: 240px; overflow-y: auto; }
.commentsWrap { border-top: 1px solid var(--c-border); padding-top: var(--sp-3); margin-top: var(--sp-3); }
```

- [ ] **Step 3: Split-view in `PlanDetail`**

Toggle state, persisted per plan:

```tsx
const [discussionOpen, setDiscussionOpen] = useState(() => localStorage.getItem(`discussion-open-${planId}`) === '1')
const toggleDiscussion = () => setDiscussionOpen((v) => {
  localStorage.setItem(`discussion-open-${planId}`, v ? '0' : '1')
  return !v
})
```

Button in `planBarActions` (outline-tier — the screen's primary stays the decide action):

```tsx
<Button variant="ghost" size="sm" leading={<MessagesSquare size={14} />} onClick={toggleDiscussion}>논의</Button>
```

Layout: wrap the tree content + pane in a split container; **one mount**, CSS-only responsive (desktop = grid column, <901px = fixed overlay drawer — avoids double-mounting two Tiptap instances on the same note):

```tsx
<div className={discussionOpen ? styles.split : undefined}>
  <div className={styles.main}>{/* existing view-conditional content */}</div>
  {discussionOpen && (
    <aside className={styles.pane} aria-label="논의">
      <DiscussionPane planId={planId} onClose={toggleDiscussion} />
    </aside>
  )}
</div>
```

`PlanDetail.module.css` additions:

```css
.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 38%); gap: var(--sp-4); align-items: start; }
.main { min-width: 0; }
.pane { position: sticky; top: var(--sp-4); max-height: calc(100vh - 96px); overflow: hidden; display: flex; flex-direction: column; }

@media (max-width: 900px) {
  .split { display: block; }
  .pane {
    position: fixed; inset: auto 0 0 0; z-index: 30; height: 70vh;
    background: var(--c-surface); border-top: 1px solid var(--c-border);
    border-radius: var(--r-md) var(--r-md) 0 0; padding: var(--sp-4);
    box-shadow: var(--shadow-floating, 0 -8px 24px rgba(0,0,0,.12)); /* floating surface — shadow allowed */
  }
}
```

(`DiscussionPane` shows an ✕ `IconButton` (`X` icon) on mobile via the `onClose` prop — visible only under the same media query.)

- [ ] **Step 4: Gates + manual + ship Part 2**

```bash
npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build
```

Manual: open 논의 → note auto-created once (check notes list — it appears there, titled "{plan} 논의"); type in pane → close → reopen → persisted; edit same note from the notes page → both surfaces converge; add a comment; insert a 선택지 chip inside the discussion note → click → lands highlighted; lock the plan → pane still editable; soft-delete the note from the notes list → reopen pane → fresh note; flip note PRIVATE as author → second account sees the calm 409 message; narrow window → drawer.

```bash
# backend
cd shared-docs-backend && git checkout main && git merge --no-ff plan-discussion-vote && git push
# frontend
cd shared-docs && git add -A && git commit -m "feat: plan discussion pane + chips (A.4 part 2)" && git checkout main && git merge --no-ff plan-discussion-vote && git push
```

User confirms prod CD green (V21 applied). Done — A.4's remaining scope after this is deadlines (separate design, already agreed).
