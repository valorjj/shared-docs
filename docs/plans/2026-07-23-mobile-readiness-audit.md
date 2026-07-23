# Whole-app mobile-readiness audit + priority roadmap

> Date: 2026-07-23 · Written roadmap only, no code changes
> Context: the mobile note editor work (`2026-07-23-mobile-note-editor-{design,plan}.md`) fixed the editor's
> keyboard-anchored formatting bar + insert sheet. This audit asks the same question — "does this screen work
> one-handed on a 375px phone?" — of every other page in the app, using the routes table in `CLAUDE.md` (§Routes)
> as the page inventory.

## Method

For each page: read the top-level component + its stylesheet, and check for:
- an `useIsMobile()`/`useIsTouch()`/`useIsDesktop()` gate (`src/lib/useMediaQuery.ts`) that actually changes layout,
- a single-pane drill-in (list → detail, not side-by-side) with a real back affordance,
- `env(safe-area-inset-*)` on any chrome that sits at the screen edge,
- tap targets, horizontal overflow, and how well modals/sheets fit a small viewport.

Signals gathered up front:

```
grep -rl "safe-area-inset" src
  src/features/sheets/workspace/SheetWorkspace.module.css
  src/features/sheets/editor/SheetColumnSheet.module.css
  src/features/calc/CalcWorkspace.module.css
  src/features/notes/workspace/NoteWorkspace.module.css
  src/features/notes/editor/NoteInsertSheet.module.css
  src/features/purchases/purchases.css
  src/features/sheets/editor/SheetEditorCardList.module.css
  src/features/decisions/PlanDetail.module.css
  src/features/notes/editor/NoteAttachmentLightbox.module.css
  src/components/common/MobileShell.css
  src/components/ui/Fab.module.css
  src/components/common/BottomNav.css
  src/components/common/AppSidebarSheet.module.css
  src/pages/CalendarPage.module.css
  src/pages/DataLayout.module.css

grep -rln "useIsMobile|useIsTouch|useMediaQuery" src
  src/features/purchases/PurchaseList.tsx
  src/features/sheets/workspace/SheetWorkspace.tsx
  src/features/sheets/editor/SheetEditor.tsx
  src/features/notes/workspace/NoteWorkspace.tsx
  src/features/notes/editor/NoteEditorBubbleMenu.tsx
  src/components/common/MobileTable.tsx (via useIsDesktop)
  src/lib/useMediaQuery.ts
  src/components/common/TopNav.tsx
  src/pages/CalendarPage.tsx
  src/components/common/BottomNav.tsx
```

The global shell (`MobileShell.tsx` → `TopNav` + `Outlet` + `BottomNav`) is mobile-aware everywhere: `BottomNav`
is hidden only on `/login`, `/auth`, `/doc` prefixes and both nav bars already carry safe-area insets. That baseline
is solid; findings below are per-pillar on top of it.

---

## Notes hub + editor (`/`)

**Current state:** Reference implementation. `NoteWorkspace.tsx` computes `showList`/`showEditor` from `isMobile`
and `activeId`/`activeNote` — true single-pane drill-in with the list hidden the instant a note is open, and
`onBack`/`clearNote` wired through to `NoteEditor`. The filter sidebar becomes an `AppSidebarSheet` on mobile
instead of a permanent rail. **The editor itself was just rebuilt this branch**: `NoteEditorAccessoryBar.tsx`
is a keyboard-anchored formatting bar (`useKeyboardInset` tracks `visualViewport`, bar sits at `bottom: inset`,
only mounts while `editor.isFocused`), plus `NoteInsertSheet.tsx` for the heavier block-insert actions. Desktop
toolbar is untouched; nothing shares/regresses between the two.

