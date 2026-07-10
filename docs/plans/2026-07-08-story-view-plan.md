# Story View — 스토리 뷰 (Life Story Board Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chronological "스토리" view on the 결정 board — root decisions laid out on a vertical time axis (oldest at top), grouped by month, each card showing status, deadline, and a sub-decision dot-cluster; future-deadline decisions gathered under a "예정" divider at the bottom.

**Architecture:** Almost entirely client-side. The 결정 board (`DecisionList`) gains a 5th "스토리" tab that re-renders the existing root-plan list (`usePlans()`) through a new pure grouping function + a `StoryView` component. The one backend addition is a `childCount` field on `PlanSummaryResponse` (number of live direct child plans / 하위결정) so the dot-cluster has a count — computed with the module's existing no-N+1 roll-up pattern. No new endpoint, no migration.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA (`shared-docs-backend`, 1 task); Vite + React 19 + TS + CSS Modules (`shared-docs`, 2 tasks).

**Design spec:** `shared-docs/docs/plans/2026-07-08-life-story-board-design.md` §6 ("스토리 뷰") + §8.

## Global Constraints

- Two repos: BE task in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend`, FE tasks in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs`.
- All UI text Korean; icons lucide-react only (never emoji); CSS Modules + tokens (no hardcoded hex); cards never lift (hairline `--c-border`, `--c-surface-tint` hover, no shadow); no setState in effect.
- FE gates: `npx tsc -b --noEmit` (MUST use `-b`) + `npm run build`; lint only touched folder (`npx eslint src/features/decisions/`).
- BE gate: `./gradlew test` (baseline: 259 green on `main` post-Phase-2). Single class: `./gradlew test --tests "com.shareddocs.backend.decision.<Class>"`.
- **Anchor-date rule (deliberate simplification of the design's "completedAt ?? latest-decision-date ?? createdAt"):** anchor = `completedAt ?? createdAt`. The "latest decision date" tier is dropped — it would need a new per-plan max-decision-date backend field, and for a life *story* a decision's stable place on the timeline is when it entered your life (createdAt), not when it was last touched. Completed plans anchor at completion. This is the one design deviation; it needs no backend date field (only `childCount`).
- **Partition rule:** a root plan is **upcoming** iff `status === 'ACTIVE' && deadline != null && deadline > today` → it goes under the 예정 divider (sorted by deadline ascending), NOT on the main axis. Every other root plan goes on the main timeline (anchor ascending, grouped by `YYYY.MM`).
- `childCount` = count of live (deletedAt IS NULL) direct child plans, any status.
- Commit after each task, conventional commits (`feat(decisions): …`).

---

### Task 1: `childCount` on `PlanSummaryResponse`

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (add `childCount` to `PlanSummaryResponse`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt` (add `findAllByParentPlanIdInAndDeletedAtIsNull`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (`toSummary`, `summariesOf`, `summaryOf`, create-call, promote-call)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanChildCountTest.kt`

**Interfaces:**
- Consumes: existing `findAllByWorkspaceIdAndStatusAndParentPlanIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc`, `summariesOf`, `summaryOf`, `Plan.toSummary`.
- Produces: `PlanSummaryResponse.childCount: Int` (place after `decidedCount`); `PlanRepository.findAllByParentPlanIdInAndDeletedAtIsNull(parentPlanIds: Collection<Long>): List<Plan>`; `toSummary(subPlanCount, decidedCount, childCount)`. The FE (Task 2) reads `childCount`.

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/decision/PlanChildCountTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanChildCountTest(
    @Autowired private val service: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `list reports childCount of live direct children on each root`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "자동차 구입"))
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "브랜드 선정", parentPlanId = root.id))
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "보험 선택", parentPlanId = root.id))

        val summary = service.list(ws.id!!).first { it.id == root.id }
        assertEquals(2, summary.childCount)
    }

    @Test
    fun `childCount excludes trashed children`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val childA = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "A", parentPlanId = root.id))
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "B", parentPlanId = root.id))
        service.discard(ws.id!!, childA.id, owner.id!!)

        val summary = service.list(ws.id!!).first { it.id == root.id }
        assertEquals(1, summary.childCount)
    }

    @Test
    fun `a freshly created root has childCount 0`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "solo"))
        assertEquals(0, root.childCount)
        assertEquals(0, service.list(ws.id!!).first { it.id == root.id }.childCount)
    }

    @Test
    fun `only children of a plan count toward it, not grandchildren`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val root = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "root"))
        val child = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "child", parentPlanId = root.id))
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "grand", parentPlanId = child.id))

        // root has 1 direct child; the grandchild counts toward `child`, not `root`.
        // root is the only board root; assert via getTree-independent list call on a fresh 하위결정 fetch:
        val rootSummary = service.list(ws.id!!).first { it.id == root.id }
        assertEquals(1, rootSummary.childCount)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanChildCountTest"`
