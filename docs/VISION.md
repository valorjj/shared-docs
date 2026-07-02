# Vision

> Last revised: 2026-07-02 — multi-tenant v2 direction, now **built and deployed** (Phases A–F shipped 2026-06; `main` is live). The "private 2-person app" framing from 2026-05-28 was reversed; see `plans/2026-05-29-multi-tenant-v2.md`. Open Google sign-up is already live (the rebuild removed the email allowlist — no gate to flip); going public is just sharing the URL. The Decisions backlog (§4 Pillar 3), the multi-calendar overlay (§5), and real-time collaborative editing on shared notes (§6, reversing the earlier "not a CRDT editor" line) — all listed elsewhere in this doc as "post-v2" or "not this" — have since shipped.

## 1. What this is

A multi-tenant knowledge and decision app where any small group — couples, families, friend circles, hobby clubs, work teams — can have their own shared workspace.

One user belongs to many workspaces. Each workspace is its own world: its own notes, calendar, calculator history, todos, anniversaries, recipes. Within a workspace, everything is shared by default; the author can flag a note PRIVATE if they want it to themselves. Across workspaces, the author can also grant individual documents to specific people (viewer or editor) — like sharing a Google Doc.

The intended use is *small*: 2–10 people per workspace, 20–100 total users. Not a Notion competitor in scale or polish — a focused tool for the recurring failure modes of group memory: *we decided something, and six months later nobody remembers why.*

## 2. Origin and direction changes