**Problems:** None outstanding for the workspace shell or the editor chrome — this is the page the rest of the
audit is measured against. (Minor, not worth a spec: `NoteEditorAccessoryBar` buttons are the pill's own compact
size, not separately audited here since they were reviewed as part of this branch's own tasks.)

**Severity:** Done — reference pattern.

---

## Sheets (`/sheets`)

**Current state:** Good. `SheetWorkspace.tsx` mirrors the Notes drill-in exactly (`showList`/`showEditor` off
`isMobile`/`activeId`). `SheetEditor.tsx` swaps `SheetEditorGrid` (react-data-grid, desktop) for
`SheetEditorCardList` (mobile) via the same `isMobile` flag — the wide spreadsheet grid never renders on a phone.
`SheetEditorMobileBar` supplies the back button; `SheetColumnSheet` (bottom sheet) carries
`env(safe-area-inset-bottom)`.

**Problems:**
- `SheetEditorToolbar.module.css:52` — the `.mobileOnly` toolbar button is `height: 36px`, `SheetTabStrip` tabs are
  `padding: 4px 12px` at `--fs-sm` (effective height well under 40px) — both below the 44px touch-target
  guideline. Same shape as the cross-cutting `IconButton`/`Tabs` finding below, just worth flagging because the
  tab strip is a primary navigation control here (switching workbook tabs).
- `SheetTabStrip` scrolls horizontally (`overflow-x: auto`) with no scroll-shadow/affordance hint that more tabs
  exist off-screen — low-severity discoverability gap, not a blocker.

**Severity:** Low. The hard part (grid → card reflow, drill-in, safe-area) is already done; remaining issues are
tap-target polish.

---

## Decisions (`/decisions`, `/decisions/:planId`)

**Current state:** `PlanDetail.tsx` uses `<BackLink to="/decisions" mobileOnly>`, a sticky condensed-title control
strip (`IntersectionObserver`-driven), and `PlanDetail.module.css` handles `env(safe-area-inset-*)`. The
discussion pane (`DiscussionPane`) is a `.split`/`.pane` two-column layout on desktop that **does** collapse:
`PlanDetail.module.css:151` — `@media (max-width: 900px) { .split { display: block; } }`, so the aside stacks
under `.main` instead of a persistent side-by-side rather than overlaying, which is workable but means opening
"논의" on a phone pushes the whole spine down rather than presenting as a sheet/drawer.

**Problems:**
- `DecisionList.tsx` renders `IconButton size="sm"` (card actions: 완료/수정/삭제) at **28×28px**
  (`IconButton.module.css:29`) — under the 44px minimum, and these are the only way to complete/edit/trash a
  plan from the board. Same for `PlanDetail`'s lifecycle `IconButton`s.
- `DecisionList`'s `Tabs` strip has 5 items (보드/스토리/완료/휴지통/활동); `Tabs.module.css` wraps
  (`flex-wrap: wrap`) rather than scrolling, so on very narrow phones it can break to two rows and push content
  down unpredictably rather than committing to either a scroll-strip or an overflow menu.
- ~~Discussion pane on mobile is a full-width block appended below the spine (not a sheet/overlay)~~ — **correction (2026-07-23):** this was a misread; `PlanDetail.module.css` already makes `.pane` a fixed bottom sheet (`position:fixed; inset:auto 0 0 0; height:70vh; rounded top; shadow; safe-area padding`) at ≤900px. **Shipped the missing drawer polish:** backdrop scrim + tap-to-dismiss + body-scroll-lock (gated to ≤900px). Remaining below was:
  buries it under whatever content is already on screen; a decisively-mobile UX would slide it in as a sheet.

**Severity:** Medium. Structurally mobile-aware (BackLink, safe-area, tabs collapse to `결정/기록`), but the
primary per-plan actions use sub-44px targets and the discussion pane doesn't get its own mobile presentation.

---

## Calendar (`/calendar`)

**Current state:** `CalendarPage.tsx` uses `isMobile` to gate the mobile filter sheet (`AppSidebarSheet`), has a
`.mobileFilter` pill that only shows `<900px`, and `CalendarPage.module.css` handles
`env(safe-area-inset-bottom)` for the scroll container. The day-grid (`CalendarPage.css`) sets
`--rdp-day-height/width: 44px` — calendar cells already hit the touch-target minimum.

**Problems:**
- `.header` (`CalendarPage.module.css:16`) is `display:flex` with **no `flex-wrap`**: on the mobile breakpoint it
  holds the filter pill + title + "전체 워크스페이스" button + "오늘" button in one row. On a 320–360px viewport
  this is tight — four elements with Korean labels ("전체 워크스페이스" is long) in one unwrapped flex row risks
  either visual crowding or clipping depending on font-scaling settings.
  test at 320px width to confirm/fix.
- The "이 날에 추가" quick-add row (`구매`/`할 일`/`기념일` buttons, `Row gap={2} wrap`) does wrap, so that part is
  fine — the top header is the one row that doesn't.

**Severity:** Low. Core interactions (date selection, event list, quick-add) are solid; the header row is
the one layout that wasn't stress-tested against the narrowest supported width.

---

## Calc (`/calc`)

**Current state:** No `isMobile` hook at all — the layout is pure CSS. `CalcWorkspace.module.css` stacks
`.workArea` above `.tape` at `max-width: 900px` (`flex-direction: column`) instead of side-by-side, and the root
height accounts for `env(safe-area-inset-bottom)`.

**Problems:**
- The tape (calculation history, `TapeView`) is **always rendered below** the active mode's form on mobile —
  there's no tab/toggle between "calculate" and "history" the way Notes/Sheets toggle list vs. editor. For a
  multi-field mode (`LoanMode`/`InstallmentMode`) this means the tape is pushed far down the page; recalling a
  past entry (`handleSelectEntry`) requires scrolling past the entire active form first.
- `ModeTabs` (BASIC/할부/대출/더치페이/날짜) is a 5-item tab strip with no width audit performed here — worth a
  quick check alongside the Decisions tab-wrap finding, since it's the same `Tabs` primitive.

**Severity:** Medium. Nothing breaks, but the page reads as "shrunk desktop layout" rather than a page designed
mobile-first — the one pillar CLAUDE.md doesn't yet list as "reference pattern" alongside Notes/Sheets/Recipes.

---

## Data sub-pages (`/data/*`)

### Purchases (`/data/purchases`)

**Current state:** Best-in-class among the Data pages. `PurchaseList.tsx` uses `MobileTable` (`components/common/
MobileTable.tsx`), a genuinely reusable primitive: `useIsDesktop()` picks between a real `<table>` (desktop) and
a card list with `primary`/`secondary`/`meta` field roles (mobile) — **the wide grid never renders on a phone**.
`purchases.css` already carries `safe-area-inset`.

**Problems:** None found at this layer — this is a second reference pattern worth reusing elsewhere (see Todos/
Anniversaries/Links below, none of which use it, though none of them currently need a *table* either).

**Severity:** Done — reference pattern (for any future page with tabular data).

### Todos (`/data/todos`)

**Current state:** `TodoList.tsx` uses `BackLink to="/data" mobileOnly`, `Fab`, a `Tabs` filter strip
(오늘/이번 주/전체/완료됨), and a card-per-row list — no table, so no reflow problem to begin with.

**Problems:**
- `.todos__check` (`todos.css:59`) — the complete/incomplete toggle circle is **24×24px**. This is the single
  most-tapped control on the page (checking off a todo) and it's roughly half the recommended minimum tap target;
  no invisible hit-area expansion (unlike the pattern `RecipeEditor.module.css` uses for its own small controls,
  see below).
- The row's `IconButton size="sm"` delete button is 28×28px (same cross-cutting `IconButton` issue as Decisions).

**Severity:** High. Small tap targets on the primary, highest-frequency action (toggling a checkbox) are
more painful than the same issue on a secondary action elsewhere.

### Anniversaries / Links (`/data/anniversaries`, `/data/links`)

**Current state:** Same shape as Todos — `BackLink mobileOnly`, `Fab`, card-per-row lists, no raw tables.

**Problems:** `links.css` has an icon button at `height: 28px` (same family of sub-44px controls). Grid layouts
in `links.css`/`recipes.css` use `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` /
`minmax(260px, 1fr)` — on a 320px-wide viewport (minus page padding) this is close enough to the 280px minimum
that very narrow phones (iPhone SE-class, 320 logical px) may render a cramped single column; not a hard overflow
today at the more common ~375–390px widths, but worth a real-device check as a follow-up, not a fix on its own.

**Severity:** Low.

### Recipes (`/data/recipes`, `/data/recipes/:id`)

**Current state:** `RecipeList.tsx` (`BackLink mobileOnly`, `Fab`, card grid) and `RecipeEditor.tsx` are
noteworthy: `RecipeEditor.module.css:534` has an explicit, commented "Mobile touch-target overlays" block —
`@media (hover: none) and (pointer: coarse)` gives the compact 22×22px drag-handle/stepper/delete/kebab controls
an invisible `::after { inset: -12px }` hit area (≥44×44 total) purely on touch devices, and forces
hover-gated controls (row delete) visible since hover doesn't exist on touch. Ingredient/step reordering uses
`@dnd-kit` with a dedicated `GripVertical` drag handle (not whole-row-draggable), `touch-action: none` on the
handle, and `PointerSensor` with a small `distance: 4` activation constraint — because the handle is a separate
element from the scrollable row, drag doesn't fight page-scroll the way whole-row dragging would.

**Problems:** None found — this is a third reference pattern (small controls made touch-legible without changing
their visual size).

**Severity:** Done — reference pattern.

---

## Shared items (`/shared`, `/shared/:noteId`)

**Current state:** `SharedItemList.tsx` groups shared notes by owner in a simple list; selecting one
(`useParams().noteId`) renders `SharedNoteView.tsx`, which mounts `NoteEditorBody` directly.

**Problems:**
- **`SharedNoteView.tsx` has no back button/link at all** — no `BackLink`, no `onBack` prop, nothing that returns
  to `/shared`. Every other drill-in page in the app (Notes, Sheets, all `/data/*` sub-pages, Decisions,
  Settings) gives the user an explicit way back; this is the one place that silently relies on the browser/OS
  back gesture. On mobile that gesture exists (Android back button, iOS edge-swipe) but it's inconsistent with
  the rest of the app's UI language and easy to miss for a user who navigated in via a deep link (e.g. a shared
  URL) with no other history entry to swipe back to.