Expected: COMPILE FAILURE — `childCount` unresolved on `PlanSummaryResponse` / `root.childCount`.

- [ ] **Step 3: Implement**

`DecisionDto.kt` — add to `PlanSummaryResponse`, immediately after `decidedCount`:

```kotlin
    val childCount: Int,
```

`PlanRepository.kt` — add:

```kotlin
    fun findAllByParentPlanIdInAndDeletedAtIsNull(parentPlanIds: Collection<Long>): List<Plan>
```

`PlanService.kt`:

1. `toSummary` — add the parameter and field (place after `decidedCount`):

```kotlin
    private fun Plan.toSummary(subPlanCount: Int, decidedCount: Int, childCount: Int) = PlanSummaryResponse(
        id = id!!,
        title = title,
        description = description,
        status = status,
        canvasX = canvasX,
        canvasY = canvasY,
        groupLabel = groupLabel,
        parentPlanId = parentPlanId,
        subPlanCount = subPlanCount,
        decidedCount = decidedCount,
        childCount = childCount,
        createdByUserId = createdByUserId,
        createdAt = createdAt!!,
        lockedAt = lockedAt,
        lockedByUserId = lockedByUserId,
        deletedAt = deletedAt,
        deadline = deadline,
        completedAt = completedAt,
    )
```

2. `summariesOf` — add a child-count roll-up (one extra query, no N+1) and pass it through:

```kotlin
    private fun summariesOf(plans: List<Plan>): List<PlanSummaryResponse> {
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
        val childCountByParent = planRepository.findAllByParentPlanIdInAndDeletedAtIsNull(planIds)
            .groupingBy { it.parentPlanId!! }
            .eachCount()
        return plans.map { plan ->
            val sps = subPlansByPlan[plan.id] ?: emptyList()
            plan.toSummary(
                subPlanCount = sps.size,
                decidedCount = sps.count { it.id in decidedSubPlanIds },
                childCount = childCountByParent[plan.id] ?: 0,
            )
        }
    }
```

3. `summaryOf` (single-plan) — add a child count:

```kotlin
    private fun summaryOf(plan: Plan): PlanSummaryResponse {
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(plan.id!!)
        val subPlanIds = subPlans.mapNotNull { it.id }
        val decidedCount = if (subPlanIds.isEmpty()) 0
            else decisionRepository.findAllBySubPlanIdInAndSupersededAtIsNull(subPlanIds).size
        val childCount = planRepository.findAllByParentPlanIdInAndDeletedAtIsNull(listOf(plan.id!!)).size
        return plan.toSummary(subPlanCount = subPlans.size, decidedCount = decidedCount, childCount = childCount)
    }
```

4. The two remaining literal `toSummary` calls — a freshly created/promoted plan has no children yet, so pass `childCount = 0`:
   - In `create(...)` (the `return plan.toSummary(subPlanCount = 0, decidedCount = 0)` line): make it `plan.toSummary(subPlanCount = 0, decidedCount = 0, childCount = 0)`.
   - In `promoteSubPlan(...)` (the `.toSummary(subPlanCount = subPlanCount, decidedCount = 0)` line): make it `.toSummary(subPlanCount = subPlanCount, decidedCount = 0, childCount = 0)`.

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanChildCountTest"` → PASS (4 tests)
Run: `./gradlew test` → PASS (259 existing + 4). If any existing test builds a `PlanSummaryResponse` directly (grep `PlanSummaryResponse(`) it will need the new field — fix those constructions.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/ src/test/kotlin/com/shareddocs/backend/decision/PlanChildCountTest.kt
git commit -m "feat(decisions): childCount on PlanSummary — live direct sub-decisions per root"
```

---

### Task 2: FE `childCount` type + `storyGrouping` pure util

**Files (frontend repo):**
- Modify: `src/features/decisions/types.ts` (add `childCount` to `PlanSummary`)
- Create: `src/features/decisions/storyGrouping.ts`

**Interfaces:**
- Consumes: `PlanSummary` (now with `childCount`).
- Produces: `type StoryMonth = { key: string; label: string; plans: PlanSummary[] }`; `type StoryLayout = { months: StoryMonth[]; upcoming: PlanSummary[] }`; `function buildStoryLayout(plans: PlanSummary[], today: string): StoryLayout`; `function anchorDate(plan: PlanSummary): string`. Task 3 renders from these.

- [ ] **Step 1: types.ts**

Add `childCount: number` to `PlanSummary`, immediately after `decidedCount: number`.

- [ ] **Step 2: storyGrouping.ts**

```ts
import type { PlanSummary } from './types'

