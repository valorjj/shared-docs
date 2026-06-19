# Cross-Workspace Calendar (전체 워크스페이스) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "all workspaces" mode to the existing calendar — one merged month grid pulling 기념일/할 일/구매/정산 events from every workspace the user is an active member of, with a workspace filter axis and click-through that switches the active workspace.

**Architecture:** Backend Approach A — extract the four event builders out of `CalendarController` into a `CalendarService` keyed by a list of workspace IDs; add `eventsAcrossWorkspaces(userId, …)` that resolves the caller's active memberships (reusing `WorkspaceRepository.findAllForUser`) and a thin `GET /api/calendar/events/all` controller endpoint that steps outside the `X-Workspace-Id` choke point but re-enforces membership. Frontend adds an `allWorkspaces` toggle on `CalendarPage`, a second per-workspace filter axis, workspace labels, and a click handler that calls `setActiveId` before navigating.

**Tech Stack:** Kotlin / Spring Boot 3.5 / JPA (backend, JUnit 5 service-level tests); React 19 / TypeScript / TanStack Query / react-day-picker (frontend).

## Global Constraints

- Backend tests are **service-level** `@SpringBootTest @ActiveProfiles("test") @Transactional`, constructor-injected, mirroring `TodoWorkspaceIsolationTest`. Create users via `userRepository.save(User(email = uniqueEmail(), name = …, role = Role.USER))` and workspaces via `workspaceService.create(userId, name, slug)`.
- Backend uses `ddl-auto: validate` — **no schema change in this feature** (no migration), all four sources already exist.
- The v2 invariant: a request only ever touches data in a workspace the caller is an active member of. The `/all` endpoint relaxes the *header* mechanism but MUST re-enforce membership by deriving workspace IDs solely from `WorkspaceRepository.findAllForUser(userId)` (which already filters `leftAt IS NULL` and `deletedAt IS NULL`).
- All UI text is Korean. The toggle label is `전체 워크스페이스`.
- Frontend gate (no Jest page-tests in this repo): each FE task ends with `npx tsc -b --noEmit` clean, `npx eslint src/features/calendar src/pages/CalendarPage.tsx` 0 errors, and `npm run build` succeeds. Lint only the touched paths (repo-wide `eslint src/` is pre-existing red).
- Existing `CalendarEvent` field order/types and sort `(date, type, refId)` must be preserved.

---

## File Structure

**Backend (`shared-docs-backend/`)**
- Create `src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt` — owns the four event builders + `CalendarEvent` DTO + membership resolution. One responsibility: produce merged calendar events for a set of workspaces.
- Modify `src/main/kotlin/com/shareddocs/backend/calendar/CalendarController.kt` — becomes two thin endpoints delegating to the service; `CalendarEvent` data class moves out to the service file.
- Create `src/test/kotlin/com/shareddocs/backend/calendar/CalendarServiceTest.kt` — multi-workspace merge + membership isolation.

**Frontend (`shared-docs/`)**
- Modify `src/features/calendar/api.ts` — `CalendarEvent` type gains `workspaceId`/`workspaceName`; `useCalendarEvents` gains an `all` flag and `/events/all` fetch.
- Modify `src/pages/CalendarPage.tsx` — `allWorkspaces` toggle, workspace filter axis, labels, click→switch→navigate.
- Modify `src/pages/CalendarPage.module.css` — small style for the workspace label (one rule).

---

## Task 1: Extract `CalendarService` (workspace-ID-keyed) and delegate `/events` to it

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarController.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/calendar/CalendarServiceTest.kt`

**Interfaces:**
- Produces:
  - `data class CalendarEvent(... existing fields ..., val workspaceId: Long, val workspaceName: String)` — two fields appended after `currency`.
  - `CalendarService.events(workspaceIds: List<Long>, from: LocalDate, to: LocalDate): List<CalendarEvent>` — merges all sources for the given workspaces, sorted `(date, type, refId)`. Empty `workspaceIds` → empty list. `from.isAfter(to)` → `ResponseStatusException(BAD_REQUEST)`.
- Consumes: `AnniversaryRepository`, `TodoRepository`, `PurchaseRepository`, `SettlementRepository` (existing), plus `WorkspaceRepository.findAllForUser` (used in Task 2; injected now).

- [ ] **Step 1: Write the failing test**

Create `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/calendar/CalendarServiceTest.kt`:

```kotlin
package com.shareddocs.backend.calendar

