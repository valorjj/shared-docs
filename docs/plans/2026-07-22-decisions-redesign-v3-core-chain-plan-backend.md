# Decisions Redesign v3 — Spec 1 Backend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax. This is the **backend** half of Spec 1; the frontend plan (the vertical spine UI) is a separate doc executed after this lands.

**Goal:** Reshape the Decisions backend for the new model — remove the lock layer, the free flow-edge/관련 DAG, comment pins, and the single-winner `Decision`; replace decisions with **per-후보 confirm** (multi, reversible, dated); drop dead canvas coordinates. Everything workspace-scoped, realtime via the existing change-signal, no locks.

**Architecture:** Layered Spring Boot + Kotlin + JPA/MariaDB, Flyway-owned schema (`ddl-auto: validate`). Each task pairs a forward Flyway migration (`V30`…`V34`) with its matching entity/code removal so every commit compiles and `validate` passes. Decisions data is wiped as a side effect of the drops (spec §5) — acceptable, decisions-only.

**Tech Stack:** Spring Boot 3.5, Kotlin, JPA/Hibernate 6, MariaDB (:3307), Flyway. Tests via `./gradlew`.

## Global Constraints

- **Flyway forward-only, one new migration file per task**, numbered from **V30** (latest is V29). Never edit an applied migration. Each task's migration + code changes land together so `ddl-auto: validate` passes at that commit.
- **No lock.** The lock layer is being deleted; do NOT add new lock gates. After BE-1 there is no `PlanLockGuard`.
- Errors use RFC-7807 `ApiException(status, code, title, detail)` (4-arg) — match existing sibling exceptions.
- Every query is workspace-scoped (`@CurrentWorkspace ws`, `ws.id!!`). Writes publish `DecisionChangePublisher.publish(workspaceId, planId)` AFTER_COMMIT.
- Portfolio engineering bar: FK constraints, `@Version` optimistic locking on `BaseEntity`, RFC-7807.
- Gate per task: `./gradlew build` (compile + full test suite + `validate`) green. Fix or delete tests that reference removed features.
- Decisions-only scope: never touch note/sheet/calendar/calc/workspace tables or code.

## File map (backend)

- **Delete outright:** `PlanLockGuard.kt`; `OptionFlowEdge.kt`/`…Controller`/`…Repository`/`…Service`; `SubPlanEdge.kt`/`SubPlanEdgeRepository.kt`; `EdgeController.kt`/`EdgeService.kt` (관련 edges); `CommentPin.kt`/`…Controller`/`…Repository`/`…Service`; `Decision.kt`/`DecisionRepository.kt`/`DecisionService.kt`/`DecisionController.kt` (and Decision bits of `DecisionMappers.kt`).
- **Modify:** `Plan.kt` (drop `lockedAt`), `Option.kt` (drop canvas coords, add confirm fields), `SubPlan.kt` (drop canvas coords), `PlanController.kt` (drop lock/unlock), `PlanService.kt` (drop lock/edges/pins/decision from `getTree` + purge), `OptionController.kt` (add confirm/revoke), `DecisionDto.kt` (DTO reshape), `PlanEnums.kt` (event types), `VoteService.kt` (drop decided/lock coupling), and every service still calling `lockGuard.assert*` (`EdgeService`→deleted, `OptionProConService`, `OptionResourceService`, `PlanResourceService`, `PlanDiscussionService`, `CommentPinService`→deleted, `DecisionService`→deleted).
- **Migrations (new):** `V30__drop_plan_lock.sql`, `V31__drop_edges.sql`, `V32__drop_comment_pins.sql`, `V33__decision_to_option_confirm.sql`, `V34__drop_canvas_coords.sql`.

---

### Task BE-1: Remove the lock layer (V30)

**Files:** Create `db/migration/V30__drop_plan_lock.sql`; delete `PlanLockGuard.kt`; modify `Plan.kt`, `PlanController.kt`, `PlanRepository.kt`, `DecisionDto.kt`, and every service injecting/calling `PlanLockGuard` (grep list from inventory: `OptionProConService`, `OptionResourceService`, `PlanResourceService`, `PlanDiscussionService`, `VoteService`, plus the soon-to-be-deleted `EdgeService`/`DecisionService`/`CommentPinService`/`OptionFlowEdgeService` — for those about-to-die files, leave them for their own task).

