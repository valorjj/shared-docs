# Decisions A.4 — 기한 (Deadlines) Design

> Brainstormed 2026-06-15. The last open item in the Decisions backlog (`decisions-backlog.md` A.4). Adds a date-only deadline to 계획 and 안건, surfaces it as a live D-day chip on the board + detail, and records set/change/clear in the 기록 timeline. "Annotate, don't enforce": a decided 안건 / completed 계획 freezes whether it landed **기한 내** or **기한 지나**; nothing is ever blocked.

## Decisions locked (brainstorm 2026-06-15)

1. **Both levels carry a deadline** — `Plan.deadline` and `SubPlan.deadline`, independent.
2. **Date-only** (`YYYY-MM-DD`), matching the app convention (anniversaries, todos, calendar are all date-only). No time-of-day, no timezone ambiguity.
3. **Live D-day chip + 기록 events** — the chip makes a deadline actionable; the events keep the diary honest.
4. **Annotate, don't enforce** — a decided 안건 / completed 계획 shows a frozen **기한 내 / 기한 지나** annotation. An overdue *undecided* 안건 just shows a `지남` chip. Never blocks a write.
5. **Inline chip-as-editor** — a single-purpose `DeadlineChip` is both the display and the editor (small date Modal), decoupled from the entity edit modals.
6. **Add `Plan.completedAt`** — a small gap-fill so plan-level 기한 내/지나 annotation has a timestamp to compare against (안건 already has `Decision.decidedAt`).

## Why this shape

- The timeline (`PlanEvent`) is append-only past; a deadline is a *future* obligation. So the deadline lives as a field on the entity (forward-looking chip), and the timeline records the *act* of setting/changing/clearing it (backward-looking diary) — the two surfaces stay true to their natures.
- `PlanService.update()` uses the `request.field?.let { }` partial-update pattern where `null` means "don't touch", and canvas-drag reuses that same endpoint sending only `canvasX/Y`. A deadline riding on `UpdatePlanRequest` therefore (a) could never be *cleared* (null is ambiguous) and (b) would be silently wiped by a drag that omits it. So deadlines get dedicated lifecycle-style endpoints, mirroring lock/complete/discard.

---

## Backend (`shared-docs-backend`)

### Migration — Flyway V22 (`V22__plan_deadlines.sql`)

```sql
ALTER TABLE plans     ADD COLUMN deadline     DATE      NULL;
ALTER TABLE plans     ADD COLUMN completed_at TIMESTAMP NULL;
ALTER TABLE sub_plans ADD COLUMN deadline     DATE      NULL;

-- Best-effort backfill so already-COMPLETED plans have a completion timestamp
-- to compare a (future-added) deadline against. updated_at is the closest proxy.
UPDATE plans SET completed_at = updated_at WHERE status = 'COMPLETED';
```

`ddl-auto: validate` asserts the entities match — see entity changes below.

### Entities

- `Plan`: add `var deadline: LocalDate? = null` (`@Column(name = "deadline")`) and `var completedAt: Instant? = null` (`@Column(name = "completed_at")`).
- `SubPlan`: add `var deadline: LocalDate? = null` (`@Column(name = "deadline")`).

### Event types

Append to `PlanEventType`:

- `DEADLINE_SET` — set **or** change (one type; the payload carries the new date).
- `DEADLINE_CLEARED`.

`PlanEvent.subPlanId` (already present) distinguishes plan-level (`null`) from 안건. Names stay within the `varchar(40)` cap.

### Endpoints (new `PlanController` / `SubPlanController` methods)

```
PUT    /api/plans/{id}/deadline                    { deadline: "YYYY-MM-DD" }  → 200 PlanSummaryResponse   · DEADLINE_SET
DELETE /api/plans/{id}/deadline                                                → 200 PlanSummaryResponse   · DEADLINE_CLEARED
PUT    /api/plans/{id}/subplans/{subId}/deadline   { deadline: "YYYY-MM-DD" }  → 200 SubPlanResponse       · DEADLINE_SET
DELETE /api/plans/{id}/subplans/{subId}/deadline                              → 200 SubPlanResponse       · DEADLINE_CLEARED
```

(Confirm the existing subplan route shape during planning — `SubPlanController` mounts under `/api/plans/{planId}/subplans` vs `/api/subplans/{id}`; follow whatever is already there.)

Service rules (in `PlanService` / subplan path):

- **Lock-guarded**: both set and clear call `lockGuard.assertUnlocked(plan)` → 409 `PLAN_LOCKED` when locked. A deadline is planning content.
- **Permissions**: workspace member with EDIT — same guard as every other content write.
- **No date validation beyond a valid `LocalDate`.** Past dates are allowed (recording a target that already passed is legitimate).
- **Set**: assign `deadline`, record `DEADLINE_SET` with payload `{ deadline, subPlanTitle? }` (subPlanTitle only on the 안건 path, matching the existing convention).
- **Clear**: set `deadline = null`, record `DEADLINE_CLEARED` with payload `{ subPlanTitle? }`. Clearing when already null is a harmless no-op (still records the event only if there was a deadline — skip the event when nothing changed, to avoid empty diary noise).
- **`completedAt`**: `complete()` sets `completedAt = Instant.now()` (via the injected clock if one exists; otherwise `Instant.now()`); `uncomplete()` sets it back to `null`. No other behavior change.