- `SharedItemList.module.css` has no `useIsMobile` gating and no distinct mobile treatment — it happens to work
  because it's already a simple vertical list, but there's no drill-in animation/back-affordance parity with
  Notes' `showList`/`showEditor` pattern.

**Severity:** High. This is the one page in the audit with an actual navigation trap risk on mobile, not just a
sizing/overflow nit.

---

## Settings (`/settings/members`, `/settings/categories`), Search palette, Admin

**Current state:**
- `SettingsMembers.tsx` / `SettingsCategories.tsx` both use `<BackLink to="/" mobileOnly>홈</BackLink>` — correct,
  consistent pattern.
- `SearchPalette.tsx` (Cmd+K palette) is a Radix `Dialog` sized `width: min(640px, calc(100vw - 24px))`, with an
  explicit `@media (max-width: 767px)` override (`SearchPalette.module.css:218`) narrowing further — the dialog
  itself fits a phone screen. The footer hint row (`↑↓ 이동 · Enter 열기 · Esc 닫기`) is keyboard-only language
  that's meaningless on a touchscreen (no keyboard, no Esc key) — purely cosmetic clutter, not a blocker, since
  tapping a result row works regardless.
- `Admin.tsx` (`admin__table-wrap { overflow-x: auto }`) wraps its member table in a horizontal-scroll container
  rather than reflowing to cards — the least mobile-native of the table treatments in the app, but Admin is
  ADMIN-role-gated and low-traffic, so the graceful-degrade (scroll, not overflow-clip) is an acceptable stopgap.

