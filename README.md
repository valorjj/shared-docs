# shared-docs

A small-group shared workspace for couples, families, and friend circles. Bear-style memo editor, a Soulver-style engineering calculator, a calendar, a recipe book — and an upcoming decision-history surface so groups never lose track of *why* they chose what they chose.

One user, many workspaces (work / family / hobby). Each workspace is its own world: own notes, own calendar, own calc history. Cross-workspace sharing lets you grant a single document to specific people outside your workspace.

Currently rebuilding from a 2-person prototype to a multi-tenant app — see [`docs/plans/2026-05-29-multi-tenant-v2.md`](docs/plans/2026-05-29-multi-tenant-v2.md) for the architecture spec.

## Stack

- **Frontend:** Vite + React 19 + TypeScript + CSS Modules
- **Editor:** Tiptap v3 (with custom Tag, EntityLink, DataSnapshot, LinkCard, CalcSnapshot, SlashCommand, MentionCommand extensions)
- **Data:** TanStack React Query + axios with a Bearer-token interceptor
- **Backend:** Spring Boot 3.5 + Kotlin, JPA on MariaDB
- **Auth:** Google OAuth2 → JWT, open sign-up (temporary allowlist kill-switch during the v2 build)
- **Deploy:** Vercel (frontend) + Cloudflare Tunnel → Mac Mini Docker (backend + DB)

Live preview: `https://shared-docs-nine.vercel.app`

## What it does today (v1, frozen)

The v1 codebase is feature-complete as a single-workspace app. v2 rebuilds it as multi-tenant; the features themselves carry forward.

- **메모** — Bear-style markdown editor (Tiptap). Tables, task lists, slash menu, bubble menu, `@`-mention with entity search, `#hashtag`, attachments, drag-and-drop / paste image upload, soft-delete trash, frozen data snapshots, link cards, calc snapshots.
- **시트** — JSON-blob spreadsheet with react-data-grid on desktop and a card-per-row view on mobile.
- **데이터** — typed mini-apps: 구매, 정산, 반복 항목, 할 일, 기념일, 유용한 링크 (OpenGraph auto-fetch), 레시피 (dnd-kit sortable, 인분 환산).
- **계산** — `/calc`. Five modes (기본 multi-line scratchpad with variables and `#` comments, 할부, 대출 with amortization, 더치페이, 날짜). Shared tape; click any history row to load it back into the editor. Calculations embed as frozen blocks in notes via `/계산 스냅샷`.
- **캘린더** — aggregates 4 sources (기념일, 할 일, 구매, 정산) with per-source filters.
- **설정** — 4 themes (Dracula default), 3 fonts, 3 line-heights, click-to-apply.
- **⌘K** — global search across memo + sheet titles and bodies.

## What's coming (v2 build, ~4–5 weeks)

Multi-tenant rebuild. v1 features survive; the access model changes from "everyone sees everything" to "workspaces, with per-doc shares across boundaries":

1. **Workspaces** — one user belongs to many. Each is isolated by default.
2. **Invitations** — workspace owners invite by email; recipients claim via Google sign-in.
3. **Per-doc sharing** — grant any single note/sheet/calc-entry to specific users outside your workspace as VIEW or EDIT.
4. **"공유받은 항목"** — top-level view for cross-workspace grants.
5. **Open sign-up** — drop the 2-person allowlist; anyone with Google can sign in.
6. **Wipe + restart** — existing v1 data is dropped on cutover. No migration.

Six implementation phases (A–F) in [`docs/ROADMAP.md`](docs/ROADMAP.md).

After v2 ships: the **Decisions** feature (Plan → SubPlan → Option → Decision with timeline) and the **multi-calendar overlay** (work + family + hobby in one color-coded view).

## Run locally

```bash
npm install
npm run dev               # http://localhost:5173 (Vite)
```

Set `VITE_API_BASE_URL` in `.env.development` (`http://localhost:8090` for local). Backend lives in the sibling repo `shared-docs-backend`:

```bash
cd ../shared-docs-backend
./gradlew bootRun         # http://localhost:8090 — needs MariaDB on :3307
```

Dev-only shortcut: `POST /api/auth/dev-login` issues a JWT for any email without going through Google.

## Build

```bash
npm run build             # tsc -b && vite build → dist/
```

Bundle shape (gzip, v1 baseline): main ≈ 64 kB · Hub chunk (Tiptap-heavy) ≈ 167 kB · CalendarPage ≈ 23 kB · SheetsPage ≈ 20 kB.

## Folder layout (frontend)

```
shared-docs/
├── CLAUDE.md             ← project bible (start here)
├── docs/
│   ├── VISION.md         ← the why, the pillars, the not-list
│   ├── ROADMAP.md        ← v2 phases A-F + post-v2 directions
│   ├── ARCHITECTURE.md   ← stack, folders, data model, auth, deploy (v1 — will be updated as v2 lands)
│   ├── DESIGN.md         ← visual identity, tokens, Bear rules
│   ├── plans/            ← per-phase implementation plans
│   └── investment/       ← personal content (not project docs)
└── src/
    ├── api/              ← axios + shared QueryClient
    ├── auth/             ← AuthProvider + useAuth + tokenStorage
    ├── components/
    │   ├── ui/           ← design system (CSS Modules + tokens.css)
    │   └── common/       ← MobileShell / TopNav / BottomNav / AppSidebar
    ├── features/         ← 1 folder = 1 feature
    ├── lib/              ← format / color / useMediaQuery
    ├── pages/            ← route components (mostly lazy)
    └── App.tsx
```

Backend mirrors this with one Kotlin package per feature: `com.shareddocs.backend.<feature>`.

## Conventions

- All UI text in Korean
- Lucide icons only — no emoji as chrome
- CSS Modules + tokens (no Tailwind, no styled-components)
- One primary button per screen
- Card never lifts (hairline border, no shadow)
- No setState in effect; derive from URL or use the wrapper+keyed-inner pattern

Full design rules in [`docs/DESIGN.md`](docs/DESIGN.md).

## License

No license. Source provided for reference only.