import com.shareddocs.backend.anniversary.AnniversaryService
import com.shareddocs.backend.anniversary.CreateAnniversaryRequest
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CalendarServiceTest(
    @Autowired private val calendar: CalendarService,
    @Autowired private val anniversaries: AnniversaryService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun uniqueEmail(): String = "u-${java.util.UUID.randomUUID()}@test.example"

    @Test
    fun `events merges across multiple workspaces and stamps workspace name`() {
        val user = userRepository.save(User(email = uniqueEmail(), name = "Owner", role = Role.USER))
        val wsA = workspaces.create(user.id!!, "Alpha", "alpha-${user.id}")
        val wsB = workspaces.create(user.id!!, "Beta", "beta-${user.id}")
        anniversaries.create(CreateAnniversaryRequest(name = "A-day", date = LocalDate.of(2026, 6, 10), recurring = false, category = null), wsA.id!!)
        anniversaries.create(CreateAnniversaryRequest(name = "B-day", date = LocalDate.of(2026, 6, 20), recurring = false, category = null), wsB.id!!)

        val events = calendar.events(listOf(wsA.id!!, wsB.id!!), LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30))

        assertTrue(events.any { it.title == "A-day" && it.workspaceId == wsA.id && it.workspaceName == "Alpha" })
        assertTrue(events.any { it.title == "B-day" && it.workspaceId == wsB.id && it.workspaceName == "Beta" })
    }

    @Test
    fun `events for a single workspace excludes other workspaces`() {
        val user = userRepository.save(User(email = uniqueEmail(), name = "Owner", role = Role.USER))
        val wsA = workspaces.create(user.id!!, "Alpha", "alpha-${user.id}")
        val wsB = workspaces.create(user.id!!, "Beta", "beta-${user.id}")
        anniversaries.create(CreateAnniversaryRequest(name = "B-only", date = LocalDate.of(2026, 6, 20), recurring = false, category = null), wsB.id!!)

        val events = calendar.events(listOf(wsA.id!!), LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30))

        assertEquals(0, events.count { it.title == "B-only" })
    }
}
```

> **Before writing the test, open `AnniversaryService.create` and `CreateAnniversaryRequest`** (`shared-docs-backend/.../anniversary/AnniversaryService.kt`, `AnniversaryDto.kt`) and adjust the constructor call to the real parameter names/types if they differ from `(name, date, recurring, category)` + `(request, workspaceId)`. Use the exact signature the codebase has.

- [ ] **Step 2: Run the test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.calendar.CalendarServiceTest"`
Expected: FAIL — `CalendarService` does not exist (compilation error / unresolved reference).

- [ ] **Step 3: Create `CalendarService` by moving the builders out of the controller**

Create `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt`. Move the `CalendarEvent` data class and all four private builders out of `CalendarController` into this service, changing each builder to accept a `workspaceName: String` and stamp `workspaceId`/`workspaceName` on every event:

```kotlin
package com.shareddocs.backend.calendar

import com.shareddocs.backend.anniversary.AnniversaryRepository
import com.shareddocs.backend.purchase.PurchaseRepository
import com.shareddocs.backend.settlement.SettlementRepository
import com.shareddocs.backend.todo.TodoRepository
import com.shareddocs.backend.workspace.WorkspaceRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset

data class CalendarEvent(
    val date: LocalDate,
    val type: String,            // "anniversary" | "todo" | "purchase" | "settlement"
    val refId: Long,
    val title: String,
    val category: String?,
    val color: String? = null,
    val icon: String? = null,
    val recurring: Boolean? = null,
    val done: Boolean? = null,
    val amount: BigDecimal? = null,
    val currency: String? = null,
    val workspaceId: Long,
    val workspaceName: String,
)

@Service
class CalendarService(
    private val anniversaryRepository: AnniversaryRepository,
    private val todoRepository: TodoRepository,
    private val purchaseRepository: PurchaseRepository,
    private val settlementRepository: SettlementRepository,
    private val workspaceRepository: WorkspaceRepository,
) {
    fun events(workspaceIds: List<Long>, from: LocalDate, to: LocalDate): List<CalendarEvent> {
        if (from.isAfter(to)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be on or before 'to'")
        }
        if (workspaceIds.isEmpty()) return emptyList()
        val names = workspaceRepository.findAllById(workspaceIds).associate { it.id!! to it.name }
        return buildList {
            for (wsId in workspaceIds) {
                val wsName = names[wsId] ?: continue
                addAll(anniversaryEvents(from, to, wsId, wsName))
                addAll(todoEvents(from, to, wsId, wsName))
                addAll(purchaseEvents(from, to, wsId, wsName))
                addAll(settlementEvents(from, to, wsId, wsName))
            }
        }.sortedWith(compareBy({ it.date }, { it.type }, { it.refId }))
    }

    private fun anniversaryEvents(from: LocalDate, to: LocalDate, workspaceId: Long, workspaceName: String): List<CalendarEvent> {
        val anniversaries = anniversaryRepository.findAllByWorkspaceIdOrderByDateAscIdAsc(workspaceId)
        val events = mutableListOf<CalendarEvent>()
        for (a in anniversaries) {
            if (a.recurring) {
                for (year in from.year..to.year) {
                    val occurrence = safeDate(year, a.date.monthValue, a.date.dayOfMonth)
                    if (occurrence != null && !occurrence.isBefore(from) && !occurrence.isAfter(to)) {
                        events += CalendarEvent(
                            date = occurrence, type = "anniversary", refId = a.id!!, title = a.name,
                            category = a.category, recurring = true,
                            workspaceId = workspaceId, workspaceName = workspaceName,
                        )
                    }
                }
            } else if (!a.date.isBefore(from) && !a.date.isAfter(to)) {
                events += CalendarEvent(
                    date = a.date, type = "anniversary", refId = a.id!!, title = a.name,
                    category = a.category, recurring = false,
                    workspaceId = workspaceId, workspaceName = workspaceName,
                )
            }
        }
        return events
    }

    private fun todoEvents(from: LocalDate, to: LocalDate, workspaceId: Long, workspaceName: String): List<CalendarEvent> {
        return todoRepository.findOpenDueBy(workspaceId, to)
            .asSequence()
            .filter { it.due != null && !it.due!!.isBefore(from) }
            .map {
                CalendarEvent(
                    date = it.due!!, type = "todo", refId = it.id!!, title = it.task,
                    category = it.category, done = false,
                    workspaceId = workspaceId, workspaceName = workspaceName,
                )
            }
            .toList()
    }

    private fun purchaseEvents(from: LocalDate, to: LocalDate, workspaceId: Long, workspaceName: String): List<CalendarEvent> {
        return purchaseRepository
            .findAllByWorkspaceIdAndDateBetweenOrderByDateDescIdDesc(workspaceId, from, to)
            .map {
                CalendarEvent(
                    date = it.date, type = "purchase", refId = it.id!!, title = it.item,
                    category = it.category, amount = it.amount, currency = it.currency,
                    workspaceId = workspaceId, workspaceName = workspaceName,
                )
            }
    }

    private fun settlementEvents(from: LocalDate, to: LocalDate, workspaceId: Long, workspaceName: String): List<CalendarEvent> {
        val start = from.atStartOfDay(ZoneOffset.UTC).toInstant()
        val end = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
        return settlementRepository
            .findAllByWorkspaceIdAndSettledAtBetween(workspaceId, start, end)
            .map {
                CalendarEvent(
                    date = it.settledAt.atZone(ZoneOffset.UTC).toLocalDate(), type = "settlement",
                    refId = it.id!!, title = "${it.payer.name} → ${it.recipient.name}", category = null,
                    amount = it.amount, currency = it.currency,
                    workspaceId = workspaceId, workspaceName = workspaceName,
                )
            }
    }

    private fun safeDate(year: Int, month: Int, day: Int): LocalDate? {
        return try {
            LocalDate.of(year, month, day)
        } catch (_: Exception) {
            if (month == 2 && day == 29) LocalDate.of(year, 2, 28) else null
        }
    }
}
```