**Problems:** Only the Admin table (scroll-not-reflow) and the Search palette's keyboard-oriented footer copy.
Neither blocks usage.

**Severity:** Low (Settings: none — Search: cosmetic — Admin: acceptable stopgap, low traffic).

---

## Cross-cutting: sub-44px tap targets

Not page-specific — a shared-component issue surfacing on nearly every page audited above:

- `IconButton.module.css:29` — `size="sm"` is **28×28px**. Used for card actions across Decisions
  (`DecisionList`, `PlanDetail`), Todos (delete), and elsewhere. No touch-only hit-area expansion the way
  `RecipeEditor.module.css` does for its own compact controls.
- `Tabs.module.css` — tab padding (`0.4rem 0.85rem` at `--fs-sm`) yields an effective height under 40px, used by
  Decisions (5 tabs), Calc (`ModeTabs`, 5 modes), Todos (4 filters).
- `.todos__check` — 24×24px, the single worst offender (primary daily-use control).

Recipes already solved this exact problem with a reusable CSS pattern
(`@media (hover: none) and (pointer: coarse)` + `::after { inset: -12px }`). The fix is mechanical: lift that
block into a shared place (or apply the same pattern directly to `IconButton`/`Tabs`/`.todos__check`) rather than
re-deriving it per page.

