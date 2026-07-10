# Decisions Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Decisions pillar per manual-testing feedback: sub-items become **nested 안건** (recursive `sub_plans.parent_sub_plan_id`, retiring the Phase-1 child-plan model), every 안건 gets a **detail page**, candidates gain structured **장점/단점** (retiring the rating model), comments run at **3 levels** (계획/안건/선택지), and **투표** stays.

**Architecture:** Backend first — one migration (V25) does all schema (add `sub_plans.parent_sub_plan_id`, create `option_pro_cons`, drop `option_ratings`, drop `plans.parent_plan_id`); then teardown of retired code, nested-안건 + detail endpoint, pro/con CRUD, and comment realtime/purge for the new pageId levels. Frontend then rebuilds the plan page (top-level 안건 list with foldable 서브안건), adds the 안건 detail-page route/hub, and reworks the candidate card, deleting the Phase-1 components.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + Flyway (`shared-docs-backend`, Tasks 1–4); Vite + React 19 + TS + CSS Modules + React Query + React Router v6 (`shared-docs`, Tasks 5–9); Task 10 docs/deploy.

**Design spec:** `shared-docs/docs/plans/2026-07-10-decisions-rework-design.md`.

## Global Constraints

- Two repos: BE tasks in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend`, FE tasks in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs`.
- All UI text Korean; icons lucide-react only (never emoji); CSS Modules + tokens from `src/components/ui/tokens.css` (no hardcoded hex); cards never lift (hairline `--c-border`, `--c-surface-tint` hover, no shadow); no setState in effect (wrapper+keyed-inner for forms).
- FE gates: `npx tsc -b --noEmit` (MUST use `-b`) + `npm run build`; lint only touched folder (`npx eslint src/features/decisions/`).
- BE gate: `./gradlew test`. Single class: `./gradlew test --tests "com.shareddocs.backend.decision.<Class>"`. Baseline is currently green; this rework DELETES several test classes (listed per task) — "green" means the surviving suite passes.
- 장점/단점 and 투표 are lock-guarded (freeze on a locked plan via `lockGuard.assertUnlockedBySubPlanId`); 댓글 is NOT lock-guarded (conversation stays open).
- Foreign-workspace ids → 404 (`ApiException` subclass), never 403; permission denials (wrong user) → 403.
- Every mutating decision-service path ends with `changes.publish(workspaceId, planId)` (constructor param `changes: DecisionChangePublisher`).
- `PlanEventType.type` column is `varchar(40)` — new event names must fit.
- No data migration (disposable 2-person test data): existing child-plans become top-level 계획; existing ratings are dropped.
- Commit after each task; conventional commits (`feat/refactor(decisions): …`).

## File-level map (what changes)

**Backend delete:** `OptionRating.kt`, `OptionRatingRepository.kt`, `RatingController.kt`, `RatingService.kt`, and tests `RatingServiceTest`, `PlanHierarchyTest`, `PlanChildCountTest`, `SubPlanPromotionTest`, `SubDecisionTreeTest`, `SubDecisionTrashTest`.
**Backend add:** `OptionProCon.kt`, `OptionProConRepository.kt`, `OptionProConService.kt`, `OptionProConController.kt`, `SubPlanDetailResponse` (in DecisionDto), `V25__decisions_rework.sql`.
**Backend modify:** `SubPlan.kt`, `SubPlanRepository.kt`, `PlanService.kt`, `DecisionDto.kt`, `PlanController.kt`, `SubPlanController.kt`, `PlanEnums.kt`, `PlanRepository.kt`, `Plan.kt`, `Option.kt`(mapper), `OptionRepository.kt`, `OptionVoteRepository.kt`, `CommentService.kt`.
**Frontend delete:** `SubDecisionSection.tsx(+css)`, `SubDecisionCanvasNode.tsx(+css)`, `PlanTreeNavigator.tsx(+css)`, `RatingControl.tsx(+css)`.
**Frontend add:** `SubPlanDetail.tsx(+css)`, `ProConSection.tsx(+css)`.
**Frontend modify:** `types.ts`, `api.ts`, `App.tsx`, `PlanDetail.tsx(+css)`, `SubPlanSection.tsx`, `OptionRow.tsx(+css)`, `PlanCanvas.tsx`, `StoryView.tsx`, `formatPlanEvent.tsx`, `DecisionList.tsx`(if it references removed types).

---

### Task 1: V25 migration + teardown (rating, hierarchy, promote, childCount, parent_plan_id)

**Files:**
- Create: `src/main/resources/db/migration/V25__decisions_rework.sql`
- Delete: `src/main/kotlin/com/shareddocs/backend/decision/OptionRating.kt`, `OptionRatingRepository.kt`, `RatingController.kt`, `RatingService.kt`
- Delete tests: `src/test/kotlin/com/shareddocs/backend/decision/{RatingServiceTest,PlanHierarchyTest,PlanChildCountTest,SubPlanPromotionTest,SubDecisionTreeTest,SubDecisionTrashTest}.kt`
- Modify: `PlanService.kt`, `DecisionDto.kt`, `PlanController.kt`, `SubPlanController.kt`, `PlanEnums.kt`, `PlanRepository.kt`, `Plan.kt`, `OptionRepository.kt`, `OptionVoteRepository.kt`
- Fix (compile/asserts): `PlanTreeTest`, `OptionServiceTest`, `PlanLockServiceTest`, `PlanTrashServiceTest`, `DecisionAggregationTest`, `DecisionChangeCoverageTest`, `note/EntityRefIndexerDecisionTest`, `search/EntitySearchDecisionTest` (only if they reference removed symbols)

**Interfaces:**
- Produces: `V25` schema (adds `sub_plans.parent_sub_plan_id`, creates `option_pro_cons`, drops `option_ratings`, drops `plans.parent_plan_id`) — Tasks 2–3 consume the added tables. `OptionResponse` loses `avgScore`/`ratingCount`/`ratings` (keeps `voterUserIds`). `PlanSummaryResponse`/`PlanTreeResponse` lose `parentPlanId`; `PlanSummaryResponse` loses `childCount`.

**This task is a teardown + migration; it produces no new behavior — its deliverable is "the retired surface is gone and the suite is green."**

- [ ] **Step 1: Write the V25 migration**

Create `src/main/resources/db/migration/V25__decisions_rework.sql`:

```sql
-- Decisions rework (2026-07-10): nested 안건, structured pros/cons, retire rating + child-plans.

-- 1. Nested 안건: a 안건 may hang under another 안건 in the SAME plan.
ALTER TABLE `sub_plans`
  ADD COLUMN `parent_sub_plan_id` bigint(20) DEFAULT NULL,
  ADD KEY `idx_sub_plans_parent` (`parent_sub_plan_id`),
  ADD CONSTRAINT `fk_sub_plans_parent` FOREIGN KEY (`parent_sub_plan_id`)
      REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT;

-- 2. Candidate reasoning as structured pros/cons.
CREATE TABLE `option_pro_cons` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint(20) NOT NULL DEFAULT 0,
  `workspace_id` bigint(20) NOT NULL,
  `option_id` bigint(20) NOT NULL,
  `kind` varchar(4) NOT NULL,
  `content` varchar(500) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by_user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_option_pro_cons_option` (`option_id`),
  KEY `idx_option_pro_cons_workspace` (`workspace_id`),
  CONSTRAINT `fk_option_pro_cons_option` FOREIGN KEY (`option_id`) REFERENCES `options` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_pro_cons_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_pro_cons_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Retire the rating model.