- [ ] **Step 4: Reduce `CalendarController` to delegate to the service**

Replace the body of `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarController.kt` (remove the `CalendarEvent` class and the four builders + `safeDate` — they now live in the service):

```kotlin
package com.shareddocs.backend.calendar

import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/calendar")
class CalendarController(
    private val calendarService: CalendarService,
) {
    @GetMapping("/events")
    fun events(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
        @CurrentWorkspace ws: Workspace,
    ): List<CalendarEvent> = calendarService.events(listOf(ws.id!!), from, to)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.calendar.CalendarServiceTest"`
Expected: PASS (both tests). If `AnniversaryService.create`'s signature differed, fix the test call per the Step 1 note and re-run.

- [ ] **Step 6: Run the full backend build to confirm no regression**

Run: `./gradlew build -x test && ./gradlew test`
Expected: BUILD SUCCESSFUL — the existing `/events` path still compiles and all prior tests stay green.

- [ ] **Step 7: Commit**

```bash
cd shared-docs-backend
git add src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt \
        src/main/kotlin/com/shareddocs/backend/calendar/CalendarController.kt \
        src/test/kotlin/com/shareddocs/backend/calendar/CalendarServiceTest.kt
git commit -m "refactor(calendar): extract CalendarService keyed by workspace ids + stamp workspace on events"
```

---

## Task 2: Add `eventsAcrossWorkspaces` + the `GET /api/calendar/events/all` endpoint

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarController.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/calendar/CalendarServiceTest.kt`

**Interfaces:**
- Consumes: `CalendarService.events(...)` (Task 1), `WorkspaceRepository.findAllForUser(userId): List<Workspace>` (existing — filters `leftAt IS NULL` + `deletedAt IS NULL`), `AppPrincipal.userId` (existing).
- Produces:
  - `CalendarService.eventsAcrossWorkspaces(userId: Long, from: LocalDate, to: LocalDate): List<CalendarEvent>` — resolves the caller's active-member workspaces and merges their events.
  - `GET /api/calendar/events/all` → `@AuthenticationPrincipal me: AppPrincipal` → returns `List<CalendarEvent>`.

- [ ] **Step 1: Write the failing test**

Append to `CalendarServiceTest.kt`:

```kotlin
    @Test
    fun `eventsAcrossWorkspaces includes all active memberships and excludes left workspaces`() {
        val user = userRepository.save(User(email = uniqueEmail(), name = "Owner", role = Role.USER))
        val other = userRepository.save(User(email = uniqueEmail(), name = "Other", role = Role.USER))
        val wsA = workspaces.create(user.id!!, "Alpha", "alpha-${user.id}")
        val wsB = workspaces.create(user.id!!, "Beta", "beta-${user.id}")
        val wsForeign = workspaces.create(other.id!!, "Foreign", "foreign-${other.id}")
        anniversaries.create(CreateAnniversaryRequest(name = "in-A", date = LocalDate.of(2026, 6, 5), recurring = false, category = null), wsA.id!!)
        anniversaries.create(CreateAnniversaryRequest(name = "in-B", date = LocalDate.of(2026, 6, 15), recurring = false, category = null), wsB.id!!)
        anniversaries.create(CreateAnniversaryRequest(name = "in-foreign", date = LocalDate.of(2026, 6, 25), recurring = false, category = null), wsForeign.id!!)

        val events = calendar.eventsAcrossWorkspaces(user.id!!, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30))
        val titles = events.map { it.title }.toSet()

        assertTrue(titles.contains("in-A"))
        assertTrue(titles.contains("in-B"))
        assertEquals(0, events.count { it.title == "in-foreign" })
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.calendar.CalendarServiceTest"`
Expected: FAIL — `eventsAcrossWorkspaces` is unresolved.

