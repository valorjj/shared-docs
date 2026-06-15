# Plan Page (PlanDetail) Redesign — Design

> Brainstormed 2026-06-15 (visual companion). Goal: make `/decisions/:planId` read as a natural top-down document. Fixes 5 user-confirmed friction points without changing any data model or backend — pure FE layout/hierarchy work in the `decisions` feature.

## The 5 friction points (all confirmed)

1. **One bar, two jobs** — view switches (목록/캔버스/기록) and lifecycle actions (기한·잠금·완료·논의) share one crowded row.
2. **Hierarchy not legible** — 계획→안건→선택지 nesting doesn't read; the plan **description** ("신혼여행") floats between the bar and the first card with no clear owner. (Group label is not shown on detail at all today.)
3. **Real action buried** — `결정하기/결과 확정하기` is a small `soft` `sm` button inside the card; lesser 잠금/완료 sit prominent up top. Emphasis inverted.
4. **Sparse & unbalanced** — one narrow card floating in a tall empty column; worse in split view.
5. **Discussion pane** — always ~38% split when open; 댓글 drifts far below the note.

## Core idea — three control types get three homes

| Control type | Today | New home |
|---|---|---|
| Plan **attributes** (group label, 기한, description) | scattered: 기한 in action row, description floats above list, group label absent | **Header zone** under the title |
| **Lifecycle** (잠금, 완료) | prominent ghost buttons top-right of the bar | **quiet Lucide icon-buttons**, top-right of the header (scroll away) |
| **Views** (목록/캔버스/기록) + **논의** toggle | mixed with lifecycle | **own control strip**, which becomes **sticky on scroll** |

This single reorganization resolves #1 (separation), #2 (description + group label find owners), and half of #3 (lifecycle demoted).

## Layout spec

### Header zone (scrolls away)
- **Eyebrow**: the plan's **group label** as a small muted line above the title (`{groupLabel} ›`), shown only when present. NEW — gives board-context/ownership. (Board groups by groupLabel; surfacing it here ties detail back to the board.)
- **Title**: existing serif `PageTitle` ("travel to paris").
- **Subtitle**: the plan **description** moves here, directly under the title (calm muted text) — out of its current floating spot before the 안건 list. Fixes #2.
- **Meta row**: the `기한` `DeadlineChip` (plan-level) sits here as a plan attribute (already styled from the prior pass). Fixes #1/#2.
- **Lifecycle**: 잠금/완료 become quiet `IconButton`s (Lucide `Lock`/`LockOpen`, `CheckCircle2`/`RotateCcw`) aligned top-right of the header. Demoted from labeled ghost buttons. Fixes #1/#3.

### Control strip (sticky)
- A single strip below the header: **view `Tabs`** (목록/캔버스/기록) on the left, **논의 toggle** on the right.
- `position: sticky; top: <global TopNav height>` with the app's translucent-blur treatment (mirror `.top-nav`). `z-index` below the global nav.
- **Condensed title appears in the strip only once the header has scrolled out** — an `IntersectionObserver` watches a 1px sentinel at the top of the header; when it leaves the viewport, a boolean (`scrolled`) flips and the strip shows `{title} · D-{n}`. The observer is created in a `useEffect` and calls `setScrolled` from its *callback* (not the effect body) — compliant with the "no setState in effect" rule. Cleans up on unmount.
- Lifecycle is NOT duplicated into the sticky strip (infrequent; stays in the header). Keeps the strip clean.

### Content column
- The `목록` content lives in a **centered, width-capped column** (≈ `--maxw-readable`, ~640–720px; pick the nearest existing token or add one) so a sparse plan doesn't float in a void. Fixes #4.
- **안건 = numbered question block.** `SubPlanSection` gains a small muted eyebrow `안건 {index}` (1-based display order; `PlanDetail.renderSubPlan` already has the index `i`). Reinforces the 계획→안건 layer. Fixes #2.
- **선택지** rows stay nested in the card (unchanged structure).
- **Decision action emphasis:** `결정하기/결과 확정하기` stays `variant="soft"` (accent-tinted) but bumped from `size="sm"` to default size and made the visually dominant control in the 안건 footer. **Deliberately not a filled `primary`** — a plan can have many undecided 안건, and N filled primaries would be loud and break the one-primary-per-screen rule. The fix for #3 is *relative*: with lifecycle demoted to quiet icons, a soft-accent decision button now clearly out-ranks everything else. (This is a refinement of the filled look in the mockup — same hierarchy, calmer.)
- `안건 추가`: stays the full-width outline button on desktop; on mobile becomes a **FAB** (`Fab`, matching 계획 추가 on the board) and the inline button is hidden ≤768px.

### Discussion pane (#5)
- Split grid column narrows from `minmax(320px, 38%)` to a **slim fixed rail** (`minmax(300px, 360px)`), so it stops dominating. The pane is already `position: sticky`.
- **Comments flow directly under the note** — remove the flex-grow/spacer in `DiscussionPane` that pushes 댓글 to the bottom; note body then 댓글 stack naturally with normal spacing.
- Mobile (≤900px) keeps the **existing bottom-sheet** behavior — no change needed there.

### Mobile (≤768px)
- Global TopNav already hidden → the plan page keeps its own **sticky mini-header**: `BackLink` (‹ 결정) + condensed title + `D-{n}` chip, then the view `Tabs` as a scrollable strip. Same sticky mechanism as desktop.
- `결정하기` full-width (soft accent, consistent with desktop — not a filled primary) in the card; `안건 추가` as FAB; 논의 as the existing bottom-sheet.
- Lifecycle (잠금/완료) as small icon-buttons in the mini-header (no kebab menu — honors the toolbar rule).

## Files touched (decisions feature only)
- `PlanDetail.tsx` — header zone (eyebrow/title/subtitle/meta/lifecycle), sticky control strip + sentinel + IntersectionObserver, move description into header, mobile FAB, pass `index` to `SubPlanSection`.
- `PlanDetail.module.css` — header/eyebrow/subtitle/meta classes; sticky strip + condensed title; centered capped content column; slim pane grid column; mobile rules.
- `SubPlanSection.tsx` — `안건 {index}` eyebrow (+ new `index` prop), decision button size bump.
- `SubPlanSection.module.css` — question-block eyebrow; mobile full-width decision button.
- `DiscussionPane.tsx` / `.module.css` — comments flow under note (drop the bottom-pinning).
- `SortableSubPlanSection.tsx` — none (spreads props; `index` flows through automatically).

## Icons
All Lucide line icons, no emoji (the mockup emoji were stand-ins): `Lock`/`LockOpen`, `CheckCircle2`/`RotateCcw` (lifecycle), `CalendarClock` (기한, existing), `MessagesSquare` (논의, existing), `Plus` (FAB/add, existing), `ChevronLeft` via existing `BackLink`.

## Non-goals (YAGNI)
- No backend/data-model change; no new endpoints.
- No change to 캔버스 or 기록 tab internals (only how the strip hosting them behaves).
- No change to the 안건/선택지/vote/rating/decision mechanics — only their visual framing.
- No global design-token overhaul; reuse existing tokens (add at most one content-width token if none fits).
- Group label remains read-only on detail (no inline edit here; that stays in the plan edit modal).

## Verification
- `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` succeeds.
- Manual: long plan → control strip pins, condensed title+D-day appear after header scrolls out; sparse plan → centered column, not floating; 논의 open → slim rail, comments under note; mobile width → mini-header sticky, FAB, bottom-sheet; lifecycle reachable but quiet; decision button clearly the dominant action.
