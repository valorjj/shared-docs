# Plan Lock (Design)

> **Status:** design — approved 2026-06-11, ready for plan-writing.
> **Scope:** backend (`shared-docs-backend`) + frontend (`shared-docs`, `src/features/decisions`).
> **Backlog item:** Decisions backlog A.1 — "Lock the plan" (`decisions-backlog.md`).

## 1. Goal

Let a workspace member **freeze a 계획 to read-only** once the group has settled it: no further edits to the plan, its 안건 / 선택지 / decisions / ratings / edges / canvas layout. Locking is reversible (unlock). It is a *freeze*, not a lifecycle stage — distinct from the existing decision-lock (which locks a single 안건's choice) and from the upcoming "mark complete" / "discard" states.

## 2. Context (current state)

From a full map of the decision module:

- **Entities** (all extend `BaseEntity` → `id`/`createdAt`/`updatedAt`/`version`): `Plan`, `SubPlan`, `Option`, `OptionRating`, `Decision`, `PlanEvent`, `SubPlanEdge`. All carry `workspaceId`.
- **`PlanStatus`** = `ACTIVE | ARCHIVED` (`PlanEnums.kt`). ARCHIVED is **display-only today** — there is *no* edit guard on archived plans.
- **`PlanEventType`** = `PLAN_CREATED, SUBPLAN_ADDED, OPTION_ADDED, DECISION_LOCKED, DECISION_CHANGED, DECISION_REOPENED` (stored as string, ≤40 chars). The 기록 timeline renders these.
- **Errors:** every decision error extends `ApiException(status, typeSlug, title, detail)` → RFC 7807 problem+json via the single `@ExceptionHandler(ApiException::class)`. Korean `detail`.
- **Authorization:** controllers receive `@CurrentWorkspace`; services scope every query by `ws.id`. **No per-entity ownership/role check** — any member mutates any shared resource ("soft lock": any member may lock/reopen a decision).
- **Mutating service methods (14 content writes + 2 lock-toggle, to be added):**
  - `PlanService`: `update`, `delete`, `addSubPlan`, `updateSubPlan`, `deleteSubPlan`, `reorderSubPlans`, `addOption`, `updateOption`, `deleteOption`
  - `DecisionService`: `lock`, `reopen`
  - `RatingService`: `upsert`, `delete`
  - `EdgeService`: `create`, `delete`
- **`requireX` helpers** in `PlanService` load + workspace-scope an entity or throw 404 (`requirePlan`, `requireSubPlan`, `requireOption`). Most loaded entities carry `planId`; **`Option` carries only `subPlanId`** (no `planId`).
- **Frontend** (`src/features/decisions`): `types.ts` (`PlanSummary`, `PlanTree`, `PlanStatus`), `api.ts` (mutation hooks, all invalidate `decisionKeys.scope`), `PlanDetail.tsx` (목록/캔버스/기록 tabs), `SubPlanSection.tsx`, `OptionRow.tsx`, `DecisionList.tsx`. **No read-only mode exists** — every edit affordance is shown unconditionally, disabled only by a transient `busy` flag.

## 3. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Data model | **Orthogonal lock flag** — `lockedAt: Instant?` + `lockedByUserId: Long?`, independent of `PlanStatus`. A plan can be ACTIVE+locked or ARCHIVED+locked. Leaves `status` free for the future complete/discard states. |
| Freeze scope | **Freeze everything** — all 14 content writes blocked, including delete, ratings, edges, reorder, and canvas positions. A locked plan is fully read-only. |
| Lock control | **Any member, reversible** — any workspace member can lock and unlock. Consistent with the existing soft-lock philosophy. |
| Idempotency | Lock/unlock are **idempotent** — re-applying the current state is a no-op that emits no second `PlanEvent`. |

## 4. Architecture

### 4.1 Data model + migration

- Add to `Plan`: `lockedAt: Instant?` (nullable), `lockedByUserId: Long?` (nullable, reference-by-id — mirrors `createdByUserId`).
- `isLocked` is **derived** (`lockedAt != null`); not stored.
- **Flyway migration** adds `locked_at` (nullable timestamp) and `locked_by_user_id` (nullable bigint) to the `plans` table, mirroring the existing `created_by_user_id` column's FK treatment for consistency. Entity fields match the columns exactly so `ddl-auto: validate` passes.

### 4.2 Lock/unlock as dedicated actions

Two new endpoints on `PlanController`, in the existing decision action style (`POST .../decision`, `.../decision/reopen`):

- `POST /api/plans/{planId}/lock` → `PlanService.lock(workspaceId, planId, actorUserId): PlanSummaryResponse`
  - `requirePlan(workspaceId, planId)`.
  - If already locked → return current state, **no event** (idempotent).
  - Else set `lockedAt = now`, `lockedByUserId = actorUserId`; record a `PLAN_LOCKED` `PlanEvent` (payload: plan title) in the same transaction.
- `POST /api/plans/{planId}/unlock` → `PlanService.unlock(workspaceId, planId, actorUserId): PlanSummaryResponse`
  - `requirePlan(...)`.
  - If not locked → return current state, no event.
  - Else clear `lockedAt`/`lockedByUserId`; record `PLAN_UNLOCKED`.

These two endpoints are the **only** writes exempt from the freeze guard — the reason lock state is a dedicated action rather than a field on the generic `PATCH /api/plans/{planId}` (which is itself a guarded content write).

`PlanEventType` gains `PLAN_LOCKED` and `PLAN_UNLOCKED`.

The lock/unlock responses include the new `lockedAt`/`lockedByUserId` fields (also added to the plan tree/summary read responses so the frontend can render lock state).

### 4.3 Enforcing the freeze — `PlanLockGuard`

A small `@Component PlanLockGuard` that owns the freeze policy in one place and throws a new exception:

```
class PlanLockedException : ApiException(
    status = HttpStatus.CONFLICT,           // 409
    typeSlug = "plan-locked",
    title = "Plan is locked",
    detail = "잠긴 계획은 수정할 수 없어요. 먼저 잠금을 해제해 주세요.",
)
```

Three entry points, so each caller uses the identifier it already holds (avoids loading a full `Plan` where a boolean query suffices):

- `assertUnlocked(plan: Plan)` — caller already loaded the Plan (PlanService plan-level methods read `plan.lockedAt` directly).
- `assertUnlockedByPlanId(planId: Long)` — caller holds an entity carrying `planId` (subplan, edge). Backed by a boolean repository query (`SELECT (p.lockedAt IS NOT NULL) FROM Plan p WHERE p.id = :planId`).
- `assertUnlockedBySubPlanId(subPlanId: Long)` — option/rating writes that hold only a `subPlanId`. Backed by a join query (Plan ↔ SubPlan).

Each `assert*` throws `PlanLockedException` when the owning plan is locked, otherwise returns. The guard runs **after** the existing `requireX` 404 check (so it only ever sees a valid, workspace-scoped target).

### 4.4 Guard wiring (the 14 content writes)

| Service.method | What it holds | Guard call |
|---|---|---|
| `PlanService.update` | `Plan` (via requirePlan) | `assertUnlocked(plan)` |
| `PlanService.delete` | `Plan` | `assertUnlocked(plan)` |
| `PlanService.addSubPlan` | `Plan` | `assertUnlocked(plan)` |
| `PlanService.reorderSubPlans` | `Plan` | `assertUnlocked(plan)` |
| `PlanService.updateSubPlan` | `SubPlan` (has `planId`) | `assertUnlockedByPlanId(subPlan.planId)` |
| `PlanService.deleteSubPlan` | `SubPlan` | `assertUnlockedByPlanId(subPlan.planId)` |
| `PlanService.addOption` | `SubPlan` | `assertUnlockedByPlanId(subPlan.planId)` |
| `PlanService.updateOption` | `Option` (has `subPlanId`) | `assertUnlockedBySubPlanId(option.subPlanId)` |
| `PlanService.deleteOption` | `Option` | `assertUnlockedBySubPlanId(option.subPlanId)` |
| `DecisionService.lock` | `SubPlan` | `assertUnlockedByPlanId(subPlan.planId)` |
| `DecisionService.reopen` | `SubPlan` | `assertUnlockedByPlanId(subPlan.planId)` |
| `RatingService.upsert` | `Option` | `assertUnlockedBySubPlanId(option.subPlanId)` |
| `RatingService.delete` | `Option` | `assertUnlockedBySubPlanId(option.subPlanId)` |
| `EdgeService.create` | `planId` param | `assertUnlockedByPlanId(planId)` |
| `EdgeService.delete` | `SubPlanEdge` (has `planId`) | `assertUnlockedByPlanId(edge.planId)` |

`DecisionService`, `RatingService`, and `EdgeService` each gain a `PlanLockGuard` constructor dependency. The guard call goes immediately after the method's `requireX` resolution and before any mutation.

**Exempt (never guarded):** `PlanService.lock`, `PlanService.unlock`, and all read paths (`list`, `tree`, timeline).

### 4.5 Frontend

- **`types.ts`:** add `lockedAt: string | null` and `lockedByUserId: number | null` to `PlanSummary` and `PlanTree`.
- **`api.ts`:** `useLockPlan()` (`POST /api/plans/{id}/lock`) and `useUnlockPlan()` (`POST /api/plans/{id}/unlock`); both invalidate `decisionKeys.scope(activeId)`.
- **Lock toggle:** a Lucide **`Lock` / `LockOpen`** icon-button in the plan header (no emoji, per house style). Confirm-on-unlock is not required (reversible, low-stakes).
- **Read-only rendering:** derive `const locked = tree.lockedAt != null`; thread a `locked` boolean into `SubPlanSection`, `OptionRow`, the list view, and the canvas — mirroring the existing `busy`-disable pattern. When `locked`:
  - Hide/disable 수정 / 삭제 / 안건 추가 / 선택지 추가 / 결정하기 / 다시 열기 / 연결 / reorder drag handles / rating controls.
  - Canvas: disable node drag and edge drawing.
  - Show a calm banner at the top of the detail view: "이 계획은 잠겨 있어요. 잠금을 해제하면 다시 편집할 수 있어요." with the unlock action.
- Backend is the real enforcement; the client also surfaces a stray `409` through the existing `apiError` path (Korean detail) if a stale client attempts a write.

## 5. Error handling

- **Write to a locked plan:** `PlanLockedException` → 409 problem+json (`type: https://shared-docs/errors/plan-locked`, Korean detail). Rendered by the existing handler.
- **Lock/unlock when already in that state:** no error — idempotent no-op returning current state.
- Guard is fail-closed only for the offending write; reads and the lock-toggle endpoints are unaffected.

## 6. Testing

Backend (`@SpringBootTest @ActiveProfiles("test") @Transactional`, MariaDB `shared_docs_test`):

- `lock` sets `lockedAt` + `lockedByUserId` and emits exactly one `PLAN_LOCKED` event; `unlock` clears both and emits `PLAN_UNLOCKED`.
- **Idempotency:** locking an already-locked plan (and unlocking an already-unlocked plan) is a no-op with **no second event**.
- **Freeze:** while locked, a representative write on **each** of the four services returns `PlanLockedException` (409) and performs no mutation — at minimum `PlanService.updateSubPlan`, `PlanService.updateOption`, `DecisionService.lock`, `RatingService.upsert`, `EdgeService.create`, and `PlanService.delete`.
- **Reads unaffected:** `tree`/`list` succeed while locked.
- **Round-trip:** unlock → the same edit now succeeds.
- `PlanLockGuard` resolution: `assertUnlockedByPlanId` and `assertUnlockedBySubPlanId` correctly resolve a child entity to its owning plan's lock state (use `entityManager.flush()/clear()` to avoid first-level-cache false greens).

Frontend has no test runner — gate on `npx tsc -b --noEmit` (NOT `tsc --noEmit` — the root config is a references stub) and `npm run build`, plus manual: lock a plan, confirm every affordance disappears and the banner shows; unlock and confirm editing returns.

## 7. Build order (informs the plan)

1. **Backend data model + migration:** `Plan` columns, Flyway migration, `lockedAt`/`lockedByUserId` in read DTOs; verify `validate` passes.
2. **Lock/unlock endpoints + events:** `PlanEventType.PLAN_LOCKED/PLAN_UNLOCKED`, `PlanService.lock/unlock`, `PlanController` routes; tests (sets state + event, idempotency).
3. **`PlanLockGuard` + `PlanLockedException` + wiring** into all 14 content writes across the four services; freeze tests (TDD: assert 409 before wiring each service).
4. **Frontend:** types, hooks, header toggle, read-only threading + banner; `tsc -b` + build green.
5. Full backend suite green (`./gradlew clean test`).

Pieces 2 and 3 are sequential (3 depends on the columns from 1; the toggle endpoints from 2 are the exemption 3 must not block). Piece 4 depends on 1–2 for the response shape.
