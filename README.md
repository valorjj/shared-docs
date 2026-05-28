# shared-docs

A private web app for two people — built for me and my wife to keep our notes and our decisions in one place. Bear-style memo editor, a soon-to-arrive engineering calculator, and (the headline feature) a decision-history surface so we never lose track of *why* we chose what we chose.

Not a SaaS, not for sale, not open to the public — the codebase is shared for reference and learning.

## Stack

- **Frontend:** Vite + React 19 + TypeScript + CSS Modules
- **Editor:** Tiptap v3 (with custom Tag, EntityLink, DataSnapshot, LinkCard, SlashCommand, MentionCommand extensions)
- **Data:** TanStack React Query + axios with a Bearer-token interceptor
- **Backend:** Spring Boot 3.5 + Kotlin, JPA on MariaDB
- **Auth:** Google OAuth2 → JWT (2-email allowlist, no public signup)
- **Deploy:** Vercel (frontend) + Cloudflare Tunnel → Mac Mini Docker (backend + DB)

Live (allowlisted only): `https://shared-docs-nine.vercel.app`

## What it does today

- **메모** — Bear-style markdown editor (Tiptap). Tables, task lists, slash menu, bubble menu, `@`-mention with entity search, `#hashtag`, attachments, drag-and-drop / paste image upload, soft-delete trash, frozen data snapshots and link cards.
- **시트** — JSON-blob spreadsheet with react-data-grid on desktop and a card-per-row view on mobile.
- **데이터** — typed mini-apps: 구매, 정산, 반복 항목, 할 일, 기념일, 유용한 링크 (OpenGraph auto-fetch), 레시피 (dnd-kit sortable, 인분 환산).
- **캘린더** — aggregates 4 sources (기념일, 할 일, 구매, 정산) with per-source filters.
- **설정** — 4 themes (Dracula default), 3 fonts, 3 line-heights, click-to-apply, localStorage-persisted.
- **⌘K** — global search across memo + sheet titles and bodies.

## What it's becoming (2026-05-28 reset)

The product has been narrowed to four pillars:

1. **Personal notes** — private notes per person (Phase 1, in progress)
2. **Shared notes** — the existing memo system
3. **Decisions** — Plan → SubPlan → Option → Decision with audit-trail UI (Phase 3, the wedge)
4. **Calculator** — tape-style engineering calc with Korean modes, embeddable in notes (Phase 2)

Sheets is frozen. Expenses are deferred. Email/SMS/Open-Banking integrations are off the table for good.

Full story: [`docs/VISION.md`](docs/VISION.md). Build order: [`docs/ROADMAP.md`](docs/ROADMAP.md).

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

Dev-only shortcut: `POST /api/auth/dev-login` issues a JWT for any allowlisted email without going through Google.

## Build

```bash
npm run build             # tsc -b && vite build → dist/
```

Bundle shape (gzip): main ≈ 64 kB · Hub chunk (Tiptap-heavy) ≈ 167 kB · CalendarPage ≈ 23 kB · SheetsPage ≈ 20 kB.

## Folder layout (frontend)

```
shared-docs/
├── CLAUDE.md             ← project bible (start here)
├── docs/
│   ├── VISION.md         ← the why, the four pillars, the not-list
│   ├── ROADMAP.md        ← phased build order
│   ├── ARCHITECTURE.md   ← stack, folders, data model, auth, deploy
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
