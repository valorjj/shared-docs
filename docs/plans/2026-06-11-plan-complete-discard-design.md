# Plan Complete + Discard (Design)

> **Status:** design — approved 2026-06-11, ready for plan-writing.
> **Scope:** backend (`shared-docs-backend`) + frontend (`shared-docs`, `src/features/decisions`).
> **Backlog items:** Decisions backlog A.2 ("mark complete") + A.3 ("discard + manage discarded"). Brainstormed together — both are plan-lifecycle/status work sharing the roadmap surface.
> **Builds on:** the shipped plan-lock feature (`2026-06-11-plan-lock-design.md`) — and deliberately revises one of its rules (see §6).

## 1. Goal

Two related plan-lifecycle capabilities:

- **Mark complete** — flag a 계획 as finished/resolved. Completed plans drop off the active board (decluttering it) and are reachable via a 완료 view. Reversible (다시 진행).
- **Discard** — soft-delete a 계획 to a 휴지통 (trash), with 복원 (restore) and 영구 삭제 (permanent delete), mirroring the app's canonical Note soft-delete pattern.

## 2. Context (current state)

- **`PlanStatus = ACTIVE | ARCHIVED`** (`decision/PlanEnums.kt`). **ARCHIVED is a half-built stub:** settable only via the raw `PATCH /api/plans/{id}` `status` field, never filtered in `list()`/`getTree()`, with **no UI to set it** and a 보관됨/진행 중 badge that users can't reach. The comment "ARCHIVED hides it from the active roadmap" was never implemented. → It is retired by this work.
- **Canonical soft-delete = `Note`:** `deletedAt: Instant?`; repositories filter `deletedAt IS NULL` (active) / `IS NOT NULL` (trash) explicitly (no `@Where`); `NoteService.delete` (soft, sets `deletedAt = now`), `restore` (clears it), `deleteForever` (hard cascade). Endpoints: `DELETE /api/notes/{id}` (soft), `POST /api/notes/{id}/restore`, `DELETE /api/notes/{id}/forever`, trash listing. Frontend `TrashList`/`TrashListItem`: labels **휴지통**, **복원** (RotateCcw), **영구 삭제** (Trash2, destructive), purge confirm "메모와 첨부 파일이 완전히 사라집니다. 되돌릴 수 없어요." Soft-delete confirm "휴지통으로 이동할까요?" / "휴지통에서 언제든 복원할 수 있어요."
- **Decisions plan endpoints today:** `GET /api/plans` returns *all* plans (no status/delete filter); `GET /api/plans/{id}` returns the tree regardless of status; `DELETE /api/plans/{id}` is a **hard cascade delete** (`PlanService.delete`); the card's 삭제 button calls it with a "삭제할까요? 되돌릴 수 없어요" confirm.
- **Plan lock (just shipped):** orthogonal `lockedAt`/`lockedByUserId`; `PlanLockGuard` throws `PlanLockedException` (409) on all 14 content writes **including `PlanService.delete`**. `PlanLockServiceTest` asserts `delete` while locked → 409. (This rule is revised in §6.)
- **DecisionList** has a segmented `Tabs` control `[보드, 활동]`. **PlanDetail** has a `planBar` with the 잠금/잠금 해제 toggle.
- **PlanEventType** = `PLAN_CREATED, SUBPLAN_ADDED, OPTION_ADDED, DECISION_LOCKED, DECISION_CHANGED, DECISION_REOPENED, PLAN_LOCKED, PLAN_UNLOCKED` (varchar(40)).

## 3. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Status model | **`ACTIVE | COMPLETED`**, retire the dead `ARCHIVED`. Complete is a status transition (mutually exclusive with active), not an orthogonal flag. |
| Completed plans on the board | **Hidden from the active board**, shown via a dedicated 완료 view (the behavior ARCHIVED was meant to have). |
| Lock interaction | **Lock = content only.** Complete/uncomplete, discard/restore, and purge are management actions allowed even on a locked plan. This **supersedes** lock's "delete is guarded" rule. |
| Discard mechanism | Soft-delete via `deletedAt`, mirroring `Note`. Existing hard-delete becomes 영구 삭제 (purge), reachable only from trash. |
| Timeline events | complete/uncomplete **emit** events (lifecycle milestones); discard/restore/purge **do not** (trash management, keeps the feed clean). |