- [ ] **Step 3: Add `eventsAcrossWorkspaces` to `CalendarService`**

Add this method to `CalendarService` (below `events`):

```kotlin
    /**
     * Cross-workspace calendar for a single user. Steps outside the
     * X-Workspace-Id / @CurrentWorkspace choke point on purpose, so it re-enforces
     * the members-only invariant itself: the workspace ids come ONLY from
     * findAllForUser (active memberships, non-deleted workspaces). A workspace the
     * user has left or never joined can never appear here.
     */
    fun eventsAcrossWorkspaces(userId: Long, from: LocalDate, to: LocalDate): List<CalendarEvent> {
        val ids = workspaceRepository.findAllForUser(userId).map { it.id!! }
        return events(ids, from, to)
    }
```

- [ ] **Step 4: Add the `/events/all` endpoint to `CalendarController`**

Add the import and method to `CalendarController`:

```kotlin
import com.shareddocs.backend.auth.AppPrincipal
import org.springframework.security.core.annotation.AuthenticationPrincipal
```

```kotlin
    @GetMapping("/events/all")
    fun eventsAcrossWorkspaces(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
        @AuthenticationPrincipal me: AppPrincipal,
    ): List<CalendarEvent> = calendarService.eventsAcrossWorkspaces(me.userId, from, to)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.calendar.CalendarServiceTest"`
Expected: PASS (all three tests).

- [ ] **Step 6: Confirm full build**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
cd shared-docs-backend
git add src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt \
        src/main/kotlin/com/shareddocs/backend/calendar/CalendarController.kt \
        src/test/kotlin/com/shareddocs/backend/calendar/CalendarServiceTest.kt
git commit -m "feat(calendar): GET /api/calendar/events/all — cross-workspace merge, membership-enforced"
```

---

## Task 3: Frontend data layer — workspace fields + `all` mode in `useCalendarEvents`

**Files:**
- Modify: `shared-docs/src/features/calendar/api.ts`

**Interfaces:**
- Consumes: `apiClient` (existing), `useActiveWorkspace` (existing, returns `{ activeId: number | null }`).
- Produces:
  - `CalendarEvent` type with `workspaceId: number` + `workspaceName: string`.
  - `useCalendarEvents(from: string, to: string, all: boolean)` — `all` selects `/api/calendar/events/all`; query key disambiguates the two modes.
  - `calendarKeys.events(wsId, from, to)` extended to take an `all` flag.

- [ ] **Step 1: Add the workspace fields to the `CalendarEvent` type**

In `src/features/calendar/api.ts`, add to the `CalendarEvent` type (after `currency`):

```typescript
  amount: number | null
  currency: string | null
  workspaceId: number
  workspaceName: string
}
```

- [ ] **Step 2: Extend the query keys and fetch for `all` mode**

Replace `calendarKeys` and `fetchEvents` with:

```typescript
export const calendarKeys = {
  scope: (wsId: number | null) => ['calendar', wsId] as const,
  events: (wsId: number | null, all: boolean, from: string, to: string) =>
    ['calendar', all ? 'all' : wsId, 'events', from, to] as const,
}