DROP TABLE IF EXISTS `option_ratings`;

-- 4. Retire child-plan linkage (test data only; existing children become top-level plans).
ALTER TABLE `plans` DROP FOREIGN KEY `fk_plans_parent`;
ALTER TABLE `plans` DROP COLUMN `parent_plan_id`;
```

- [ ] **Step 2: Delete rating code + retired code + retired tests**

Delete the 4 rating files and the 6 test classes listed above. Then remove from the codebase (grep to find every reference — the exploration listed them):

*PlanService.kt* — remove:
- constructor param `optionRatingRepository: OptionRatingRepository`
- `getHierarchy(...)` method + any private helpers only it uses
- `promoteSubPlan(...)` method
- the `childCount` roll-up in `summariesOf` (the `findAllByParentPlanIdInAndDeletedAtIsNull(...).groupingBy{}.eachCount()` block) and the `childCount` param on `toSummary` + `summaryOf`'s childCount line
- all `optionRatingRepository` usages in `getTree`, `deleteOption`, `deleteSubPlan`, `purgeSinglePlan`
- `Option.toResponse(ratings, votes)` → make it votes-only: `Option.toResponse(votes)` returning `OptionResponse(id, title, description, sortOrder, voterUserIds = votes.map{it.userId})` (proCons added in Task 3 — for now omit)
- `purgeSubtree`/child-plan recursion via `findAllByParentPlanId` (parent_plan_id gone) — `purgeSinglePlan` no longer needs subtree recursion for child plans; keep the single-plan purge (Task 4 revisits nested-안건 comment purge)

*Plan.kt* — remove the `parentPlanId` field.
*PlanRepository.kt* — remove `findAllByParentPlanId`, `findAllByParentPlanIdInAndDeletedAtIsNull`, and (if present) the `...ParentPlanIdIsNull...` root-filter method; restore `list`/`listCompleted` to the plain `findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc` (all plans are roots now).
*DecisionDto.kt* — remove `RateOptionRequest`, `RatingResponse`, `PlanHierarchyNode`, `PlanHierarchyResponse`, `childCount` from `PlanSummaryResponse`, `parentPlanId` from `PlanSummaryResponse` + `PlanTreeResponse`, `parentPlanId` from `CreatePlanRequest`, and `avgScore`/`ratingCount`/`ratings` from `OptionResponse`.
*PlanController.kt* — remove `GET /{planId}/hierarchy`; remove `parentPlanId` handling from create.
*SubPlanController.kt* — remove `POST /{subPlanId}/promote`.
*PlanEnums.kt* — remove `SUBDECISION_ADDED`, `SUBDECISION_REMOVED`, `SUBPLAN_PROMOTED` from `PlanEventType`.
*OptionRepository.kt* — remove `repointAllBySubPlanId` (promote-only).
*OptionVoteRepository.kt* — remove `repointAllBySubPlanId` (promote-only).

- [ ] **Step 3: Fix compile/assertion breakage in surviving tests**

Compile: `./gradlew compileTestKotlin`. For each error, fix the surviving test:
- Tests asserting `avgScore`/`ratingCount`/`ratings`/`RatingResponse` on options → remove those assertions (keep vote assertions).
- Tests calling `service.create(... parentPlanId=...)` → drop the arg.
- Tests asserting `PlanSummaryResponse.childCount`/`.parentPlanId` → remove.
- `DecisionChangeCoverageTest` — if it references rating publish, drop that case.
- If a whole test's purpose was a removed feature and it's not in the delete-list, delete it too (note it in your report).

- [ ] **Step 4: Run the suite**

Run: `./gradlew test`
Expected: PASS (green surviving suite). If Flyway fails on `test` profile, the migration is malformed — fix the SQL (the `test` profile recreates `shared_docs_test` from all migrations).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(decisions): V25 + teardown of rating, hierarchy, promote, childCount, parent_plan_id"
```

---

### Task 2: Nested 안건 + `GET /api/subplans/{id}` detail

**Files:**
- Modify: `SubPlan.kt`, `SubPlanRepository.kt`, `DecisionDto.kt`, `PlanService.kt`, `PlanController.kt`(tree), `SubPlanController.kt`, `PlanEventRecorder` usage
- Test: `src/test/kotlin/com/shareddocs/backend/decision/NestedSubPlanTest.kt`

**Interfaces:**
- Consumes: Task 1's V25 `sub_plans.parent_sub_plan_id`.
- Produces: `SubPlan.parentSubPlanId: Long?`; `CreateSubPlanRequest.parentSubPlanId: Long?`; `SubPlanRepository.findAllByParentSubPlanId(id)`, `.findAllByParentSubPlanIdIn(ids)`; `SubPlanResponse.parentSubPlanId: Long?` + `.childSubPlanCount: Int`; `SubPlanDetailResponse`; `PlanService.getSubPlanDetail(workspaceId, subPlanId): SubPlanDetailResponse`; `SubPlanController` `GET /api/subplans/{subPlanId}`. Task 3 adds `proCons` into these responses; Task 4 handles nested comment purge.

- [ ] **Step 1: Write failing tests**

Create `NestedSubPlanTest.kt` (scaffold like `SubPlanServiceTest`: `@SpringBootTest @ActiveProfiles("test") @Transactional`, inject `PlanService`, `WorkspaceService`, `UserRepository`, `PlanEventRepository`; `newUser()` helper):

```kotlin
    @Test
    fun `create a nested 안건 under a parent 안건 in the same plan`() {
        val owner = newUser(); val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val parent = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "브랜드"))
        val child = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "국산 vs 수입", parentSubPlanId = parent.id))
        assertEquals(parent.id, child.parentSubPlanId)
        // top-level tree lists only parent (child is nested)
        val tree = service.getTree(ws.id!!, plan.id)
        assertEquals(listOf(parent.id), tree.subPlans.map { it.id })
        assertEquals(1, tree.subPlans.first().childSubPlanCount)
    }

    @Test
    fun `nested 안건 parent must be in the same plan`() {
        val owner = newUser(); val ws = workspaces.create(owner.id!!, "W", "w")
        val planA = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "A"))
        val planB = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "B"))
        val parentInB = service.addSubPlan(ws.id!!, planB.id, owner.id!!, CreateSubPlanRequest(title = "x"))
        assertThrows(SubPlanNotFoundException::class.java) {
            service.addSubPlan(ws.id!!, planA.id, owner.id!!, CreateSubPlanRequest(title = "y", parentSubPlanId = parentInB.id))
        }
    }

    @Test
    fun `getSubPlanDetail returns the 안건, its options, direct children, and ancestor chain`() {
        val owner = newUser(); val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val root = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "브랜드"))
        val mid = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "국산", parentSubPlanId = root.id))
        service.addOption(ws.id!!, mid.id, owner.id!!, CreateOptionRequest(title = "현대"))
        val leaf = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "세부", parentSubPlanId = mid.id))

        val detail = service.getSubPlanDetail(ws.id!!, mid.id)
        assertEquals(mid.id, detail.id)
        assertEquals(listOf("현대"), detail.options.map { it.title })
        assertEquals(listOf(leaf.id), detail.children.map { it.id })
        assertEquals(listOf(root.id), detail.ancestorIds)   // root first, direct parent last
        assertEquals(plan.id, detail.planId)
    }

    @Test
    fun `deleting a 안건 cascades to its nested 안건`() {
        val owner = newUser(); val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val parent = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "브랜드"))
        val child = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "국산", parentSubPlanId = parent.id))
        service.deleteSubPlan(ws.id!!, parent.id)
        assertThrows(SubPlanNotFoundException::class.java) { service.getSubPlanDetail(ws.id!!, child.id) }
        assertEquals(emptyList<Long>(), service.getTree(ws.id!!, plan.id).subPlans.map { it.id })
    }
```