## 4. Architecture — backend

### 4.1 Status: complete / uncomplete

- `PlanStatus` → `enum class PlanStatus { ACTIVE, COMPLETED }`.
- `PlanEventType` += `PLAN_COMPLETED`, `PLAN_UNCOMPLETED`.
- **Remove `status` from `UpdatePlanRequest`** and drop the `request.status?.let { plan.status = it }` line from `PlanService.update` (the only mutation path for status is now the dedicated actions).
- New `PlanService` methods (idempotent, NOT lock-guarded), mirroring the lock/unlock shape:
  - `complete(workspaceId, planId, actorUserId): PlanSummaryResponse` — `requirePlan`; if `status != COMPLETED` set it and emit `PLAN_COMPLETED` (`payload {"title"}`); return `summaryOf(plan)`.
  - `uncomplete(...)` — symmetric; if `status != ACTIVE` set `ACTIVE` and emit `PLAN_UNCOMPLETED`.
- `PlanController`: `POST /{planId}/complete`, `POST /{planId}/uncomplete` (same `@CurrentWorkspace` + `@AuthenticationPrincipal` signature as lock/unlock).

### 4.2 Discard / restore / purge (soft-delete)

- Add to `Plan`: `@Column(name = "deleted_at") var deletedAt: Instant? = null`.
- New `PlanService` methods (NOT lock-guarded, no events):
  - `discard(workspaceId, planId): Unit` — `requirePlan`; set `deletedAt = Instant.now()` (idempotent: no-op if already set).
  - `restore(workspaceId, planId): Unit` — clear `deletedAt`.
  - `deleteForever(workspaceId, planId): Unit` — the **existing** `PlanService.delete` cascade body, renamed. **Remove its `lockGuard.assertUnlocked(plan)` call** (lifecycle, not content).
- `PlanController` route changes (mirror Note):
  - `DELETE /api/plans/{planId}` → now calls `discard` (was `delete`). Returns 204.
  - `POST /api/plans/{planId}/restore` → `restore`. Returns 200 with the summary (so the client can update caches) or 204 — use 204 for consistency with the soft-delete verbs; the frontend invalidates scope regardless.
  - `DELETE /api/plans/{planId}/forever` → `deleteForever`. Returns 204.

> A discarded plan keeps its `lockedAt`/`status` untouched, so restoring brings it back exactly as it was.

### 4.3 Read filtering

`requirePlan` for the **lifecycle/management** actions (complete, discard, restore, deleteForever) must still find discarded plans (you restore/purge from trash) — so it stays `findByIdAndWorkspaceId` (no `deletedAt` filter).

But the **tree read** must hide discarded plans. Add a delete-aware lookup:

- `PlanRepository.findByIdAndWorkspaceIdAndDeletedAtIsNull(id, workspaceId): Plan?` — used by `getTree` (→ 404 for a discarded plan). Completed plans are still returned (status doesn't filter the tree).
- `PlanRepository.findAllByWorkspaceIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(workspaceId, status): List<Plan>` — for the board (`ACTIVE`) and the 완료 view (`COMPLETED`).
- `PlanRepository.findAllByWorkspaceIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(workspaceId): List<Plan>` — for trash (newest-discarded first).
- The existing `findAllByWorkspaceIdOrderByCreatedAtDesc` is removed (its only caller, `list`, is re-pointed).

`PlanService` read methods:
- `list(workspaceId)` → active, non-deleted (`status = ACTIVE`). *(Board.)*
- `listCompleted(workspaceId)` → `status = COMPLETED`, non-deleted.
- `listTrash(workspaceId)` → `deletedAt != null`. Each row mapped to a summary; trash summaries include `deletedAt` so the UI shows "N에 삭제". (The roll-up count helpers already exist; reuse the bulk `list` shape.)
- `getTree` switches to `findByIdAndWorkspaceIdAndDeletedAtIsNull`.

### 4.4 DTO

- `PlanSummaryResponse` += `deletedAt: Instant?` (so trash rows render the deletion time; null for active/completed).
- `PlanTreeResponse` already exposes `status`; no new field needed there (a discarded plan 404s).
- `PlanStatus` serialized value `COMPLETED` flows through existing `status` fields.

### 4.5 Controller endpoints summary

| Verb | Path | Service | Notes |
|---|---|---|---|
| GET | `/api/plans` | `list` | active board (changed: was all) |
| GET | `/api/plans/completed` | `listCompleted` | new |
| GET | `/api/plans/trash` | `listTrash` | new |
| POST | `/api/plans/{id}/complete` | `complete` | new, event |
| POST | `/api/plans/{id}/uncomplete` | `uncomplete` | new, event |
| DELETE | `/api/plans/{id}` | `discard` | changed: was hard delete |
| POST | `/api/plans/{id}/restore` | `restore` | new |
| DELETE | `/api/plans/{id}/forever` | `deleteForever` | new (old delete body) |

## 5. Architecture — frontend

### 5.1 DecisionList

Extend the `Tabs` from `[보드, 활동]` to **`[보드, 완료, 휴지통, 활동]`** (single segmented control — no extra chrome, per the Bear-minimal toolbar rule).

- **보드** (`usePlans` → active): card gets a **완료** action (CheckCircle2) alongside 수정; the existing trash icon now **discards** (confirm "휴지통으로 이동할까요?", subtext "휴지통에서 언제든 복원할 수 있어요").
- **완료** (`useCompletedPlans`): card shows a 완료 `Badge` + a **다시 진행** action (RotateCcw, → uncomplete) + discard. Same card layout otherwise.
- **휴지통** (`useTrashedPlans`): reuse the Note trash UX — each row shows the title + "N에 삭제" and two buttons: **복원** (RotateCcw) and **영구 삭제** (Trash2, destructive; confirm "계획과 모든 안건·선택지·결정이 완전히 사라집니다. 되돌릴 수 없어요."). Cards here are **not** clickable into the tree (discarded plans 404 on tree).
- **활동** (feed): unchanged.

### 5.2 PlanDetail

`planBar` gets a **완료 / 다시 진행** toggle next to the 잠금 toggle (CheckCircle2 / RotateCcw). A completed plan shows a calm "완료됨" marker (mirror the lock banner's quiet styling, or a small inline badge). Discard remains a list-card action (you don't trash from inside the detail, matching notes).

### 5.3 types / hooks / events

- `types.ts`: `PlanStatus = 'ACTIVE' | 'COMPLETED'`; add `deletedAt: string | null` to `PlanSummary`; `PlanEventType` += `'PLAN_COMPLETED' | 'PLAN_UNCOMPLETED'`. Remove `status` from `UpdatePlanPayload`.
- `formatPlanEvent.tsx`: `PLAN_COMPLETED: CheckCircle2`, `PLAN_UNCOMPLETED: RotateCcw`; text "님이 계획을 완료했어요" / "님이 계획을 다시 진행했어요".
- `api.ts`: `useCompletePlan`/`useUncompletePlan` (POST), `useRestorePlan` (POST `/restore`), `useDeletePlanForever` (DELETE `/forever`), `useCompletedPlans`/`useTrashedPlans` (GET). `useDeletePlan` keeps its `DELETE /api/plans/{id}` URL but is now a soft-delete — update the card confirm copy. All invalidate `decisionKeys.scope`.
- `decisionKeys`: add `completed` and `trash` query keys under the scope (so scope invalidation refreshes them).
- The `DecisionList` badge logic updates: `잠김` (locked) takes precedence, else `완료` (COMPLETED), else nothing (ACTIVE shows no badge — 진행 중 was only meaningful against ARCHIVED).

## 6. Revision to the shipped lock feature

Per the "lock = content only" decision, deletion is no longer lock-gated:

- **Remove** `lockGuard.assertUnlocked(plan)` from the (renamed) `deleteForever` method.
- **Update `PlanLockServiceTest`:** the `while locked, content writes ... are rejected` test currently includes `plans.delete(...)` → expects `PlanLockedException`. Remove that single assertion (the other 5 service writes stay). Add no new lock assertion for delete — deletion is intentionally allowed while locked now.
- The other 13 content-write guards are unchanged. Complete/discard/restore/purge are never guarded.

This is a deliberate behavior change, documented here and in the plan; the lock design doc's §4.4 "delete is frozen too" no longer holds once soft-delete + trash exist (the trash is the destruction gate).

## 7. Error handling

- Complete/uncomplete/discard/restore/deleteForever on a missing/foreign-workspace id → `PlanNotFoundException` (404) via the existing `requirePlan`.
- Idempotent actions (complete an already-completed plan, discard an already-discarded one) → no-op, return current state, no second event.
- `getTree` on a discarded plan → `PlanNotFoundException` (404) via `findByIdAndWorkspaceIdAndDeletedAtIsNull`.
- All RFC 7807 via the existing `ApiException` handler. No new exception types needed.

## 8. Testing

Backend (`@SpringBootTest @ActiveProfiles("test") @Transactional`):
- complete sets `COMPLETED` + emits `PLAN_COMPLETED`; uncomplete reverses + emits `PLAN_UNCOMPLETED`; both idempotent (no duplicate event).
- `list` returns only active non-deleted; `listCompleted` only completed non-deleted; `listTrash` only discarded.
- discard sets `deletedAt`, removes the plan from `list`/`listCompleted`, adds it to `listTrash`; restore reverses it.
- `getTree` 404s for a discarded plan; still works for a completed plan.
- `deleteForever` performs the full cascade (reuse/keep the existing delete test).
- **Lock interaction:** with a plan locked, `complete` and `discard` succeed (no `PlanLockedException`); `deleteForever` succeeds while locked.
- **Superseded test:** remove the `delete`-while-locked 409 assertion from `PlanLockServiceTest`.
- Migration: a plan previously `ARCHIVED` (insert directly or assert the backfill) ends up `ACTIVE` — or simply assert the enum no longer has ARCHIVED and the V19 backfill statement is present.

Frontend: no runner — gate on `npx tsc -b --noEmit` (NOT `tsc --noEmit`) + `npm run build`, plus manual: complete a plan → it leaves 보드, appears under 완료, timeline shows it; 다시 진행 returns it; discard → it moves to 휴지통; 복원 brings it back; 영구 삭제 removes it; all of the above work on a locked plan.

## 9. Build order (informs the plan)

1. **Backend status + migration:** `PlanStatus` → ACTIVE|COMPLETED, `PlanEventType` += COMPLETED/UNCOMPLETED, `deletedAt` column, **Flyway V19** (add column + index + ARCHIVED→ACTIVE backfill), remove `status` from `UpdatePlanRequest`/`update`. Verify `validate`.
2. **Backend complete/uncomplete:** service + controller + events; tests.
3. **Backend discard/restore/deleteForever + read filtering:** repo queries, service methods, `getTree` delete-aware lookup, controller route remap, `deletedAt` in DTO; tests. Includes the lock-guard removal from `deleteForever` and the `PlanLockServiceTest` edit (§6).
4. **Frontend:** types/hooks/events, DecisionList tabs (보드/완료/휴지통/활동) + card actions, PlanDetail 완료 toggle, trash UX; `tsc -b` + build + manual.
5. Full backend suite green (`./gradlew clean test`).

Tasks 2 and 3 are independent of each other (both depend on 1). Task 4 depends on the response shapes from 1–3.