export type StoryMonth = {
  key: string          // 'YYYY-MM' — stable sort/react key
  label: string        // 'YYYY.MM' — display
  plans: PlanSummary[] // anchor-ascending within the month
}

export type StoryLayout = {
  months: StoryMonth[]      // ascending (oldest first)
  upcoming: PlanSummary[]   // future-deadline ACTIVE plans, deadline-ascending
}

/**
 * A plan's place on the life-story axis. completedAt when finished, else the
 * creation date — a decision sits where it entered your life. (The design's
 * "latest decision date" tier is intentionally dropped; see the plan's Global
 * Constraints.) Returns the ISO date portion (YYYY-MM-DD).
 */
export function anchorDate(plan: PlanSummary): string {
  const iso = plan.completedAt ?? plan.createdAt
  return iso.slice(0, 10)
}

/**
 * Partition root plans into a chronological timeline + an 예정 (upcoming) bucket.
 * Upcoming = ACTIVE with a future deadline (by `today`, a YYYY-MM-DD string);
 * everything else lands on the month-grouped axis by anchor date, oldest first.
 */
export function buildStoryLayout(plans: PlanSummary[], today: string): StoryLayout {
  const upcoming: PlanSummary[] = []
  const onAxis: PlanSummary[] = []
  for (const p of plans) {
    if (p.status === 'ACTIVE' && p.deadline != null && p.deadline > today) upcoming.push(p)
    else onAxis.push(p)
  }

  const byMonth = new Map<string, PlanSummary[]>()
  for (const p of onAxis) {
    const key = anchorDate(p).slice(0, 7) // YYYY-MM
    const arr = byMonth.get(key)
    if (arr) arr.push(p)
    else byMonth.set(key, [p])
  }

  const months: StoryMonth[] = [...byMonth.keys()]
    .sort() // 'YYYY-MM' lexicographic == chronological ascending
    .map((key) => ({
      key,
      label: key.replace('-', '.'),
      plans: byMonth.get(key)!.slice().sort((a, b) => anchorDate(a).localeCompare(anchorDate(b))),
    }))

  upcoming.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  return { months, upcoming }
}
```

- [ ] **Step 3: Gates + commit**

Run: `npx tsc -b --noEmit` → clean; `npm run build` → success; `npx eslint src/features/decisions/` → no new errors.

```bash
git add src/features/decisions/types.ts src/features/decisions/storyGrouping.ts
git commit -m "feat(decisions): childCount type + buildStoryLayout — chronological grouping for 스토리 뷰"
```

---

### Task 3: `StoryView` component + 스토리 tab in DecisionList

**Files (frontend repo):**
- Create: `src/features/decisions/StoryView.tsx`
- Create: `src/features/decisions/StoryView.module.css`
- Modify: `src/features/decisions/DecisionList.tsx` (add the tab + render)

**Interfaces:**
- Consumes: Task 2's `buildStoryLayout`/`StoryLayout`; existing `usePlans()` data (already fetched in DecisionList as `plans`); `DeadlineChip`; `toLocalDateString` from `./deadlineLabel`.
- Produces: `<StoryView plans={plans} onOpen={(id) => void} />`.

- [ ] **Step 1: `StoryView.tsx`**

```tsx
import { useMemo } from 'react'
import { GitFork } from 'lucide-react'
import DeadlineChip from './DeadlineChip'
import { toLocalDateString } from './deadlineLabel'
import { buildStoryLayout } from './storyGrouping'
import type { PlanSummary } from './types'
import styles from './StoryView.module.css'

