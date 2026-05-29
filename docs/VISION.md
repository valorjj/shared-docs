# Vision

> Last revised: 2026-05-28 — after the "what is this, actually?" conversation.

## 1. What this is

A private knowledge and decision app for two people who live together.

It exists because off-the-shelf tools fail couples in specific, recurring ways:

- **Notion** is built for individuals or teams; "two-person shared workspace" is an afterthought, expensive, and the affordances point the wrong way.
- **Kakao / iMessage** preserves conversations but not decisions. Six months later, "왜 우리가 마포로 정했더라?" has no answer.
- **Bear** is a beautiful solo notebook. There is no "us" mode.
- **Splitwise / Bank Salad** track money but not the conversation around the money.

The product fills the gap: **a place where two people write together, decide together, and can read the audit trail of how they got there.**

## 2. Origin

Started in 2026-02 as a Bear-style memo app, grew sideways into a spreadsheet, a calendar, a purchase tracker, a recipe book, and an investment guide. By 2026-05 the codebase was Notion-shaped and the product was Notion-shaped, which meant it was competing with Notion — and losing on every axis a solo developer can't fix (scale, polish, marketing, billing).

The 2026-05-28 reset narrows the product to the thing nobody else owns: **shared decisions with history**, supported by personal and shared notes and a small set of daily-use utilities. Everything not in service of that vision either gets cut or coasts unmaintained until it earns its keep.

## 3. The four pillars

The product, after the reset, is four things in priority order. Anything else is supporting cast.

### Pillar 1 — Personal notebook  ✅ shipped 2026-05-28

Each person has private notes. This is the table-stakes "I want a place to think" surface. Without it, the app feels like a Slack channel, not a notebook.

Implementation: `visibility` flag on `Note` (PRIVATE / SHARED). Default PRIVATE on create.

### Pillar 2 — Shared notebook  ✅ existing memo system

Notes both partners can read and edit. Eventually with presence (an avatar showing who's reading), much later with real-time collaboration. For now, last-write-wins is fine — couples don't race the same paragraph.

This is the existing memo system, household-shared by default after the Phase 1 split.

### Pillar 3 — Decisions (the wedge)  — next

The differentiated feature. A `Plan` (e.g., "우리 첫 집 구하기") is broken into `SubPlan`s ("동네 정하기", "예산 정하기"). Each subplan has `Option`s with both partners' ratings and comments. A `Decision` locks in the chosen option with the reasoning. The timeline view is the screen people will screenshot to friends.

This is the feature that doesn't exist anywhere else, and the one we will spend the most time on.

### Pillar 4 — Calculator (the daily utility)  ✅ shipped 2026-05-29

A tape-style engineering calculator with Korean-relevant modes (기본 multi-line scratchpad with variables, 할부, 대출 상환, 더치페이, 날짜). The 기본 mode runs Soulver-style: `# comments`, `name = expr` assignments flow variables to later lines, click a result to insert at the cursor. History is shared between partners and clickable — click a row to load it back into the editor; saving with a row loaded creates a new entry (tape entries are immutable). **Calculations embed as frozen blocks in notes** via `/계산 스냅샷` (same pattern as `DataSnapshot`).

Deferred from Pillar 4: 적금/예금 만기, 단위 환산 (특히 평↔㎡), drag-to-insert (click-to-insert covers the common case).

## 4. What this is NOT

A short, deliberate list of things this product will not become — to keep us from drifting back to "Notion clone for couples."

- ❌ **Not a productivity app for individuals.** Solo users are not the target. If a feature only makes sense for one person, it doesn't ship.
- ❌ **Not a SaaS.** No billing, no pricing, no public sign-up, no commercial intent. The 2-person allowlist stays.
- ❌ **Not a Notion competitor.** No database views, no multi-page hierarchies, no permissions matrix.
- ❌ **Not an iMessage/SMS/email scraper.** We will never read your messages. Hard rule.
- ❌ **Not a Bank Salad alternative.** No financial-institution integration (마이데이터). Manual entry only.
- ❌ **Not real-time-first.** Last-write-wins for years; CRDT only if needed.
- ❌ **Not mobile-native.** Responsive web + PWA install. No iOS/Android binaries.

## 5. The non-negotiable feel

Three rules carry over from before the reset because they're orthogonal to scope:

1. **Bear is the visual baseline.** Calm typography, hairline borders, no card lift, single sparingly-used accent. Dark by default (Dracula). The product is for nighttime prose; the aesthetic is calm, not "designed."
2. **All UI text is in Korean.** The product is for two specific Korean speakers. No English chrome.
3. **Lucide icons, never emoji.** Emoji rendering depends on OS; Lucide gives us a consistent line-icon vocabulary across themes. Users can write emoji in their notes — chrome cannot.

These predate the reset and survive it.

## 6. Success criteria

What does success look like?

- **6 months from now**: both partners reach for this app before reaching for Notion / Kakao / 메모장 for the things it does well. The decision history for at least one major life decision (apartment, car, big trip) lives entirely inside the app.
- **12 months from now**: the calculator is used weekly, the shared notebook holds more than 100 notes between us, and there's a visible "decision archive" both partners can browse.
- **Never**: a third user. This is the line that keeps the product focused.

## 7. Pointers

- Build order and milestones: [`ROADMAP.md`](ROADMAP.md)
- Stack, folder layout, data model: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Visual rules and tokens: [`DESIGN.md`](DESIGN.md)
- Day-to-day project bible: [`../CLAUDE.md`](../CLAUDE.md)