- [ ] **Migration** — `V30__drop_plan_lock.sql`:
```sql
ALTER TABLE plans DROP COLUMN locked_at;
```
- [ ] Remove `lockedAt` from `Plan.kt` and any `lockedAt`/`isLocked` from `PlanRepository.kt`.
- [ ] Delete `PlanLockGuard.kt`. Remove its injection and every `lockGuard.assertUnlockedBy*(...)` call from the surviving services (`OptionProConService`, `OptionResourceService`, `PlanResourceService`, `PlanDiscussionService`, `VoteService`). The guarded operations become always-allowed.
- [ ] Remove lock/unlock endpoints from `PlanController.kt` (`POST /api/plans/{id}/lock`, `/unlock`) and any lock service methods on `PlanService.kt`.
- [ ] Remove `lockedAt`/`locked` fields from response DTOs in `DecisionDto.kt` (e.g. `PlanTreeResponse`, `PlanSummaryResponse`, `SubPlanDetailResponse`).
- [ ] Remove/adjust tests referencing lock (search `test` tree for `lock`/`Locked`).
- [ ] `./gradlew build` green. Commit: `refactor(decisions): remove plan lock layer (V30)`.

---

### Task BE-2: Remove flow edges + 관련 edges (V31)

**Files:** Create `V31__drop_edges.sql`; delete `OptionFlowEdge.kt`, `OptionFlowEdgeController.kt`, `OptionFlowEdgeRepository.kt`, `OptionFlowEdgeService.kt`, `SubPlanEdge.kt`, `SubPlanEdgeRepository.kt`, `EdgeController.kt`, `EdgeService.kt`; modify `PlanService.kt` (getTree + purge), `DecisionDto.kt`.

- [ ] **Migration** — `V31__drop_edges.sql`:
```sql
DROP TABLE option_flow_edges;
DROP TABLE sub_plan_edges;
```
- [ ] Delete the 8 edge files listed above.
- [ ] In `PlanService.getTree`, remove assembly of `optionFlowEdges` and `edges` (관련). Remove those fields from `PlanTreeResponse` in `DecisionDto.kt`.
- [ ] In `PlanService` plan-purge/delete paths (`purgeSinglePlan`/`deleteForever`), remove the edge-cleanup calls (tables are gone).
- [ ] Delete edge tests; remove edge assertions from `PlanService`/purge tests.
- [ ] `./gradlew build` green. Commit: `refactor(decisions): remove flow + 관련 edges (V31)`.

---

### Task BE-3: Remove comment pins (V32)

**Files:** Create `V32__drop_comment_pins.sql`; delete `CommentPin.kt`, `CommentPinController.kt`, `CommentPinRepository.kt`, `CommentPinService.kt`; modify `PlanService.kt` (getTree + purge — this also reverts the recent N+1 batch count), `DecisionDto.kt`, and the `comment` module if it added `countByWorkspaceIdAndPageIdIn`/`PageIdCount` solely for pins.

- [ ] **Migration** — `V32__drop_comment_pins.sql`:
```sql
DELETE FROM comments WHERE page_id LIKE 'pin:%';
DROP TABLE comment_pins;
```
- [ ] Delete the 4 `CommentPin*` files.
- [ ] Remove `commentPins` from `PlanTreeResponse` (`DecisionDto.kt`) and from `PlanService.getTree` (including the `countByWorkspaceIdAndPageIdIn` batch + `pin:{id}` count map added earlier).
- [ ] Remove pin cleanup from `PlanService` purge paths.
- [ ] If `CommentRepository.countByWorkspaceIdAndPageIdIn` + `PageIdCount` projection are now unused, delete them.
- [ ] Delete `CommentPinServiceTest.kt` and pin cases in `DecisionCommentPurgeTest.kt`.
- [ ] `./gradlew build` green. Commit: `refactor(decisions): remove canvas comment pins (V32)`.

---

### Task BE-4: Replace `Decision` with per-후보 confirm (V33)  ⚠️ largest — opus

**Files:** Create `V33__decision_to_option_confirm.sql`; delete `Decision.kt`, `DecisionRepository.kt`, `DecisionService.kt`, `DecisionController.kt`; modify `Option.kt`, `OptionController.kt`, `DecisionDto.kt`, `DecisionMappers.kt`, `PlanService.kt` (getTree), `PlanEnums.kt` (events), `VoteService.kt`, `TimelineService.kt`, `DecisionExceptions.kt`.

**Interfaces produced:** `PATCH /api/options/{id}/confirm` body `{ "confirmed": Boolean }` → `OptionResponse`; `OptionResponse` gains `confirmed: Boolean`, `confirmedAt: Instant?`, `confirmedBy: Long?`.

