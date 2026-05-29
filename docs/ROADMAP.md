# Roadmap

> Last revised: 2026-05-29 — Phase 2 shipped, with two same-day follow-ups (multi-line scratchpad + clickable history).

The product has four pillars (see [`VISION.md`](VISION.md)). This document is the build order, with explicit deferrals.

## Today (2026-05-29) — current state

What exists and is stable:

- **Memo** (Tiptap-based, 3-pane shell, autosave, attachments, tags, slash menu, bubble menu, context menus on editor + sidebar, link cards, data snapshots, cross-entity `@` mentions, ⌘K search palette, soft-delete trash)
- **Sheets** (JSON-blob spreadsheet, desktop grid + mobile cards)
- **Data sub-features**: 구매 내역, 정산, 반복 항목, 할 일, 기념일, 유용한 링크, 레시피
- **Calendar** (4-source aggregation: anniversaries + todos + purchases + settlements)
- **Settings**: 4 themes (Dracula default), 3 fonts, 3 line-heights
- **Auth**: Google OAuth2 + JWT, 2-email allowlist

Status of each, after the reset:

| Feature | Status |
|---|---|
| Memo | **Stable.** Phase 1 personal/shared split shipped 2026-05-28. |
| Sheets | **Frozen.** Works today; no new features. Will likely be removed in 2026-H2 if unused. |
| 구매 / 정산 / 반복 항목 | **Deferred.** Phase X+, not before Phase 4. |
| 할 일 / 기념일 | **Stable.** Bug-fixes only. |
| 유용한 링크 / 레시피 | **Stable.** Bug-fixes only. |
| Calendar | **Stable.** Will grow to source from Decisions in Phase 3. |
| Settings | **Stable.** |
| Auth | **Stable.** No public-launch work. |
| Calculator | **Stable.** Phase 2 shipped 2026-05-29 — see plan + commits e3b619d … 2d6ec85. Includes 2.1 multi-line scratchpad and 2.2 click-history-to-load. |

## Phase 0 — Doc reset (this session, 2026-05-28)

Delete obsolete blueprints, write the new doc set (this file + VISION/ARCHITECTURE/DESIGN/CLAUDE/README). One commit per doc batch.

**Goal:** the docs accurately reflect what the product is becoming, not what it was in 2026-05-12.

## Phase 1 — Personal / Shared notes split (1 weekend)

Add `visibility: PRIVATE | SHARED` to notes. Default PRIVATE on create. Sidebar splits into 내 비공개 / 함께 / 상대의 메모. Editor meta strip gets a one-click toggle.

**Why first:** unblocks both partners to use this as a real notebook (mine + ours), and the data-model touches will inform later pillars.

**Plan:** [`plans/2026-05-28-personal-shared-notes.md`](plans/2026-05-28-personal-shared-notes.md)

## Phase 2 — Calculator with tape history ✅ shipped 2026-05-29