- **2026-02**: Started as a Bear-style memo app for one developer.
- **2026-03–04**: Grew sideways into a spreadsheet, calendar, purchase tracker, recipe book, investment guide. Codebase became Notion-shaped.
- **2026-05-22**: First "going public" initiative (per-doc sharing, public link viewer). Built, then abandoned.
- **2026-05-28**: Reset — narrowed to "private 2-person app for me + wife." Deleted ~4000 lines of share/ACL code. New four-pillar framing.
- **2026-05-29 (this revision)**: Reversed again — colleagues and friends actually want to use this. Going back to multi-tenant, with workspaces this time (didn't exist in the earlier public direction). Per-doc ACL revived from the 2026-05-28 deletion. Existing data wiped; v2 ships on a clean DB.

These reversals are documented because future readers will get confused otherwise. The current direction is multi-tenant; if a doc anywhere says "private 2-person app," it's stale.

## 3. Why this exists (the actual gap)

Off-the-shelf tools fail small groups in specific, recurring ways:

- **Notion** is built for individuals or large teams. Small-group sharing is awkward and the affordances point the wrong way.
- **Kakao / iMessage** preserves conversations but not decisions. Six months later, "왜 우리가 마포로 정했더라?" has no answer.
- **Bear** is a beautiful solo notebook. There is no "us" mode.
- **Splitwise / Bank Salad** track money but not the conversation around the money.
- **Google Docs / Drive** scales fine but its sharing UI is enterprise-shaped — a couple sharing a recipe shouldn't need to think about "permission levels" and "link sharing settings."

The product fills the gap: **a place where small groups write together, decide together, and can read the audit trail of how they got there.**

## 4. The four pillars (preserved through v2)

Inside any workspace, the product is four things. The multi-tenant rebuild doesn't change *what* the product is — it changes *who can use it*.

### Pillar 1 — Personal notebook
Each user has private notes (PRIVATE visibility flag). Even in a shared workspace, the author can keep some thoughts to themselves. Already implemented; survives the v2 rebuild with the workspace_id column added.

### Pillar 2 — Shared notebook
Notes the workspace can read and edit. Bear-style Tiptap editor with slash menu, bubble menu, `@`-mention, attachments. Already implemented; survives the v2 rebuild.

### Pillar 3 — Decisions (the wedge — shipped 2026-06, backlog complete 2026-06-19)
A `Plan` (e.g., "우리 첫 집 구하기") is broken into `SubPlan`s ("동네 정하기", "예산 정하기"). Each subplan has `Option`s with each member's rating, a vote tally, and comments via a per-plan discussion note. A `Decision` locks in the chosen option with the reasoning and a frozen vote snapshot. The timeline view is what people will screenshot. Lifecycle (lock, complete, discard) and deadlines round out the plan's life story.

This is the feature that doesn't exist anywhere else. It was Phase 3 in the old roadmap; the initial build plus its full backlog (lock/complete/discard, vote, discussion pane, deadlines) is done — see `plans/decisions-backlog.md`.

### Pillar 4 — Calculator (daily utility)
Tape-style engineering calculator with Korean-relevant modes (기본 multi-line scratchpad with variables, 할부, 대출, 더치페이, 날짜). Already implemented; survives the v2 rebuild with the workspace_id column added.

## 5. The two cross-cutting features that emerge from v2

The multi-workspace model makes two new directions cheap that weren't possible before:

### Cross-workspace sharing
Individual documents can be granted to specific users *outside* the workspace as viewer or editor. The recipient sees them in a top-level "공유받은 항목" view. This is how a colleague shares one specific work note with a friend's family workspace, or how I share a recipe with my mother's hobby group.

### Multi-calendar overlay — shipped 2026-06-19
Each workspace has its own calendar (anniversaries + todos + purchases + settlements within it). The 전체 워크스페이스 toggle overlays the calendars of every workspace a user belongs to — work + family + hobby in one view, each color-coded, each toggleable. Shipped ahead of the original post-v2 schedule; see `plans/2026-06-19-cross-workspace-calendar-design.md`.

## 6. What this is NOT

A short, deliberate list of things this product will not become:

- ❌ **Not a Notion / Slack at scale.** Workspaces stay small (designed for 2–10, not 200). No org-charts, no @everyone, no notification systems.
- ✅ ~~Not a real-time CRDT editor~~ — **reversed 2026-07-02**: shared (WORKSPACE-visibility) notes now support real-time collaborative editing via Yjs, with live colored cursors. This stayed narrower than it sounds: sync is ephemeral (session-only, in-memory `Y.Doc`s relayed by a protocol-blind WebSocket endpoint) — persistence is still a plain saved snapshot via the existing debounced `PATCH`, not a permanent CRDT history. PRIVATE notes are unaffected (author-only, nothing to co-edit). See `docs/plans/2026-07-02-realtime-collaboration-{design,plan}.md`.
- ❌ **Not an iMessage/SMS/email scraper.** We will never read your messages. Hard rule.
- ❌ **Not a Bank Salad alternative.** No 마이데이터, no bank integration. Manual entry only.
- ❌ **Not commercial.** No billing, no pricing, no plans, no upsells. Free for everyone who can sign in with Google. (May eventually need a "pay for storage above X" model if costs grow, but not before there's a reason to.)
- ❌ **Not mobile-native.** Responsive web + PWA install. No iOS/Android binaries.
- ❌ **Not a public document host.** Documents can be shared with specific users; there is no "publish this to the open web" mode.

## 7. The non-negotiable feel

Three rules carry across every direction change:

1. **Bear is the visual baseline.** Calm typography, hairline borders, no card lift, single sparingly-used accent. Dark by default (Dracula). The product is for nighttime prose; the aesthetic is calm, not "designed."
2. **All UI text is in Korean.** No English chrome. (The product is built by and for Korean speakers, even though it's now open to anyone with a Google account.)
3. **Lucide icons, never emoji.** Emoji rendering depends on OS; Lucide gives us a consistent line-icon vocabulary across themes. Users can write emoji in their notes — chrome cannot.

## 8. Success criteria

- **v2 ship date**: 4–5 weeks after Phase A starts. All 6 phases (A → F) green, allowlist removed, sign-up open.
- **6 months after v2 ship**: at least 5 active workspaces beyond mine. Real users using the per-doc share feature.
- **12 months after v2 ship**: the multi-calendar overlay shipped (✅ 2026-06-19); Decisions feature shipped (✅ 2026-06, backlog complete 2026-06-19); at least one documented "decision archive" in production use across multiple workspaces.

## 9. Pointers

- v2 spec (this is the active build target): [`plans/2026-05-29-multi-tenant-v2.md`](plans/2026-05-29-multi-tenant-v2.md)
- Build order and milestones: [`ROADMAP.md`](ROADMAP.md)
- Stack, folder layout, data model: [`ARCHITECTURE.md`](ARCHITECTURE.md) *(will be updated as v2 lands)*
- Visual rules and tokens: [`DESIGN.md`](DESIGN.md)
- Day-to-day project bible: [`../CLAUDE.md`](../CLAUDE.md)