### Request DTO

```kotlin
/** Set/replace a 기한. Date-only. */
data class SetDeadlineRequest(
    @field:NotNull val deadline: LocalDate,
)
```

### Response DTOs (`DecisionDto` + `DecisionMappers`)

- `PlanSummaryResponse`: add `deadline: LocalDate?`, `completedAt: Instant?`.
- `PlanTreeResponse`: add `deadline: LocalDate?` (+ `completedAt: Instant?` for the header annotation).
- `SubPlanResponse`: add `deadline: LocalDate?`.

### Tests (JUnit, existing `PlanServiceTest` patterns)

- Set deadline → field set + one `DEADLINE_SET` event with correct payload.
- Change deadline → second `DEADLINE_SET`, field updated.
- Clear deadline → field null + one `DEADLINE_CLEARED`; clearing when none → no event.
- Lock-guard: set/clear on a locked plan → 409.
- `complete()` sets `completedAt`; `uncomplete()` nulls it.
- Errors are RFC 7807 (ENGINEERING-STANDARDS).

---

## Frontend (`shared-docs`)

### Types (`src/features/decisions/types.ts`)

- Add `deadline: string | null` (`YYYY-MM-DD`) to the plan-summary, plan-tree, and sub-plan types.
- Add `completedAt: string | null` to the plan-summary/tree types.
- Add `'DEADLINE_SET' | 'DEADLINE_CLEARED'` to `PlanEventType`.

### API (`src/features/decisions/api.ts`)

Four mutation hooks (`useSetPlanDeadline`, `useClearPlanDeadline`, `useSetSubPlanDeadline`, `useClearSubPlanDeadline`), each invalidating `decisionKeys.scope(activeId)` — which already nests list/tree/timeline/feed, so every surface refreshes with no extra wiring.

### `deadlineLabel(date, today)` — pure helper (unit-testable)

```
days < 0  → { text: '지남',      tone: 'danger'  }
days === 0 → { text: '오늘',      tone: 'accent'  }
days === 1 → { text: '내일',      tone: 'accent'  }
days > 1   → { text: `${days}일 남음`, tone: 'neutral' }
```
`title` attribute always carries the full `YYYY.MM.DD`. Day diff is computed on calendar dates (local midnight), matching the anniversary D-day idiom.

### `DeadlineChip` — one tiny single-purpose component

- **No deadline** → ghost "기한" chip; click → `Modal` with native `<input type="date">` + 저장 → PUT.
- **Has deadline, active/undecided** → live D-day from `deadlineLabel`; hairline pill, `--c-danger` when `지남`, subtle accent for 오늘/내일, neutral otherwise. Click → `Modal` with the date field + 변경 + **없애기** (→ DELETE).
- **Decided 안건 / completed 계획** → frozen annotation instead of live D-day: **`기한 내 결정`** / **`기한 지나 결정`** (`…완료` for plans), derived by comparing `decidedAt` / `completedAt` (date) to `deadline`. 지나 in muted danger; read-only, diary-toned.

### Placement

- **Plan deadline chip** → `DecisionList` board card + `PlanDetail` header.
- **안건 deadline chip** → `SubPlanSection` row in the 목록 view of `PlanDetail`.

### Timeline (`formatPlanEvent.tsx`)

- Icons: `CalendarClock` (`DEADLINE_SET`), `CalendarX` (`DEADLINE_CLEARED`).
- Lines (date rendered `M월 D일`, prefixed `YYYY년 ` only when the year differs — always ends in `일`, so the particle `로` is always grammatical):

| event | line |
|---|---|
| `DEADLINE_SET` (plan) | `{actor}님이 계획 기한을 {6월 20일}로 정했어요` |
| `DEADLINE_SET` (안건) | `{actor}님이 '{subPlanTitle}' 안건 기한을 {6월 20일}로 정했어요` |
| `DEADLINE_CLEARED` (plan) | `{actor}님이 계획 기한을 없앴어요` |
| `DEADLINE_CLEARED` (안건) | `{actor}님이 '{subPlanTitle}' 안건 기한을 없앴어요` |

### Frontend gate

`npx tsc -b --noEmit` + `npm run build`; lint only `src/features/decisions/`.

---

## Non-goals (YAGNI)

- No reminders / push notifications.
- No Calendar-page integration (deadlines don't appear on `/calendar` — possible future).
- No board sorting / filtering by deadline.
- No enforcement or blocking of any write based on a deadline.
- No time-of-day.
- No option-level deadlines (only 계획 / 안건).