- [ ] **Step 2: Run → fail**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.NestedSubPlanTest"` → COMPILE FAIL (`parentSubPlanId` unresolved, `getSubPlanDetail` unresolved).

- [ ] **Step 3: Implement**

*SubPlan.kt* — add:
```kotlin
    @Column(name = "parent_sub_plan_id", updatable = false)
    val parentSubPlanId: Long? = null,
```
(place after `planId`; nullable, immutable — no re-parenting.)

*SubPlanRepository.kt* — add:
```kotlin
    fun findAllByParentSubPlanId(parentSubPlanId: Long): List<SubPlan>
    fun findAllByParentSubPlanIdIn(parentSubPlanIds: Collection<Long>): List<SubPlan>
```

*DecisionDto.kt*:
- `CreateSubPlanRequest` gains `val parentSubPlanId: Long? = null`.
- `SubPlanResponse` gains `val parentSubPlanId: Long?` and `val childSubPlanCount: Int` (after `status`).
- Add:
```kotlin
data class SubPlanDetailResponse(
    val id: Long,
    val planId: Long,
    val parentSubPlanId: Long?,
    val title: String,
    val description: String?,
    val deadline: LocalDate?,
    val status: SubPlanStatus,
    val options: List<OptionResponse>,
    val decision: DecisionResponse?,
    val children: List<SubPlanResponse>,   // direct child 안건 (each with childSubPlanCount)
    val ancestorIds: List<Long>,           // root first, direct parent last
    val planTitle: String,
    val locked: Boolean,
)
```

*PlanService.kt*:
1. `addSubPlan` — accept `parentSubPlanId`, validate same-plan+workspace, pass through:
```kotlin
    fun addSubPlan(workspaceId: Long, planId: Long, actorUserId: Long, request: CreateSubPlanRequest): SubPlanResponse {
        val plan = requirePlan(workspaceId, planId)
        lockGuard.assertUnlocked(plan)
        request.parentSubPlanId?.let { pid ->
            val parent = subPlanRepository.findByIdAndWorkspaceId(pid, workspaceId) ?: throw SubPlanNotFoundException()
            if (parent.planId != planId) throw SubPlanNotFoundException()
        }
        // sortOrder scoped to siblings (same parent within the plan):
        val siblings = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
            .filter { it.parentSubPlanId == request.parentSubPlanId }
        val nextOrder = siblings.maxOfOrNull { it.sortOrder + 1 } ?: 0
        val subPlan = subPlanRepository.save(
            SubPlan(
                workspaceId = workspaceId, planId = planId,
                parentSubPlanId = request.parentSubPlanId,
                title = request.title.trim(), description = request.description?.trim(),
                sortOrder = nextOrder, createdByUserId = actorUserId,
            ),
        )
        events.record(workspaceId = workspaceId, planId = planId, subPlanId = subPlan.id,
            type = PlanEventType.SUBPLAN_ADDED, actorUserId = actorUserId,
            payload = mapOf("subPlanTitle" to subPlan.title,
                            "parentSubPlanId" to request.parentSubPlanId?.toString()))
        changes.publish(workspaceId, planId)
        return subPlan.toResponse(options = emptyList(), decision = null, childSubPlanCount = 0)
    }
```
2. `SubPlan.toResponse` — add `childSubPlanCount: Int` param + set `parentSubPlanId = parentSubPlanId`, `childSubPlanCount = childSubPlanCount` on `SubPlanResponse`.
3. `getTree` — top-level only + child counts (no N+1):
   - after loading `subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)`, split: `topLevel = subPlans.filter { it.parentSubPlanId == null }`; `childCountByParent = subPlans.filter { it.parentSubPlanId != null }.groupingBy { it.parentSubPlanId!! }.eachCount()`.
   - build option/vote/decision maps as today but only for `topLevel` ids (options belong to a 안건; top-level 안건 may still have options). Map each `topLevel` sp → `sp.toResponse(options=..., decision=..., childSubPlanCount = childCountByParent[sp.id] ?: 0)`.
   - `PlanTreeResponse.subPlans = topLevelResponses`.
4. `deleteSubPlan` — cascade to nested 안건 first (depth-first), reusing the existing per-안건 cleanup for each:
```kotlin
    fun deleteSubPlan(workspaceId: Long, subPlanId: Long) {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        lockGuard.assertUnlockedByPlanId(subPlan.planId)
        deleteSubPlanCascade(subPlan)
        changes.publish(workspaceId, subPlan.planId)
    }
    private fun deleteSubPlanCascade(subPlan: SubPlan) {
        subPlanRepository.findAllByParentSubPlanId(subPlan.id!!).forEach { deleteSubPlanCascade(it) }
        // existing per-안건 teardown (edges, decisions, votes, options), minus the ratings line removed in Task 1:
        subPlanEdgeRepository.deleteAll(subPlanEdgeRepository.findAllBySourceSubPlanIdOrTargetSubPlanId(subPlan.id!!, subPlan.id!!))
        val options = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlan.id!!)
        decisionRepository.deleteAll(decisionRepository.findAllBySubPlanId(subPlan.id!!))
        optionVoteRepository.deleteAllBySubPlanId(subPlan.id!!)
        optionRepository.deleteAll(options)
        subPlanRepository.delete(subPlan)
    }
```
(Task 3 adds pro/con cleanup here; Task 4 adds subplan:/option: comment cleanup.)
5. Add `getSubPlanDetail`:
```kotlin
    @Transactional(readOnly = true)
    fun getSubPlanDetail(workspaceId: Long, subPlanId: Long): SubPlanDetailResponse {
        val sp = subPlanRepository.findByIdAndWorkspaceId(subPlanId, workspaceId) ?: throw SubPlanNotFoundException()
        val plan = planRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(sp.planId, workspaceId) ?: throw SubPlanNotFoundException()
        val allInPlan = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(sp.planId)
        val byId = allInPlan.associateBy { it.id!! }
        val childCountByParent = allInPlan.filter { it.parentSubPlanId != null }.groupingBy { it.parentSubPlanId!! }.eachCount()

        // ancestors: walk parentSubPlanId to root
        val ancestors = mutableListOf<Long>()
        var cursorParent = sp.parentSubPlanId
        val seen = mutableSetOf(sp.id!!)
        while (cursorParent != null && seen.add(cursorParent)) {
            ancestors.add(0, cursorParent)
            cursorParent = byId[cursorParent]?.parentSubPlanId
        }

        val options = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId)
        val optionIds = options.mapNotNull { it.id }
        val votesByOption = if (optionIds.isEmpty()) emptyMap() else optionVoteRepository.findAllByOptionIdIn(optionIds).groupBy { it.optionId }
        val decision = decisionRepository.findFirstBySubPlanIdAndSupersededAtIsNull(subPlanId)
        val children = allInPlan.filter { it.parentSubPlanId == sp.id }
            .map { it.toResponse(options = emptyList(), decision = null, childSubPlanCount = childCountByParent[it.id] ?: 0) }

        return SubPlanDetailResponse(
            id = sp.id!!, planId = sp.planId, parentSubPlanId = sp.parentSubPlanId,
            title = sp.title, description = sp.description, deadline = sp.deadline,
            status = subPlanStatus(options.size, decision != null),
            options = options.map { it.toResponse(votes = votesByOption[it.id] ?: emptyList()) },
            decision = decision?.toResponse(),
            children = children,
            ancestorIds = ancestors,
            planTitle = plan.title,
            locked = plan.lockedAt != null,
        )
    }
```