`/calc` feature (peer to `/`, `/sheets`, `/calendar` — moved from the original `/data/calc` because it's a daily utility, not data tracking). Tape is shared between both partners; entries are immutable (rerun creates a new one), with `pinned` and `label` mutable.

Modes that shipped (daily-five):
- **기본** (basic) — Soulver-style multi-line scratchpad (added 2.1, see below)
- **할부** (installment) — equal-monthly-payment formula
- **대출 상환** — 원리금균등 + 원금균등 with full amortization schedule
- **더치페이** — weighted shares + tip across multiple currencies
- **날짜 계산** — D-day / 사이 일수 / 영업일 (no holiday table)

Deferred per the picker:
- **적금 / 예금 만기**
- **단위 환산** (특히 평↔㎡)

CalcSnapshot embed: same Tiptap atom pattern as DataSnapshot — slash menu `/계산 스냅샷` opens the picker, picking a tape entry inserts a frozen block with refresh kebab; 404 on refresh switches the card to a tombstone state.

### Same-day follow-ups

- **2.1 multi-line scratchpad** (commit `385d478`) — the original single-line BASIC was rebuilt as a two-column Soulver-style scratchpad: comments with `#`, assignments (`name = expr`) flowing variables to later lines, line-scoped errors, live evaluation, click-a-result to insert-at-cursor, `localStorage` recovery, and explicit 저장 to snapshot the whole pad as one entry. Old single-line entries still render via back-compat in `summarizeBasic`.
- **2.2 click history → load** (commit `2d6ec85`) — every tape row is now interactive. Clicking a row switches to that mode's editor and seeds the form fields from the entry. The active row gets a primary-soft background; clicking it again deselects. Wrapper+keyed-inner pattern: `CalcWorkspace` owns `seedEntry` and keys each mode component on `seedEntry?.id ?? 'fresh'` so the mode's `useState` initializers re-run cleanly. While a seed is loaded BASIC's `localStorage` write pauses, so the user's fresh scratchpad survives untouched in the background.

**Plan:** [`plans/2026-05-29-calculator-tape-history.md`](plans/2026-05-29-calculator-tape-history.md) (with post-ship appendix)

## Phase 3 — Decisions (4–8 weeks) — the wedge — **next**

The differentiated feature. Data model:

```
Plan
  └─ SubPlan
       ├─ Option
       │    ├─ Rating per partner (★1–5 + comment)
       │    └─ Pros / Cons (free text)
       └─ Decision (chosen Option + reasoning + timestamp)
```

Surfaces:

- `/data/decisions` — Plan list with status (open / decided / archived)
- Plan detail — vertical timeline of SubPlans with their Decisions
- SubPlan detail — Options grid with both partners' ratings side-by-side, comment threads per option
- Decision card — pin to plan timeline, embeddable as frozen block in notes (`@` mention or slash menu)
- Calendar source — decisions appear as dots on the date they were made

This is where the product earns its name.

**Plan:** to be written when work on Phase 3 actually starts (Phase 2 is complete; the plan is held until the user signals "let's start Phase 3" so the design reflects what we learned from Phases 1–2).

## Phase 4 — Presence on shared notes (1 weekend)

Tiptap "awareness" — partner's avatar + cursor color when both viewing the same note. No real-time editing (last-write-wins remains). Uses Y.js awareness over WebSocket, but no Y.js document sync.

**Why last:** cheap polish that lands well after the wedge is in place.

**Plan:** to be written when Phase 3 completes.

---

## Deferred indefinitely

Items removed from the roadmap, with the reason logged so we don't re-litigate.

| Item | Why deferred |
|---|---|
| iMessage / SMS scraping for expense ingestion | Impossible from web; native SMS access restricted on Android; iMessage has no API |
| Email-receipt regex ingestion | Discarded — not worth the maintenance burden for a 2-person app |
| Open Banking 마이데이터 integration | Requires FSC license + multi-억원 capital — not happening for a personal project |
| Real-time collaborative editing (Y.js CRDT sync) | Couples don't race paragraphs; awareness is enough until proven otherwise |
| Expense feature deep work (구매 / 정산 enhancements beyond bug-fixes) | Not in service of the four pillars; revisit only if Decisions stabilizes and there's leftover capacity |
| Sheets enhancements (formulas, sorting, filtering) | Use a real spreadsheet for spreadsheet work |
| Mobile native apps (iOS / Android binaries) | Responsive web + PWA install is sufficient |
| Public launch / multi-tenancy / billing | The product is private by design |
| User onboarding / signup / forgot-password / marketing surface | Same |
| Comments on notes/sheets | Latent infrastructure exists; no use case until Decisions ships threaded comments |

## Roadmap principles

A few rules to keep this honest:

1. **One pillar at a time.** Phase 3 doesn't start until Phase 2 ships, regardless of how exciting it sounds.
2. **Plans are written when the previous phase ships, not earlier.** The plan for Phase 2 is written after Phase 1 lands — because Phase 1 will teach us things we'd guess wrong about now.
3. **The "deferred" list is sticky.** Adding back requires explicit reasoning, not "while we're here."
4. **Sheets is on death watch.** If neither partner opens it for 60 days running, it gets deleted. Mark the calendar.
5. **No feature flags.** This is a 2-person app. Ship to main or don't ship.