type Props = {
  plans: PlanSummary[]
  onOpen: (id: number) => void
}

const MAX_DOTS = 8

/** 스토리 뷰 — root decisions on a vertical time axis (oldest at top),
 *  grouped by month, with an 예정 bucket for future-deadline decisions. */
export default function StoryView({ plans, onOpen }: Props) {
  const today = toLocalDateString(new Date())
  const layout = useMemo(() => buildStoryLayout(plans, today), [plans, today])

  return (
    <div className={styles.story}>
      {layout.months.map((month) => (
        <section key={month.key} className={styles.month}>
          <div className={styles.axisMarker}>{month.label}</div>
          <div className={styles.cards}>
            {month.plans.map((p) => (
              <StoryCard key={p.id} plan={p} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}

      {layout.upcoming.length > 0 && (
        <section className={styles.month}>
          <div className={`${styles.axisMarker} ${styles.upcomingMarker}`}>예정</div>
          <div className={styles.cards}>
            {layout.upcoming.map((p) => (
              <StoryCard key={p.id} plan={p} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StoryCard({ plan, onOpen }: { plan: PlanSummary; onOpen: (id: number) => void }) {
  const done = plan.status === 'COMPLETED'
  const dotCount = Math.min(plan.childCount, MAX_DOTS)
  return (
    <button type="button" className={styles.card} onClick={() => onOpen(plan.id)}>
      <span className={styles.cardHead}>
        <span className={styles.cardTitle}>{plan.title}</span>
        <span className={done ? styles.done : styles.active}>{done ? '완료' : '진행 중'}</span>
        <DeadlineChip
          deadline={plan.deadline}
          settledAt={done ? plan.completedAt : null}
          settledNoun="완료"
          editable={false}
        />
      </span>
      {plan.childCount > 0 && (
        <span className={styles.cluster}>
          <GitFork size={12} aria-hidden />
          <span className={styles.dots} aria-hidden>
            {Array.from({ length: dotCount }, (_, i) => (
              <span key={i} className={styles.dot} />
            ))}
          </span>
          <span className={styles.clusterCount}>하위결정 {plan.childCount}</span>
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: `StoryView.module.css`**

```css
.story {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  padding-left: var(--sp-4);
  border-left: 1px solid var(--c-border);
  margin-left: var(--sp-2);
}

.month {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.axisMarker {
  position: relative;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-muted);
}

/* the node on the axis line */
.axisMarker::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--sp-4) - 5px);
  top: 50%;
  transform: translateY(-50%);
  width: 9px;
  height: 9px;
  border-radius: var(--r-pill);
  background: var(--c-primary);
  border: 2px solid var(--c-bg);
}

.upcomingMarker {
  color: var(--c-text-subtle);
}

.upcomingMarker::before {
  background: var(--c-border-strong);
}

.cards {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  background: var(--c-surface);
  cursor: pointer;
  text-align: left;
  transition: background var(--t-fast);
}

.card:hover {
  background: var(--c-surface-tint);
}

.cardHead {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.cardTitle {
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--c-text);
}

.active {
  font-size: var(--fs-xs);
  color: var(--c-primary);
}

.done {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}

.cluster {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-text-subtle);
}

.dots {
  display: inline-flex;
  gap: 3px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: var(--r-pill);
  background: var(--c-primary-soft-strong);
}

.clusterCount {
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}
```

- [ ] **Step 3: Wire the 스토리 tab into DecisionList.tsx**

1. Add the import: `import StoryView from './StoryView'`.
2. Widen the `Tab` type: `type Tab = 'board' | 'story' | 'completed' | 'trash' | 'feed'`.
3. Add the tab to the `Tabs` `items` array, right after `board`:
   ```tsx
   { key: 'board', label: '보드' }, { key: 'story', label: '스토리' }, { key: 'completed', label: '완료' }, { key: 'trash', label: '휴지통' }, { key: 'feed', label: '활동' },
   ```
4. Add the render block (after the `tab === 'board'` block, before `tab === 'completed'`):
   ```tsx
   {tab === 'story' && (
     <>
       {isLoading && <div className={styles.list}><Skeleton height={84} radius="var(--r-md)" /></div>}
       {isError && <ErrorState error={error} onRetry={() => refetch()} />}
       {plans && plans.length === 0 && (
         <EmptyState icon={<Vote size={24} strokeWidth={1.5} />} title="아직 계획이 없어요"
                     description="계획을 추가하면 시간순 스토리로 볼 수 있어요." />
       )}
       {plans && plans.length > 0 && <StoryView plans={plans} onOpen={(id) => navigate(`/decisions/${id}`)} />}
     </>
   )}
   ```
5. The 계획 추가 Fab is currently gated `tab === 'board'`. Show it on the story tab too — change that line to `{(tab === 'board' || tab === 'story') && <Fab … />}`.

- [ ] **Step 4: Gates + commit**

Run: `npx tsc -b --noEmit` && `npm run build` && `npx eslint src/features/decisions/` → clean.
Manual (`npm run dev`): 결정 → 스토리 tab → root plans appear on a vertical axis, oldest month at top, month markers with axis dots; a completed plan shows 완료 + anchored at its completion month; a plan with a future deadline sits under the 예정 divider; a plan with sub-decisions shows the dot-cluster + count; clicking a card opens that plan (and zooms, from Phase 1). Add a plan via the Fab while on the story tab.

```bash
git add src/features/decisions/StoryView.tsx src/features/decisions/StoryView.module.css src/features/decisions/DecisionList.tsx
git commit -m "feat(decisions): 스토리 뷰 — chronological life-story board tab"
```

---

### Task 4: Docs sync, full gates, deploy

**Files:**
- Modify: `CLAUDE.md` (frontend repo)
- Both repos: final verification + push

- [ ] **Step 1: CLAUDE.md**

1. Feature-status table — add: `| Decisions 스토리 뷰 (Life Story Board Phase 3) | **Shipped 2026-07-08.** A 스토리 tab on the 결정 board: root decisions on a vertical time axis (oldest top), month-grouped by anchor date (completedAt ?? createdAt), status + deadline chip + sub-decision dot-cluster (`childCount` added to PlanSummary), future-deadline decisions under an 예정 divider. Client-only + one BE field, no migration. **This completes the Life Story Board (Phases 1-3).** Design/plan: docs/plans/2026-07-08-story-view-plan.md. |`
2. In the Phase-1 and Phase-2 header entries, change "Phase 3 (스토리 뷰) pending/designed but unbuilt" → note it shipped (or add a dated Phase 3 header entry).
3. No Flyway change (still V24).

- [ ] **Step 2: Full gates, both repos**

Backend: `./gradlew test` → all green.
Frontend: `npx tsc -b --noEmit` && `npm run build` && `npx eslint src/features/decisions/` → clean.

- [ ] **Step 3: Commit docs, push both repos, verify deploy**

```bash
# frontend repo
git add CLAUDE.md docs/plans/2026-07-08-story-view-plan.md
git commit -m "docs: 스토리 뷰 shipped — Life Story Board complete (Phase 3)"
git push origin main
# backend repo
git push origin main
```

Backend deploy (this machine is the CD runner): a `childCount` field addition is not a migration, but the BE still redeploys. Verify: `docker logs shared-docs-backend 2>&1 | grep -iE "Started SharedDocs|Flyway" | tail` (Flyway validates V24, no new migration) + `curl -s localhost:8090/actuator/health` → UP. **If the CD build fails at the ~60s `DeadlineExceeded` base-image metadata step, that's the known transient Docker Hub issue — pre-pull `eclipse-temurin:17-jdk`/`17-jre` then push an empty commit to retrigger (see the Phase 2 deploy note).** Frontend builds on Vercel cloud-side.

- [ ] **Step 4: Manual smoke checklist (user)**

- 결정 → 스토리 tab renders root plans on the axis, oldest month at top.
- A completed plan anchors at its completion month with a 완료 chip; an active plan anchors at its creation month.
- A plan with a future deadline appears under the 예정 divider (deadline-ascending), not on the main axis.
- A plan with sub-decisions shows the dot-cluster + "하위결정 N"; clicking any card opens/zooms into that plan.
- Adding a plan via the Fab works while the story tab is active.
