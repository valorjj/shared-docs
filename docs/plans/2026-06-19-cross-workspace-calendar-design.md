# Cross-Workspace Calendar (전체 워크스페이스) — Design

> Brainstormed 2026-06-19. The "post-v2 multi-calendar" next-direction item. Adds an **all-workspaces mode** to the existing calendar: one merged month grid pulling events from every workspace the user is an active member of, regardless of which workspace is currently active. Read + navigate only — no new event primitive, no cross-workspace writes.

## What "multi-calendar" means here (locked)

A **cross-workspace unified view**, not a new calendar primitive. The current calendar at `/api/calendar/events` is a read-only *overlay* that merges four existing sources — 기념일 (anniversary) / 할 일 (todo) / 구매 (purchase) / 정산 (settlement) — for the **active** workspace (bound via the `X-Workspace-Id` header). This feature adds a mode that merges those same four sources across **all** of the caller's workspaces into one grid.

## Decisions locked (brainstorm 2026-06-19)

1. **Toggle on the existing calendar**, not a separate page. `/calendar` gains a "전체 워크스페이스 / All workspaces" switch. Off = today's per-workspace overlay (default, preserves the v2 workspace-scoped invariant); on = merged across all memberships.
2. **Two independent filter axes in all-mode.** Source-type keeps its existing meaning (color + icon, unchanged). A second axis — per-workspace toggle chips — is added, shown only in all-mode. An event displays iff its source AND its workspace are both enabled.
3. **Workspace shown as a name label**, not a color. Each event in all-mode carries a small workspace-name label; source stays the color axis (consistent across both modes).
4. **Click → switch active workspace → navigate.** Clicking a foreign-workspace event sets it active (`setActiveId`), then navigates to the existing source page. You land where the event lives; the active workspace follows.
5. **Backend = Approach A: extract a `CalendarService`, two thin endpoints.** One event-building code path; the new `/all` endpoint steps outside the `@CurrentWorkspace` header choke point and re-enforces membership itself.
6. **Read + navigate only.** No cross-workspace writes; no new editable calendar-event primitive; Decisions plan/안건 deadlines stay out (not a source today).

## Why this shape

- **Why a toggle, not a new page:** one mental model, minimal new chrome, and the v2 default ("everything is workspace-scoped") stays the default — all-mode is an opt-in lens.
- **Why source stays the color axis:** color meaning is identical in both modes, so toggling doesn't re-train the eye. Workspace is the *secondary* dimension, so it gets the lighter treatment (a label + filter chips).
- **Why `/all` lives outside the header choke point:** the v2 invariant — "you only ever touch data in a workspace you're a member of" — is enforced by `WorkspaceContextFilter` + `@CurrentWorkspace` reading `X-Workspace-Id`. All-mode must *not* depend on whichever workspace happens to be active, so it cannot ride the header. Instead `/all` resolves the caller's active memberships from the principal and only ever queries those IDs — the same guarantee, re-stated where it's relaxed.

---

## Backend (`shared-docs-backend`)

### `CalendarService` (new)

Extract the four per-source event builders out of `CalendarController` into:

```kotlin
fun events(workspaceIds: List<Long>, from: LocalDate, to: LocalDate): List<CalendarEvent>
```

- Loops `workspaceIds`, running the existing per-source repo queries per workspace, then returns the merged list sorted by `(date, type, refId)` (unchanged ordering).
- The recurring-anniversary expansion and the `safeDate` leap-day fallback move with it, unchanged.
- Resolve workspace names once: `workspaceRepository.findAllById(workspaceIds)` → `Map<Long, String>`, used to stamp each event (avoids N extra lookups).

### `CalendarEvent` DTO

Add two always-populated fields:

```kotlin
val workspaceId: Long,
val workspaceName: String,
```

In per-workspace mode every event shares the same pair; in all-mode they vary. One DTO for both modes (no separate all-mode DTO).

### `CalendarController` — two endpoints, one code path

```
GET /api/calendar/events       (unchanged signature)
    @CurrentWorkspace ws  → service.events(listOf(ws.id!!), from, to)

GET /api/calendar/events/all   (new)
    @AuthenticationPrincipal me → resolve active-member workspace ids
                              → service.events(ids, from, to)
```

- `/all` takes **no** `X-Workspace-Id` and **no** `@CurrentWorkspace`. It resolves the caller's active memberships and queries only those IDs.
- Empty membership → empty list (never an error).
- `from.isAfter(to)` → 400, same guard as today, in the service or both controller methods.

### Membership resolution

Add to `WorkspaceMemberRepository`:

```kotlin
fun findAllByUserIdAndLeftAtIsNull(userId: Long): List<WorkspaceMember>
```

`/all` maps these to `workspaceId`s. (Mirrors the existing `findActive` / `*LeftAtIsNull` naming.) An explicit doc-comment on the `/all` method states the relaxed-but-re-enforced invariant.

---

## Frontend (`shared-docs`)

### `CalendarPage`

- New `allWorkspaces: boolean` state (default `false`).
- A "전체 워크스페이스" switch in the page header and in the mobile filter sheet (`AppSidebarSheet`).
- When on, the page renders workspace-name labels on events and shows the per-workspace filter chips; when off, the page is visually identical to today.

### Data layer (`features/calendar/api.ts`)

- `useCalendarEvents(from, to, all)` — `all` selects `/api/calendar/events/all` (no workspace header) vs `/events`. Query key includes `all` so the two modes cache separately.
- `CalendarEvent` type gains `workspaceId: number` + `workspaceName: string`.

### Filters — second axis

- Keep the existing `Set<CalendarEventType>` (enabled sources).
- Add a parallel `Set<number>` (enabled workspace IDs), **rendered only in all-mode**.
- Workspace chips derive from the distinct workspaces present in the current month's events, reusing the existing filter-chip component.
- Display predicate: `enabledSources.has(e.type) && (!allWorkspaces || enabledWorkspaces.has(e.workspaceId))`.

### Click → switch → navigate

- In all-mode, `handleEventClick(e)` calls `setActiveId(e.workspaceId)` **first**, then `navigate(...)` to the existing source route, so the destination mounts against the newly-active workspace (data-page queries are keyed by active workspace and refetch on landing).
- In per-workspace mode, click behavior is unchanged.

---

## Scope

### In scope
The four existing sources, merged read view, two filter axes, click-through with workspace switch.

### Explicitly out of scope (YAGNI)
- **Decisions plan/안건 deadlines** are not added as a calendar source — not in today's overlay either; a fifth source is a separate decision.
- No new editable calendar-event primitive (a different interpretation of "multi-calendar"; not this).
- No cross-workspace **writes** — unified view is read + navigate only.
- No per-workspace color scheme (source stays the color axis).

---

## Testing

### Backend
- `CalendarService` / controller test: `/all` returns events from **all** of a user's active-member workspaces and **excludes** workspaces they've left or never joined — the membership re-check is the security-critical part, mirroring the existing workspace-isolation test pattern.
- Per-workspace `/events` stays green (no regression from the extraction).
- `from > to` → 400 on both endpoints.

### Frontend
- `npx tsc -b --noEmit` clean; `npx eslint src/features/calendar src/pages` 0 errors; `npm run build` succeeds.
- Manual: toggle on → events from multiple workspaces appear with name labels; mute a workspace chip → its events drop; click a foreign-workspace event → land on that workspace's source page with the switcher now showing it active.