*SubPlanController.kt* — add:
```kotlin
    @GetMapping("/{subPlanId}")
    fun detail(@CurrentWorkspace ws: Workspace, @PathVariable subPlanId: Long): SubPlanDetailResponse =
        service.getSubPlanDetail(ws.id!!, subPlanId)
```

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.NestedSubPlanTest"` → PASS (4).
Run: `./gradlew test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(decisions): nested 안건 (parent_sub_plan_id) + GET /api/subplans/{id} detail"
```

---

### Task 3: 장점/단점 (option_pro_cons) CRUD + in responses

**Files:**
- Create: `OptionProCon.kt`, `OptionProConRepository.kt`, `OptionProConController.kt`, `OptionProConService.kt`
- Modify: `DecisionDto.kt` (OptionResponse gains `proCons`; add request DTOs), `PlanService.kt` (`Option.toResponse` + tree/detail carry proCons; purge cleanup), `PlanEnums.kt` (`PROCON_ADDED`,`PROCON_REMOVED`), `DecisionExceptions.kt` (`ProConNotFoundException`, `ProConForbiddenException`)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/OptionProConServiceTest.kt`

**Interfaces:**
- Consumes: Task 1's `option_pro_cons` table; Task 2's `getSubPlanDetail`/`getTree` option mapping.
- Produces: `OptionProCon` entity; `OptionProConRepository.findAllByOptionIdOrderByKindAscSortOrderAscIdAsc(optionId)`, `.findAllByOptionIdIn(ids)`; `OptionResponse.proCons: List<ProConResponse>`; `ProConResponse(id, kind, content, createdByUserId)`; `OptionProConService.add/delete`; routes `POST /api/options/{optionId}/procons`, `DELETE /api/procons/{id}`.

- [ ] **Step 1: Write failing tests**

`OptionProConServiceTest.kt` (scaffold like `VoteServiceTest`: inject `PlanService` + the new `OptionProConService` + `WorkspaceService`+`UserRepository`+`PlanEventRepository`; helper to create plan→안건→option):

```kotlin
    @Test
    fun `add pros and cons then read them back on the option`() {
        val (ws, owner, sp) = seed()   // helper: workspace, owner, a 안건
        val opt = service.addOption(ws, sp, owner, CreateOptionRequest(title = "현대"))
        proCons.add(ws, opt.id, owner, CreateProConRequest(kind = ProConKind.PRO, content = "유지비 저렴"))
        proCons.add(ws, opt.id, owner, CreateProConRequest(kind = ProConKind.CON, content = "감가율 큼"))
        val detail = service.getSubPlanDetail(ws, sp)
        val pcs = detail.options.first { it.id == opt.id }.proCons
        assertEquals(setOf("PRO:유지비 저렴", "CON:감가율 큼"), pcs.map { "${it.kind}:${it.content}" }.toSet())
    }

    @Test
    fun `pro-con add is blocked on a locked plan`() { /* lock the plan, expect PlanLockedException */ }

    @Test
    fun `a non-author non-owner member cannot delete another member's pro-con`() { /* expect ProConForbiddenException */ }

    @Test
    fun `add and delete record PROCON_ADDED and PROCON_REMOVED`() { /* assert event types on the plan */ }
```
(Write the 4 bodies out in full following `VoteServiceTest`/`PlanResourceServiceTest` idioms — lock via `service.lock(ws, planId, owner)`; second member via `workspaces.joinAsMember(ws, other)`; events via `planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(planId)`.)

- [ ] **Step 2: Run → fail** (`OptionProConService` unresolved).

- [ ] **Step 3: Implement**

`OptionProCon.kt`:
```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.*

enum class ProConKind { PRO, CON }

@Entity
@Table(name = "option_pro_cons",
    indexes = [
        Index(name = "idx_option_pro_cons_option", columnList = "option_id"),
        Index(name = "idx_option_pro_cons_workspace", columnList = "workspace_id"),
    ])
class OptionProCon(
    @Column(name = "workspace_id", nullable = false, updatable = false) val workspaceId: Long,
    @Column(name = "option_id", nullable = false, updatable = false) val optionId: Long,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 4, updatable = false) val kind: ProConKind,
    @Column(nullable = false, length = 500) var content: String,
    @Column(name = "sort_order", nullable = false) var sortOrder: Int = 0,
    @Column(name = "created_by_user_id", nullable = false, updatable = false) val createdByUserId: Long,
) : BaseEntity()
```

`OptionProConRepository.kt`:
```kotlin
interface OptionProConRepository : JpaRepository<OptionProCon, Long> {
    fun findAllByOptionIdOrderByKindAscSortOrderAscIdAsc(optionId: Long): List<OptionProCon>
    fun findAllByOptionIdIn(optionIds: Collection<Long>): List<OptionProCon>
    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): OptionProCon?
}
```

`DecisionDto.kt` — add + amend:
```kotlin
data class ProConResponse(val id: Long, val kind: ProConKind, val content: String, val createdByUserId: Long)
data class CreateProConRequest(val kind: ProConKind, @field:NotBlank @field:Size(max = 500) val content: String)
```
`OptionResponse` gains `val proCons: List<ProConResponse>` (after `voterUserIds`).

`DecisionExceptions.kt` — add:
```kotlin
class ProConNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "procon-not-found", "Pro/con not found", "장단점을 찾을 수 없어요.")
class ProConForbiddenException :
    ApiException(HttpStatus.FORBIDDEN, "procon-forbidden", "Not allowed", "작성자 또는 계획 생성자만 삭제할 수 있어요.")