async function fetchEvents(from: string, to: string, all: boolean): Promise<CalendarEvent[]> {
  const path = all ? '/api/calendar/events/all' : '/api/calendar/events'
  const { data } = await apiClient.get<CalendarEvent[]>(path, { params: { from, to } })
  return data
}
```

- [ ] **Step 3: Add the `all` parameter to `useCalendarEvents`**

Replace `useCalendarEvents` with:

```typescript
export function useCalendarEvents(from: string, to: string, all: boolean) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: calendarKeys.events(activeId, all, from, to),
    queryFn: () => fetchEvents(from, to, all),
    // per-workspace mode needs an active workspace; all-mode does not.
    enabled: (all || activeId != null) && !!(from && to),
  })
}
```

> The `apiClient` interceptor still attaches `X-Workspace-Id` to the `/all` request; that's harmless — the backend endpoint has no `@CurrentWorkspace` and ignores it, and `WorkspaceContextFilter` passes a valid active-member header through. No interceptor change needed.

- [ ] **Step 4: Type-check (the caller in Step's Task 4 will be updated next; expect one error here)**

Run: `cd shared-docs && npx tsc -b --noEmit`
Expected: ONE error in `src/pages/CalendarPage.tsx` — `useCalendarEvents` now requires a third argument. This is expected and fixed in Task 4. Do not commit yet.

- [ ] **Step 5: Commit together with Task 4**

This task has no independently-green state (it breaks the one caller by design). Commit it together with Task 4's call-site update. Proceed directly to Task 4.

---

## Task 4: `allWorkspaces` toggle on `CalendarPage`

**Files:**
- Modify: `shared-docs/src/pages/CalendarPage.tsx`

**Interfaces:**
- Consumes: `useCalendarEvents(from, to, all)` (Task 3).
- Produces: `allWorkspaces` state + a `전체 워크스페이스` toggle button in the header and in the mobile filter sheet.

- [ ] **Step 1: Add the `allWorkspaces` state and pass it to the hook**

In `CalendarPage`, add the state near the other `useState` calls (after `filtersSheetOpen`):

```typescript
  const [allWorkspaces, setAllWorkspaces] = useState(false)
```

Update the hook call:

```typescript
  const { data: events, isLoading: eventsLoading } = useCalendarEvents(range.from, range.to, allWorkspaces)
```

- [ ] **Step 2: Add the toggle button in the header action row**

Find the header action row containing `<Button variant="outline" size="sm" onClick={goToday}>오늘</Button>` (around line 160) and add, immediately before that button:

```tsx
          <Button
            variant={allWorkspaces ? 'soft' : 'outline'}
            size="sm"
            onClick={() => setAllWorkspaces((v) => !v)}
            aria-pressed={allWorkspaces}
          >
            전체 워크스페이스
          </Button>
```

- [ ] **Step 3: Mirror the toggle inside the mobile filter sheet**

Inside `<AppSidebarSheet ... title="일정 필터">`, add a section above the existing `일정 종류` section:

```tsx
          <AppSidebarSection label="범위">
            <AppSidebarItem
              Icon={Filter}
              label="전체 워크스페이스"
              active={allWorkspaces}
              onClick={() => setAllWorkspaces((v) => !v)}
            />
          </AppSidebarSection>