---

## Priority-ranked fix roadmap

Ordered by severity first, then by reach (how many pages/how-frequently-tapped the fix touches).

| # | Page / area | Fix summary | Severity | Size |
|---|---|---|---|---|
| 1 | Shared items (`/shared/:noteId`) | Add a `BackLink`/`onBack` to `/shared`, matching every other drill-in page's pattern | High | S |
| 2 | Cross-cutting (`IconButton`, `Tabs`, `.todos__check`) | Add the Recipes-proven touch hit-area overlay (`@media (hover: none) and (pointer: coarse)` + `::after { inset: -12px }`) to `IconButton` `size="sm"`, `Tabs`, and `.todos__check` | High | S |
| 3 | Todos (`/data/todos`) | Bump `.todos__check` to a real ≥44px target (or ship fix #2 first, which covers it) | High | S |
| 4 | ~~Decisions discussion pane~~ | **✅ Shipped 2026-07-23.** Pane was already a ≤900px bottom sheet; added backdrop scrim + tap-to-dismiss + body-scroll-lock. (Original "make it a sheet" was a misread.) | Medium | ~~M~~ S |
| 5 | ~~Calc (`/calc`)~~ | **✅ Shipped 2026-07-23.** ≤900px 계산/기록 `Tabs` toggle; both panes stay mounted (CSS hide) so inputs+scroll survive; recalling a history entry jumps back to the form | Medium | M |
| 6 | ~~Calendar~~ | **✅ Shipped 2026-07-23.** `flex-wrap:wrap` on `.header` | Low | S |
| 7 | ~~Sheets~~ | **✅ Shipped 2026-07-23.** `.mobileOnly` 36→44px; `SheetTabStrip .tab` min-height 44 on touch (overflow:hidden precludes the ::after trick) | Low | S |
| 8 | Links / Recipes list grids | **Deferred — needs a real 320px device.** Re-check `minmax(260–280px,1fr)` floor; not a blind fix (audit's own note). | Low | S |
| 9 | ~~Admin (`/admin`)~~ | **✅ Shipped 2026-07-23.** Member table converted to the `MobileTable` primitive (desktop table + mobile cards, one column def); bespoke table CSS removed. Minor: per-row 'me' highlight dropped (the 나 tag still marks it). | Low | M |
| 10 | ~~Search palette~~ | **✅ Shipped 2026-07-23.** Keyboard hints (`.hint`) hidden on touch via `@media (hover:none) and (pointer:coarse)`; result count kept | Low | S |

**Already done — reference patterns, no further spec needed:** Notes hub + editor (drill-in + keyboard accessory
bar, this branch), Sheets grid→card reflow, Purchases (`MobileTable`), Recipes touch hit-areas + drag-handle
pattern, Settings pages, global shell (`MobileShell`/`TopNav`/`BottomNav`).