```

`PlanEnums.kt` — add `PROCON_ADDED`, `PROCON_REMOVED`.

`OptionProConService.kt`:
```kotlin
@Service
@Transactional
class OptionProConService(
    private val proCons: OptionProConRepository,
    private val optionRepository: OptionRepository,
    private val subPlanRepository: SubPlanRepository,
    private val planRepository: PlanRepository,
    private val lockGuard: PlanLockGuard,
    private val events: PlanEventRecorder,
    private val changes: DecisionChangePublisher,
) {
    fun add(workspaceId: Long, optionId: Long, actorUserId: Long, request: CreateProConRequest): ProConResponse {
        val option = optionRepository.findByIdAndWorkspaceId(optionId, workspaceId) ?: throw OptionNotFoundException()
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
        val nextOrder = proCons.findAllByOptionIdOrderByKindAscSortOrderAscIdAsc(optionId)
            .filter { it.kind == request.kind }.maxOfOrNull { it.sortOrder + 1 } ?: 0
        val saved = proCons.save(OptionProCon(
            workspaceId = workspaceId, optionId = optionId, kind = request.kind,
            content = request.content.trim(), sortOrder = nextOrder, createdByUserId = actorUserId,
        ))
        val (planId, subPlanId) = planAndSubPlanOf(option)
        events.record(workspaceId, planId, subPlanId, PlanEventType.PROCON_ADDED, actorUserId,
            mapOf("kind" to request.kind.name, "content" to saved.content))
        changes.publish(workspaceId, planId)
        return ProConResponse(saved.id!!, saved.kind, saved.content, saved.createdByUserId)
    }

    fun delete(workspaceId: Long, proConId: Long, actorUserId: Long, actorRole: Role) {
        val pc = proCons.findByIdAndWorkspaceId(proConId, workspaceId) ?: throw ProConNotFoundException()
        val option = optionRepository.findByIdAndWorkspaceId(pc.optionId, workspaceId) ?: throw OptionNotFoundException()
        lockGuard.assertUnlockedBySubPlanId(option.subPlanId)
        val (planId, subPlanId) = planAndSubPlanOf(option)
        val plan = planRepository.findByIdAndWorkspaceId(planId, workspaceId)
        val isAuthor = pc.createdByUserId == actorUserId
        val isOwner = plan?.createdByUserId == actorUserId
        if (!isAuthor && !isOwner && !actorRole.isAtLeastAdmin()) throw ProConForbiddenException()
        proCons.delete(pc)
        events.record(workspaceId, planId, subPlanId, PlanEventType.PROCON_REMOVED, actorUserId,
            mapOf("kind" to pc.kind.name, "content" to pc.content))
        changes.publish(workspaceId, planId)
    }

    private fun planAndSubPlanOf(option: Option): Pair<Long, Long> {
        val sp = subPlanRepository.findById(option.subPlanId).orElseThrow { SubPlanNotFoundException() }
        return sp.planId to sp.id!!
    }
}
```
(Uses `Role` from `com.shareddocs.backend.user.Role`; `OptionNotFoundException` exists. If `Option` isn't importable by simple name in this file's package, it's same-package `com.shareddocs.backend.decision.Option`.)

`OptionProConController.kt`:
```kotlin
@RestController
@RequestMapping("/api")
class OptionProConController(private val service: OptionProConService) {
    @PostMapping("/options/{optionId}/procons")
    fun add(@CurrentWorkspace ws: Workspace, @AuthenticationPrincipal me: AppPrincipal,
            @PathVariable optionId: Long, @Valid @RequestBody request: CreateProConRequest): ResponseEntity<ProConResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.add(ws.id!!, optionId, me.userId, request))

    @DeleteMapping("/procons/{proConId}")
    fun delete(@CurrentWorkspace ws: Workspace, @AuthenticationPrincipal me: AppPrincipal,
               @PathVariable proConId: Long): ResponseEntity<Void> {
        service.delete(ws.id!!, proConId, me.userId, me.role); return ResponseEntity.noContent().build()
    }
}
```

`PlanService.kt` — thread proCons into option responses (batch, no N+1):
- Inject `optionProConRepository: OptionProConRepository`.
- `Option.toResponse(votes, proCons)` → set `proCons = proCons.map { ProConResponse(it.id!!, it.kind, it.content, it.createdByUserId) }`.
- In `getTree` and `getSubPlanDetail`, after loading options, load `proConsByOption = optionProConRepository.findAllByOptionIdIn(optionIds).groupBy { it.optionId }` (order preserved by the repo's default; sort within group by kind/sortOrder in the mapper if needed) and pass `proCons = proConsByOption[it.id] ?: emptyList()`.
- In `deleteSubPlanCascade` (Task 2) and any option-delete path: after loading `options`, delete their pro/cons: `optionProConRepository.deleteAll(optionProConRepository.findAllByOptionIdIn(optionIds))` BEFORE `optionRepository.deleteAll(options)` (FK RESTRICT — pros/cons reference options).

- [ ] **Step 4: Run tests** → focused PASS (4), full `./gradlew test` PASS.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(decisions): 장점/단점 (option_pro_cons) CRUD + in tree/detail responses"
```

---

### Task 4: Comment realtime + purge for subplan:/option: pages

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/comment/CommentService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (`purgeSinglePlan` comment cleanup)
- Modify: `src/main/kotlin/com/shareddocs/backend/comment/CommentRepository.kt` (bulk delete already exists from Phase 2: `deleteAllByWorkspaceIdAndPageId`)
- Test: extend `src/test/kotlin/com/shareddocs/backend/decision/DecisionChangeCoverageTest.kt` + `PlanResourcePurgeTest.kt` (or a new `DecisionCommentPurgeTest`)

**Interfaces:**
- Consumes: Task 2 (nested subplans), Task 3.
- Produces: `CommentService` fires the decisions change-signal for `subplan:{id}` and `option:{id}` pages too; `purgeSinglePlan` deletes every `subplan:{id}` and `option:{id}` comment thread under the plan.

- [ ] **Step 1: Write failing tests**

Extend `DecisionChangeCoverageTest` (it already has a `commentService` + `Recorder`):
```kotlin
    @Test
    fun `comments on subplan and option pages publish the change signal`() {
        val owner = user(); val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = planService.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "s"))
        val opt = planService.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "o"))
        recorder.events.clear()
        commentService.create(CreateCommentRequest(pageId = "subplan:${sp.id}", content = "hi"), ws.id!!, owner.id!!)
        assertEquals(1, recorder.events.size); assertEquals(plan.id, recorder.events.single().planId)
        recorder.events.clear()
        commentService.create(CreateCommentRequest(pageId = "option:${opt.id}", content = "hi"), ws.id!!, owner.id!!)
        assertEquals(1, recorder.events.size); assertEquals(plan.id, recorder.events.single().planId)
    }
```
New `DecisionCommentPurgeTest` (or extend `PlanResourcePurgeTest`):
```kotlin
    @Test
    fun `permanently deleting a plan purges its subplan and option comment threads`() {
        // seed plan → 안건 → option; add comments on plan:/subplan:/option: pages;
        // discard + deleteForever; assert all three threads empty via
        // comments.findByWorkspaceIdAndPageIdOrderByCreatedAtAsc(ws, "subplan:${sp.id}") == emptyList(), etc.
    }
```
(Write both bodies in full following the existing `DecisionChangeCoverageTest`/`PlanResourcePurgeTest` idioms.)