```

- [ ] **Step 4: Type-check, lint, build**

Run:
```bash
cd shared-docs
npx tsc -b --noEmit
npx eslint src/features/calendar src/pages/CalendarPage.tsx
npm run build
```
Expected: tsc clean (the Task 3 error is resolved), eslint 0 errors on these paths, build succeeds.

- [ ] **Step 5: Commit (Tasks 3 + 4 together)**

```bash
cd shared-docs
git add src/features/calendar/api.ts src/pages/CalendarPage.tsx
git commit -m "feat(calendar-fe): 전체 워크스페이스 toggle — fetch /events/all in all-mode"
```

---

## Task 5: Second filter axis — per-workspace chips (all-mode only)

**Files:**
- Modify: `shared-docs/src/pages/CalendarPage.tsx`

**Interfaces:**
- Consumes: `events` (each carries `workspaceId`/`workspaceName`), `allWorkspaces` (Task 4).
- Produces: `enabledWorkspaces: Set<number>` filter state + a `WorkspaceFilters` chip list rendered only in all-mode; the display predicate now ANDs source and workspace.

- [ ] **Step 1: Derive the workspaces present this month and their counts**

Add, after the existing `sourceCounts` memo:

```typescript
  const workspacesInView = useMemo(() => {
    const map = new Map<number, { name: string; count: number }>()
    for (const e of events ?? []) {
      const cur = map.get(e.workspaceId)
      if (cur) cur.count++
      else map.set(e.workspaceId, { name: e.workspaceName, count: 1 })
    }
    return Array.from(map, ([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [events])

  const [enabledWorkspaces, setEnabledWorkspaces] = useState<Set<number>>(new Set())

  // When the set of visible workspaces changes (mode flip / month change),
  // default every present workspace to ON.
  useEffect(() => {
    setEnabledWorkspaces(new Set(workspacesInView.map((w) => w.id)))
  }, [workspacesInView])
```

Add `useEffect` to the React import at the top of the file (`import { useEffect, useMemo, useState } from 'react'`).

- [ ] **Step 2: Apply the workspace axis to `visibleEvents`**

Replace the existing `visibleEvents` memo with:

```typescript
  const visibleEvents = useMemo(
    () =>
      (events ?? []).filter(
        (e) => enabled.has(e.type) && (!allWorkspaces || enabledWorkspaces.has(e.workspaceId)),
      ),
    [events, enabled, allWorkspaces, enabledWorkspaces],
  )
```

- [ ] **Step 3: Add the toggle handler and the chip component**

Add the handler near `toggleSource`:

```typescript
  const toggleWorkspace = (id: number) => {
    setEnabledWorkspaces((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
```

Add a `WorkspaceFilters` component next to `SourceFilters`:

```tsx
function WorkspaceFilters({
  workspaces,
  enabled,
  onToggle,
}: {
  workspaces: { id: number; name: string; count: number }[]
  enabled: Set<number>
  onToggle: (id: number) => void
}) {
  return (
    <>
      {workspaces.map((w) => (
        <AppSidebarItem
          key={w.id}
          Icon={Layers}
          label={w.name}
          count={w.count}
          active={enabled.has(w.id)}
          onClick={() => onToggle(w.id)}
        />
      ))}
    </>
  )
}
```

Add `Layers` to the `lucide-react` import at the top of the file.

- [ ] **Step 4: Render the workspace filters in the mobile sheet (all-mode only)**

Inside `<AppSidebarSheet ... title="일정 필터">`, after the `일정 종류` section, add:

```tsx
          {allWorkspaces && (
            <AppSidebarSection label="워크스페이스">
              <WorkspaceFilters
                workspaces={workspacesInView}
                enabled={enabledWorkspaces}
                onToggle={toggleWorkspace}
              />
            </AppSidebarSection>
          )}
```

> If the page has a **desktop** sidebar rendering `<SourceFilters .../>` directly (look for a non-`isMobile` `AppSidebar` block alongside the sheet), add the same `allWorkspaces && (<AppSidebarSection label="워크스페이스">…)` block there too, right after the desktop `SourceFilters`. Use the identical props.

- [ ] **Step 5: Type-check, lint, build**

Run:
```bash
cd shared-docs
npx tsc -b --noEmit
npx eslint src/pages/CalendarPage.tsx
npm run build
```
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
cd shared-docs
git add src/pages/CalendarPage.tsx
git commit -m "feat(calendar-fe): per-workspace filter chips in 전체 워크스페이스 mode"
```

---

## Task 6: Workspace label on events + click → switch workspace → navigate

**Files:**
- Modify: `shared-docs/src/pages/CalendarPage.tsx`
- Modify: `shared-docs/src/pages/CalendarPage.module.css`

**Interfaces:**
- Consumes: `useActiveWorkspace` (`setActiveId`), `allWorkspaces`, `EventRow`.
- Produces: `EventRow` shows a workspace-name label in all-mode; `handleEventClick` switches the active workspace before navigating.

- [ ] **Step 1: Pull `setActiveId` into the page**

At the top of `CalendarPage`, where hooks are called, add:

```typescript
  const { setActiveId } = useActiveWorkspace()
```

Add the import at the top of the file:

```typescript
import { useActiveWorkspace } from '../auth/useActiveWorkspace'
```

- [ ] **Step 2: Switch the active workspace before navigating**

Replace the body of `handleEventClick` so it switches first when in all-mode:

```typescript
  const handleEventClick = (e: CalendarEvent) => {
    if (allWorkspaces) setActiveId(e.workspaceId)
    const ym = e.date.slice(0, 7)
    switch (e.type) {
      case 'anniversary':
        navigate('/data/anniversaries')
        break
      case 'todo':
        navigate('/data/todos')
        break
      case 'purchase':
        navigate(`/data/purchases?month=${ym}&row=${e.refId}`)
        break
      case 'settlement':
        navigate(`/data/purchases?month=${ym}`)
        break
    }
  }
```

> `setActiveId` updates the stored active workspace synchronously before `navigate` runs, so the destination page's queries (keyed by active workspace) mount against the event's workspace. No `await` is needed — `setActiveId` is a synchronous state/storage update.

- [ ] **Step 3: Pass the workspace name into `EventRow` and render it**

Update the `EventRow` usage to pass a label only in all-mode:

```tsx
                  <EventRow
                    key={`${e.type}-${e.refId}-${e.date}`}
                    event={e}
                    workspaceLabel={allWorkspaces ? e.workspaceName : null}
                    onClick={() => handleEventClick(e)}
                  />
```

Update the `EventRow` signature and render the label:

```tsx
function EventRow({
  event,
  workspaceLabel,
  onClick,
}: {
  event: CalendarEvent
  workspaceLabel: string | null
  onClick: () => void
}) {
```

Inside `EventRow`'s JSX, render the label next to the title (place it where the title text is rendered):

```tsx
        {workspaceLabel && <span className={styles.wsLabel}>{workspaceLabel}</span>}
```

- [ ] **Step 4: Add the label style**

Append to `src/pages/CalendarPage.module.css`:

```css
.wsLabel {
  margin-left: 0.5rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.7rem;
  color: var(--c-text-secondary);
  background: var(--c-surface-subtle);
  white-space: nowrap;
}
```

> Confirm `--c-text-secondary` and `--c-surface-subtle` exist in `src/index.scss`; if the repo uses different token names (e.g. `--c-text-muted`), substitute the closest existing tokens. Do not introduce new tokens.

- [ ] **Step 5: Type-check, lint, build**

Run:
```bash
cd shared-docs
npx tsc -b --noEmit
npx eslint src/pages/CalendarPage.tsx
npm run build
```
Expected: all clean.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/calendar`:
- Toggle `전체 워크스페이스` on → events from more than one workspace appear, each with a workspace label; the `워크스페이스` filter section lists the present workspaces.
- Mute a workspace chip → its events disappear from the grid and the day list.
- Click a foreign-workspace event → you land on its source page (`/data/todos`, `/data/anniversaries`, or `/data/purchases?...`) and the `WorkspaceSwitcher` now shows that workspace active.
- Toggle off → the page looks exactly as before (no labels, no workspace section).

- [ ] **Step 7: Commit**

```bash
cd shared-docs
git add src/pages/CalendarPage.tsx src/pages/CalendarPage.module.css
git commit -m "feat(calendar-fe): workspace label on events + click switches active workspace"
```

---

## Final verification (after all tasks)

- [ ] Backend: `cd shared-docs-backend && ./gradlew build` — BUILD SUCCESSFUL (all calendar tests + prior tests green).
- [ ] Frontend: `cd shared-docs && npx tsc -b --noEmit` clean; `npx eslint src/features/calendar src/pages/CalendarPage.tsx` 0 errors; `npm run build` succeeds.
- [ ] Manual desktop + mobile eyeball of the four bullets in Task 6 Step 6.
- [ ] Confirm per-workspace mode (toggle off) is byte-for-byte the prior behavior — no labels, no workspace filter, `/api/calendar/events` still called with `X-Workspace-Id`.
- [ ] superpowers:finishing-a-development-branch.

## What this plan intentionally defers / excludes

- No Flyway migration / schema change — all four sources already exist.
- Decisions plan/안건 deadlines are **not** added as a fifth calendar source.
- No new editable calendar-event primitive; no cross-workspace writes.
- No per-workspace color scheme — source remains the color axis; workspace is a text label + filter only.
- No new design tokens — reuse existing CSS variables.
```