- [ ] **Migration** — `V33__decision_to_option_confirm.sql`:
```sql
DROP TABLE decisions;
ALTER TABLE options
  ADD COLUMN confirmed     TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN confirmed_at  DATETIME(6)  NULL,
  ADD COLUMN confirmed_by  BIGINT       NULL;
ALTER TABLE options
  ADD CONSTRAINT fk_options_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL;
```
- [ ] Add to `Option.kt`: `var confirmed: Boolean = false`, `var confirmedAt: Instant? = null`, `var confirmedBy: Long? = null` (match column names via `@Column`).
- [ ] Delete `Decision.kt`, `DecisionRepository.kt`, `DecisionService.kt`, `DecisionController.kt`. Remove Decision mapping from `DecisionMappers.kt`. Remove `decision`/vote-tally-snapshot fields from `SubPlanDetailResponse`/`OptionResponse`/tree DTOs in `DecisionDto.kt`; remove `DecisionNotFound`-style entries from `DecisionExceptions.kt` if unused.
- [ ] Add confirm to `OptionController.kt` + a service method (extend `OptionResourceService`? No — put on the existing option write service; if none, add `OptionService`/method on the controller's service). Signature:
```kotlin
@PatchMapping("/api/options/{id}/confirm")
fun setConfirmed(
    @PathVariable id: Long,
    @RequestBody req: SetOptionConfirmedRequest,
    @CurrentWorkspace ws: Workspace,
    @AuthenticationPrincipal me: AppPrincipal,
): OptionResponse
```
Service logic: load option by id + workspace (404 `OptionNotFoundException` if absent); set `confirmed = req.confirmed`; `confirmedAt = if (req.confirmed) Instant.now() else null`; `confirmedBy = if (req.confirmed) me.userId else null`; save; record event (`OPTION_CONFIRMED` or `OPTION_REVOKED`) via `PlanEventRecorder`; publish change-signal; return mapped `OptionResponse`. NOT lock-gated (no locks exist).
- [ ] DTO in `DecisionDto.kt`: `data class SetOptionConfirmedRequest(val confirmed: Boolean)`; add `confirmed`, `confirmedAt`, `confirmedBy` to `OptionResponse`.
- [ ] `PlanEnums.kt`: add `OPTION_CONFIRMED`, `OPTION_REVOKED` to the event-type enum; remove `DECISION_MADE`/`DECISION_REVERTED` (or equivalents). Update `TimelineService`/`formatPlanEvent` mapping.
- [ ] `VoteService.kt`: remove any coupling to `Decision`/frozen-tally-at-확정 and to lock; votes are always live and mutable now.
- [ ] `PlanService.getTree`: drop `decision` assembly; options now carry their own confirm state via the mapper.
- [ ] Tests: replace `DecisionServiceTest` with `OptionConfirmServiceTest` (confirm sets fields+event; revoke clears; multi-confirm on one 안건 independent; foreign-workspace 404; realtime publish). Fix vote tests that assumed freeze-at-확정.
- [ ] `./gradlew build` green. Commit: `feat(decisions): per-후보 confirm replaces single Decision (V33)`.

---

### Task BE-5: Remove canvas coordinates (V34)

**Files:** Create `V34__drop_canvas_coords.sql`; modify `Option.kt`, `SubPlan.kt`, `OptionController.kt`/`SubPlanController.kt` (position PATCH endpoints), `DecisionDto.kt`.

- [ ] **Migration** — `V34__drop_canvas_coords.sql` (confirm exact column names first; `options.canvas_x/canvas_y` from V28, `sub_plans.canvas_x/canvas_y` from earlier):
```sql
ALTER TABLE options    DROP COLUMN canvas_x, DROP COLUMN canvas_y;
ALTER TABLE sub_plans  DROP COLUMN canvas_x, DROP COLUMN canvas_y;
```
- [ ] Remove `canvasX`/`canvasY` from `Option.kt` and `SubPlan.kt`; remove them from tree/response DTOs.
- [ ] Remove the position-persist endpoints (`PATCH /api/options/{id}` position, `PATCH /api/subplans/{id}` position / move) and their service methods and request DTOs. (Ordering stays via the existing `sortOrder` reorder endpoint — keep that.)
- [ ] Remove position tests.
- [ ] `./gradlew build` green. Commit: `refactor(decisions): drop dead canvas coordinates (V34)`.

---

## Deploy note (after merge, not per-task)

This machine is the BE CD runner + Docker host. After the backend branch merges to main, five new migrations (V30–V34) apply to **prod** on redeploy, dropping decisions tables/columns and wiping decisions data. This is an intended, outward-facing production migration — **confirm with the user before merging/deploying.** Verify post-deploy: `docker logs shared-docs-backend | grep -i flyway` shows V30–V34 applied and `curl :8090/actuator/health` UP.

## Self-review notes

- Migrations are strictly forward, V30→V34, one per task; each paired with its code change so `validate` passes at each commit. ✅
- Every removed feature (lock, edges, pins, Decision, coords) has a task; the frontend consumers are handled in the separate FE plan. ✅
- New surface is minimal and explicit: one endpoint (`PATCH /api/options/{id}/confirm`), three `Option` fields, two event types. ✅