- [ ] **Step 2: Run → fail** (subplan/option comments don't publish; purge leaves them).

- [ ] **Step 3: Implement**

*CommentService.kt* — extend the publish matcher to resolve a planId from any of the three page kinds:
```kotlin
    private fun publishIfDecisionPage(workspaceId: Long, pageId: String) {
        val planId = resolvePlanId(pageId) ?: return
        changes.publish(workspaceId, planId)
    }
    private fun resolvePlanId(pageId: String): Long? {
        PLAN_PAGE.matchEntire(pageId)?.let { return it.groupValues[1].toLongOrNull() }
        SUBPLAN_PAGE.matchEntire(pageId)?.let {
            val spId = it.groupValues[1].toLongOrNull() ?: return null
            return subPlanRepository.findById(spId).map { sp -> sp.planId }.orElse(null)
        }
        OPTION_PAGE.matchEntire(pageId)?.let {
            val optId = it.groupValues[1].toLongOrNull() ?: return null
            val subPlanId = optionRepository.findById(optId).map { o -> o.subPlanId }.orElse(null) ?: return null
            return subPlanRepository.findById(subPlanId).map { sp -> sp.planId }.orElse(null)
        }
        return null
    }
    companion object {
        private val PLAN_PAGE = Regex("^plan:(\\d+)$")
        private val SUBPLAN_PAGE = Regex("^subplan:(\\d+)$")
        private val OPTION_PAGE = Regex("^option:(\\d+)$")
    }
```
Rename the three call sites from `publishIfPlanPage` → `publishIfDecisionPage`. Inject `SubPlanRepository` + `OptionRepository` (cross-package import from `com.shareddocs.backend.decision`) into `CommentService`.

*PlanService.purgeSinglePlan* — after loading the plan's subplans (now: all subplans in the plan, nested included) and their options, delete comment threads:
```kotlin
    val allSubPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(plan.id!!)
    val allOptionIds = /* options across allSubPlans */ ...
    commentRepository.deleteAllByWorkspaceIdAndPageId(plan.workspaceId, "plan:${plan.id}")
    allSubPlans.forEach { commentRepository.deleteAllByWorkspaceIdAndPageId(plan.workspaceId, "subplan:${it.id}") }
    allOptions.forEach  { commentRepository.deleteAllByWorkspaceIdAndPageId(plan.workspaceId, "option:${it.id}") }
```
(Fold into the existing purge; keep FK-safe ordering — comments have no FK to these, so order among them is free.)

- [ ] **Step 4: Run tests** → focused PASS, full `./gradlew test` PASS.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(decisions): comment realtime + purge for subplan:/option: pages"
```

---

### Task 5: Frontend types + api (teardown + additions)

**Files:**
- Modify: `src/features/decisions/types.ts`, `src/features/decisions/api.ts`, `src/features/decisions/StoryView.tsx`, `src/features/decisions/formatPlanEvent.tsx`

**Interfaces:**
- Consumes: BE Tasks 1–3 response shapes.
- Produces: trimmed types (no `Rating`/`PlanHierarchy*`/`childCount`/`parentPlanId`); `SubPlanNode` gains `parentSubPlanId: number | null` + `childSubPlanCount: number`; `OptionNode` loses `avgScore/ratingCount/ratings`, gains `proCons: ProCon[]`; new `SubPlanDetail` type; new hooks `useSubPlanDetail(subPlanId)`, `useAddNestedSubPlan(planId)` (or extend `useAddSubPlan` to take `parentSubPlanId`), `useAddProCon(subPlanId)`, `useDeleteProCon(subPlanId)`; removed hooks `usePlanHierarchy`/`usePromoteSubPlan`/`useMovePlan`/`useRateOption`/`useDeleteRating`. Tasks 6–9 consume these.

- [ ] **Step 1: types.ts**

- Remove: `Rating` type; `avgScore`/`ratingCount`/`ratings` from `OptionNode`; `RatePayload`; `PlanHierarchyNode`/`PlanHierarchy`; `childCount`/`parentPlanId` from `PlanSummary`; `parentPlanId` from `PlanTree`; `parentPlanId` from `CreatePlanPayload`; `'SUBDECISION_ADDED'|'SUBDECISION_REMOVED'|'SUBPLAN_PROMOTED'` from `PlanEventType`.
- Add: `'PROCON_ADDED'|'PROCON_REMOVED'` to `PlanEventType`.
- `OptionNode` add `proCons: ProCon[]`; add:
```ts
export type ProConKind = 'PRO' | 'CON'
export type ProCon = { id: number; kind: ProConKind; content: string; createdByUserId: number }
```
- `SubPlanNode` add `parentSubPlanId: number | null` and `childSubPlanCount: number`.
- Add:
```ts
export type SubPlanDetail = {
  id: number; planId: number; parentSubPlanId: number | null
  title: string; description: string | null; deadline: string | null
  status: SubPlanStatus
  options: OptionNode[]; decision: DecisionInfo | null
  children: SubPlanNode[]; ancestorIds: number[]
  planTitle: string; locked: boolean
}
export type CreateSubPlanPayload = { title: string; description?: string; parentSubPlanId?: number }
export type CreateProConPayload = { kind: ProConKind; content: string }
```

- [ ] **Step 2: api.ts**

- Remove `decisionKeys.hierarchy`; add `subPlanDetail: (wsId, subPlanId) => ['decisions', wsId, 'subplan', subPlanId] as const`.
- Remove hooks: `usePlanHierarchy`, `usePromoteSubPlan`, `useMovePlan`, `useRateOption`, `useDeleteRating`.
- Change `useAddSubPlan(planId)` mutationFn to accept `CreateSubPlanPayload` (so `parentSubPlanId` flows) — POST body already forwards the payload; just widen the payload type. (Canvas variant `useAddSubPlanOnCanvas` stays for top-level adds.)
- Add:
```ts
export function useSubPlanDetail(subPlanId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.subPlanDetail(activeId, subPlanId),
    queryFn: async () => (await apiClient.get<SubPlanDetail>(`/api/subplans/${subPlanId}`)).data,
    enabled: activeId != null && Number.isFinite(subPlanId),
  })
}
export function useAddProCon(_subPlanId: number) {  // subPlanId only for scoping symmetry; invalidates whole scope
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { optionId: number; payload: CreateProConPayload }) =>
      (await apiClient.post(`/api/options/${v.optionId}/procons`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteProCon() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/procons/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```
(If `useAddProCon`'s `_subPlanId` param trips eslint no-unused, drop it — no param, matching the repo convention for scope-invalidating mutations. Decide at build time; keep signatures consistent with what Task 9 calls.)

- [ ] **Step 3: StoryView.tsx** — swap `childCount` → `subPlanCount` (lines ~51/64/72), relabel `하위결정 {n}` → `안건 {n}`, drop the `GitFork` import if now unused.

- [ ] **Step 4: formatPlanEvent.tsx** — remove the `SUBDECISION_ADDED/REMOVED`/`SUBPLAN_PROMOTED` cases from the `ICONS` map + copy switch; add `PROCON_ADDED` (icon `Plus`, copy `${actor}님이 장단점을 추가했어요`) and `PROCON_REMOVED` (icon `Minus`, copy `${actor}님이 장단점을 삭제했어요`). Keep the exhaustive `Record<PlanEventType, ...>` total.

- [ ] **Step 5: Gates + commit**

Run: `npx tsc -b --noEmit` (will FAIL until Tasks 6–9 remove the code that references dropped hooks/types — this is expected mid-rework). To keep this task independently green, ALSO do the minimal reference removals that only touch already-doomed lines is NOT possible without Task 6. **Therefore: run `npx eslint src/features/decisions/api.ts src/features/decisions/types.ts` for lint only, and defer the `tsc -b`/`build` gate to Task 6** (which removes the consumers). Note this explicitly in your report; commit the api/types/story/event changes now.

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts src/features/decisions/StoryView.tsx src/features/decisions/formatPlanEvent.tsx
git commit -m "refactor(decisions): FE types + api — drop rating/hierarchy/promote, add procon/subplan-detail"
```

*Controller note:* Tasks 5 and 6 are a matched pair — the branch does not typecheck between them. The reviewer of Task 5 reviews types/api correctness by inspection; the `tsc -b`/`build` green gate lands at the end of Task 6.

---

### Task 6: Delete Phase-1 components + strip PlanDetail + plan-page top-level 안건 list

**Files:**
- Delete: `src/features/decisions/{SubDecisionSection,SubDecisionCanvasNode,PlanTreeNavigator,RatingControl}.tsx` + their `.module.css`
- Modify: `src/features/decisions/PlanDetail.tsx` (+`.module.css`), `SubPlanSection.tsx`, `OptionRow.tsx` (remove rating only; keep vote), `PlanCanvas.tsx`, `App.tsx` (add detail route — Task 8 fills the component, but register a lazy import now so the route exists)

**Interfaces:**
- Consumes: Task 5 types/api.
- Produces: a compiling FE where the plan page lists **top-level 안건 only** as compact cards (click → detail route) with a foldable **서브안건** block per card; all Phase-1 child-plan UI + rating UI gone. Task 7 builds the foldable-tree specifics; Task 8 builds the detail page; Task 9 builds pros/cons UI. (To keep this task's deliverable crisp: here we STRIP + make it compile + render top-level 안건 as clickable cards + a placeholder foldable block; Tasks 7–9 flesh out.)

- [ ] **Step 1: Delete the 4 components** (and their CSS). `grep -rn "SubDecisionSection\|SubDecisionCanvasNode\|PlanTreeNavigator\|RatingControl" src/` → every hit is in PlanDetail/PlanCanvas/SubPlanSection/OptionRow (fixed below) or the deleted files themselves.

- [ ] **Step 2: PlanDetail.tsx strip**
Remove: `usePlanHierarchy` + `hierarchyById`/`childPlans` derivations; `useCreatePlan`+`addingChild` child-plan modal; `useRateOption`/`useDeleteRating` (`rate`/`clearRating`) + their `busy` entries + `onRate`/`onClearRating` props in `renderSubPlan`; `usePromoteSubPlan` (`promote`) + `onPromote`; the breadcrumb `<nav>` block; the `SubDecisionSection` mount; the `PlanTreeNavigator` mount; `styles.zoomEnter` from the wrapper (keep `key={planId}`); the `childPlans` prop on `<PlanCanvas>`; simplify `BackLink` to `to="/decisions"`. Keep: 안건 list (top-level), `ResourceSection`, `Comments pageId={plan:...}`, `DiscussionPane`, view tabs, deadline, lifecycle.

**Change the 안건 list to top-level + click-through:** `renderSubPlan` now renders a compact card (Task 7 refines). Filter `tree.subPlans` — the BE already returns only top-level (Task 2), so no client filter needed; each card's primary click navigates: `navigate(\`/decisions/${planId}/subplans/${sp.id}\`)`. Options are NO LONGER rendered inline on the plan page (they move to the detail page) — so the plan-page card shows title + status + deadline + `선택지 N` + 💬 counts + a foldable 서브안건 block (Task 7).

- [ ] **Step 3: SubPlanSection.tsx** — remove `onRate`/`onClearRating`/`onPromote` props; remove the `GitFork` import + the promote `IconButton`; remove the inline `OptionRow` list + the 선택지 추가/결정하기 footer (those move to the detail page in Task 8). What remains on the plan page is the compact 안건 card (header: 안건 N, title, status Badge, DeadlineChip, edit/delete/connect actions) — the card body becomes a click target to the detail page + the foldable 서브안건 block (Task 7). *If this makes SubPlanSection mostly a card, that's fine — Task 7 may rename/replace it with a leaner `SubPlanCard`; for Task 6 just make it compile without options/rating/promote.*

- [ ] **Step 4: OptionRow.tsx** — remove `onRate`/`onClearRating` props, `RatingControl` import + mount, `myRating`/`others`/`avgScore`/`ratingCount` UI. Keep vote + voters + edit/delete. (OptionRow is now used only on the detail page in Task 8/9; keep it working.)

- [ ] **Step 5: PlanCanvas.tsx** — deregister the `subdecision` node: remove the import, the `subdecision` key in `nodeTypes`, `toChildNode`/`CanvasNode` union, `childPlans` prop, `useMovePlan`, and the `subdecision` branches in `onNodeDragStop`/`onNodeClick` + the `...childPlans.map(toChildNode)` seed. Keep the `subplan` node + edges + drag-persist.

- [ ] **Step 6: App.tsx** — add the lazy detail route inside the `DecisionsCollabBoundary`:
```tsx
const SubPlanDetail = lazy(() => import('./features/decisions/SubPlanDetail'))
...
<Route path="/decisions/:planId/subplans/:subPlanId" element={<SubPlanDetail />} />
```
Create a minimal `SubPlanDetail.tsx` stub (Task 8 fills it) that at least renders a `<Page>` with the breadcrumb-less title so the route compiles:
```tsx
export default function SubPlanDetail() { return <div /> }  // Task 8 implements
```

- [ ] **Step 7: Gates** — `npx tsc -b --noEmit` → clean (this is where the branch typechecks again); `npm run build` → success; `npx eslint src/features/decisions/` → no new errors.

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "refactor(decisions): delete Phase-1 components + rating UI; strip PlanDetail to top-level 안건 list"
```

---

### Task 7: Plan-page foldable 서브안건 tree

**Files:**
- Create: `src/features/decisions/SubPlanCard.tsx` (+`.module.css`) — the compact 안건 card + foldable child block (or refactor `SubPlanSection` into it; pick the lower-churn path and state which in the report)
- Modify: `PlanDetail.tsx` (render top-level 안건 via the card), `api.ts` if a nested-add helper is needed

**Interfaces:**
- Consumes: `SubPlanNode.parentSubPlanId`/`childSubPlanCount`, `useSubPlanDetail` NOT needed here (plan tree already carries top-level + counts; children are fetched lazily on expand via `useSubPlanDetail(parentId)` OR the plan tree is extended — SIMPLEST: fetch children on expand with `useSubPlanDetail(parentSubPlanId).children`).
- Produces: plan page shows top-level 안건 cards, each with a collapsible 서브안건 list (children as smaller cards, click → their detail page) + "+ 서브안건 추가".

- [ ] **Step 1: SubPlanCard** — a compact card: `안건 {index}` eyebrow, title (click → `/decisions/{planId}/subplans/{sp.id}`), status Badge, DeadlineChip (read-only here), `선택지`/💬 counts, and edit/delete/connect actions (moved from SubPlanSection). Below it, a foldable block (collapsed default; chevron toggles) that, when `childSubPlanCount > 0` or on expand, lists child 안건. Fetch children lazily: on expand, `useSubPlanDetail(sp.id)` → `.children` (already returns direct children with their own `childSubPlanCount`); render each child as a smaller `SubPlanCard` (recursion on the plan page is 1 level deep visually — deeper nesting is reached by navigating into detail pages). "+ 서브안건 추가" opens `TitleDescModal`; on submit → `useAddSubPlan(planId).mutate({ ...payload, parentSubPlanId: sp.id })`.

  CSS: dashed indented block (`border-left: 1px dashed var(--c-border-strong)`, `padding-left: var(--sp-4)`), matching the existing 연결-chips dashed idiom; no card lift.

- [ ] **Step 2: PlanDetail** — replace the DnD `SortableSubPlanSection` list with the `SubPlanCard` list (drag-reorder of top-level 안건 may stay via `@dnd-kit` wrapping `SubPlanCard`; if reorder is now lower value, keep it for top-level only — state the choice in the report). Keep the order-spine visual between top-level cards.

- [ ] **Step 3: Gates** — `tsc -b`/`build`/eslint green. Manual (`npm run dev`): plan page shows top-level 안건 as cards; a card with children shows a foldable 서브안건 list; expand → children appear; "+ 서브안건 추가" adds a child; clicking a card title goes to (stub) detail route.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat(decisions): plan page — top-level 안건 cards with foldable 서브안건 tree"
```

---

### Task 8: 안건 detail page (route + hub)

**Files:**
- Replace stub: `src/features/decisions/SubPlanDetail.tsx` (+`.module.css`)
- Reuse: `OptionRow`, `TitleDescModal`, `DecisionModal`, `SubPlanCard` (children), `Comments`, `DeadlineChip`

**Interfaces:**
- Consumes: `useSubPlanDetail(subPlanId)`, option/decision/vote hooks (`useAddOption`,`useUpdateOption`,`useDeleteOption`,`useCastVote`,`useRetractVote`,`useLockDecision`,`useReopenDecision`), `useAddSubPlan(planId)` (for child add), `useSetSubPlanDeadline`/`useClearSubPlanDeadline`.
- Produces: the recursive hub page — breadcrumb, 선택지 list (via OptionRow + 결정하기), foldable 서브안건 (via SubPlanCard), 안건 댓글.

- [ ] **Step 1: SubPlanDetail.tsx**
```tsx
export default function SubPlanDetail() {
  const { planId: planIdParam, subPlanId: subPlanIdParam } = useParams()
  const planId = Number(planIdParam); const subPlanId = Number(subPlanIdParam)
  const { data: detail, isLoading, isError } = useSubPlanDetail(subPlanId)
  const navigate = useNavigate()
  // option/decision/vote/deadline mutations (same hooks PlanDetail used)
  // modals: add/edit 선택지 (TitleDescModal), decide (DecisionModal), add 서브안건 (TitleDescModal)
  return (
    <Page>
      <PageHeader>
        <BackLink to={`/decisions/${planId}`} mobileOnly>결정</BackLink>
        {/* breadcrumb: 결정 › {planTitle} › {ancestors…titles} › {detail.title}.
            ancestor titles: fetch is avoided — show ids as links to /decisions/{planId}/subplans/{id};
            label each with its title by looking it up in a cheap map. SIMPLEST v1: breadcrumb shows
            결정 › {planTitle} › {detail.title} and each ancestor id as a generic "상위 안건" link,
            OR resolve titles by walking useSubPlanDetail on the direct parent only. Pick the SIMPLEST
            that shows the current + plan + direct-parent title; note the choice. */}
        <PageTitle>{detail?.title}</PageTitle>
        {/* status + DeadlineChip(editable when !locked && no decision) */}
      </PageHeader>
      {/* 선택지 section: detail.options.map(OptionRow ...) + 선택지 추가 + 결정하기/다시 열기 */}
      {/* 서브안건 section: detail.children.map(SubPlanCard) + 서브안건 추가 (parentSubPlanId = subPlanId) */}
      {/* 댓글: <Comments pageId={`subplan:${subPlanId}`} /> wrapped in the commentsSection chrome-strip */}
    </Page>
  )
}
```
Wire every option/decision/vote callback exactly as `PlanDetail`/`SubPlanSection` did (minus rating). `결정하기` opens `DecisionModal` with `detail.options`. Breadcrumb: to keep it simple and correct, render `결정 › {detail.planTitle} › {detail.title}` plus, if `detail.parentSubPlanId != null`, a `상위 안건` link to the parent's detail page (title resolved by the parent's own detail fetch is overkill — show the plan + current, and a single "↑ 상위 안건" affordance). *State the exact breadcrumb rendering you chose in the report.*

- [ ] **Step 2: CSS** — reuse the `commentsSection` `:global(.comments)` chrome-strip pattern from PlanDetail.module.css; section headings match the `.heading` idiom; foldable 서브안건 reuses SubPlanCard.

- [ ] **Step 3: Gates** — `tsc -b`/`build`/eslint green. Manual: click a 안건 on the plan page → detail page loads; add/edit/delete 선택지; vote; 결정하기 locks; add a 서브안건 → appears in the foldable block; click a child → its detail page (recursion); 댓글 posts.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat(decisions): 안건 detail page — recursive hub (선택지 + 서브안건 + 댓글)"
```

---

### Task 9: Candidate card — 장점/단점 + per-candidate 댓글

**Files:**
- Create: `src/features/decisions/ProConSection.tsx` (+`.module.css`)
- Modify: `OptionRow.tsx` (+`.module.css`) — mount 장점/단점 + candidate 댓글 in the expanded body

**Interfaces:**
- Consumes: `OptionNode.proCons`, `useAddProCon`/`useDeleteProCon`, `Comments` (pageId `option:{id}`).
- Produces: expanded candidate card shows 장점/단점 (add/remove lines) + 투표 (existing) + 댓글.

- [ ] **Step 1: ProConSection.tsx** — two columns (장점/단점). Each lists `proCons.filter(kind==='PRO'|'CON')` as short lines with a per-line delete (ConfirmDialog or inline ✕ → `useDeleteProCon().mutate(id)`), and a "+ 장점"/"+ 단점" inline add (a tiny input + enter → `useAddProCon().mutate({optionId, payload:{kind, content}})`). Props: `{ optionId: number; proCons: ProCon[]; locked: boolean }`. Hidden add/delete when `locked`. Tokens only; lucide `Plus`/`Minus` or `ThumbsUp`/`ThumbsDown` (pick the calmer; state which). No card lift.

- [ ] **Step 2: OptionRow.tsx** — in the expanded body, render `<ProConSection optionId={option.id} proCons={option.proCons} locked={!!locked} />` above the vote/voters block, and below it `<Comments pageId={\`option:${option.id}\`} />` wrapped in a chrome-strip div. Collapsed header adds small counts: `장단점 {proCons.length}` and keeps the vote count.

- [ ] **Step 3: Gates** — `tsc -b`/`build`/eslint green. Manual: expand a candidate → add a 장점 and a 단점 → they appear in the right columns; delete one; vote still works; post a candidate 댓글; on a locked plan the 장점/단점 add/delete + vote are hidden but 댓글 still works.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat(decisions): candidate card — 장점/단점 + per-candidate 댓글 (rating removed)"
```

---

### Task 10: Docs, full gates, deploy

**Files:** `CLAUDE.md` (FE); both repos push + verify.

- [ ] **Step 1: CLAUDE.md** — update the Decisions feature row + header: the Life Story Board child-plan sub-decision model (Phase 1) and the rating model are **retired**; sub-decisions are now **nested 안건** (`sub_plans.parent_sub_plan_id`, Flyway **V25**); every 안건 has a detail page; candidates use **장점/단점**; 댓글 at 계획/안건/선택지; 투표 kept. Note V25 drops `option_ratings` + `plans.parent_plan_id`. Cross-reference `docs/plans/2026-07-10-decisions-rework-{design,plan}.md`. Set "Flyway latest V25".

- [ ] **Step 2: Full gates** — BE `./gradlew test` green; FE `npx tsc -b --noEmit` + `npm run build` + `npx eslint src/features/decisions/` clean.

- [ ] **Step 3: Push + verify**
```bash
# backend first (FE reads new endpoints/fields)
cd shared-docs-backend && git push origin main
# then frontend
cd ../shared-docs && git add CLAUDE.md docs/plans/2026-07-10-decisions-rework-plan.md && git commit -m "docs: decisions rework shipped (V25)" && git push origin main
```
Verify BE (this machine is the CD runner): `docker logs shared-docs-backend 2>&1 | grep -i "version 25\|Started SharedDocs" | tail` → "Migrating … to version 25" + Started; `curl -s localhost:8090/actuator/health` → UP. **If CD build fails at the ~60s `DeadlineExceeded` base-image step, pre-pull `eclipse-temurin:17-jdk`/`17-jre` then empty-commit retrigger (the known Docker Hub timeout).** FE builds on Vercel.

- [ ] **Step 4: Manual smoke (user)** — nested 안건 fold/create under a parent; click 안건 → detail page; breadcrumb + child recursion; 장점/단점 add/remove; 투표; 결정하기; 댓글 at all three levels; locked plan freezes 장점/단점+투표 but not 댓글; story view dot-cluster now shows 안건 count; permanent-delete purges nested 안건 + all comment threads.
