# CLAUDE.md

> Project bible. Last revised: 2026-05-28 after the vision reset.

## What this is

A private web app for two people (jeongjin + 채연). After the 2026-05-28 reset, the product is narrowed to four pillars:

1. **Personal notebook** (private notes per person — Phase 1, in progress)
2. **Shared notebook** (Bear-style memo, already shipped)
3. **Decisions** (Plan → SubPlan → Option → Decision with timeline history — Phase 3, the wedge)
4. **Calculator** (tape-style engineering calc, embeddable in notes — Phase 2)

Anything else is supporting cast or deferred indefinitely. Read [`docs/VISION.md`](docs/VISION.md) for the full reasoning, [`docs/ROADMAP.md`](docs/ROADMAP.md) for the build order.

## Repo layout

```
shared-docs-root/
├── shared-docs/           ← this repo (frontend)
│   ├── CLAUDE.md          ← you are here
│   ├── docs/
│   │   ├── VISION.md      ← the why, the four pillars, the not-list
│   │   ├── ROADMAP.md     ← phased build order + deferred list
│   │   ├── ARCHITECTURE.md← stack, folders, data model, auth, deploy
│   │   ├── DESIGN.md      ← visual identity, tokens, Bear rules
│   │   ├── plans/         ← per-phase implementation plans
│   │   └── investment/    ← personal content (not project docs)
│   └── src/
└── shared-docs-backend/   ← separate repo (Spring Boot + Kotlin)
```

## Stack at a glance

- **Frontend:** Vite + React 19 + TypeScript + CSS Modules. Tiptap v3 for the editor. React Query for data. React Router v6.
- **Backend:** Spring Boot 3.5 + Kotlin. JPA + MariaDB (port 3307 host). Hibernate `ddl-auto: update`.
- **Auth:** Google OAuth2 → JWT (24h), 2-email allowlist. No public signup, ever.
- **Deploy:** Vercel (frontend) + Cloudflare Tunnel → Mac Mini Docker (backend + DB + uploads volume).

Full details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Daily-use commands

### Frontend (`shared-docs/`)
```bash
npm run dev               # localhost:5173
npm run build             # production build → dist/
npx tsc --noEmit          # type-check only
npx eslint src/           # lint
```

### Backend (`shared-docs-backend/`)
```bash
./gradlew bootRun         # local — needs MariaDB on :3307
./gradlew test            # run JUnit tests
./gradlew build -x test   # build without tests
./gradlew bootJar         # produce executable JAR
```

Docker: `docker-compose.yml` orchestrates app + MariaDB. Profiles: `local` (DB on localhost:3307), `docker` (DB via host.docker.internal).

Dev shortcut: `POST /api/auth/dev-login` returns a JWT bypassing Google.

## Day-to-day rules (the ones that matter every commit)

These survive the reset because they're orthogonal to scope:

1. **All UI text in Korean.** No English chrome.
2. **Lucide icons, never emoji.** Emoji rendering depends on OS; users can write emoji in their note body, but the chrome cannot.
3. **CSS Modules + tokens.** No Tailwind, no styled-components, no hardcoded hex. See [`docs/DESIGN.md`](docs/DESIGN.md).
4. **One primary button per screen.** Browse / navigate / add are `outline`. The single primary is for the screen's one commit action.
5. **Card never lifts.** Hairline border + `--c-surface-tint` hover. Shadow is for floating surfaces only.
6. **No setState in effect.** Derive from `useSearchParams`, or use the wrapper+keyed-inner pattern for forms with `initial` props.
7. **No backwards-compat shims, no feature flags.** Two-person app. Ship to main or don't ship.
8. **Comments default to none.** Only write a comment when the *why* is non-obvious.

ESLint enforces 1–6 mechanically. The rest is review discipline.

## Feature status (post-reset)

| Feature | Status |
|---|---|
| Memo | **Active development** — Phase 1 adds personal/shared split |
| Sheets | **Frozen** — works today, no new features; removal candidate in H2 |
| 구매 / 정산 / 반복 항목 | **Deferred** — Phase X+ |
| 할 일 / 기념일 / 링크 / 레시피 | **Stable** — bug-fixes only |
| Calendar | **Stable** — will source Decisions in Phase 3 |
| Settings, Auth, Search palette | **Stable** |
| Calculator | **Phase 2 — not yet built** |
| Decisions | **Phase 3 — not yet built** |
| Presence on shared notes | **Phase 4 — not yet built** |

## Routes

| Path | Page | Auth | Lazy |
|---|---|---|---|
| `/login`, `/auth/callback` | Login / AuthCallback | public | no |
| `/` | NoteWorkspace (Hub) | required | yes |
| `/sheets` | SheetWorkspace | required | yes |
| `/data` | DataLayout (sidebar + Outlet) | required | no |
| `/data/purchases` | PurchaseList | required | yes |
| `/data/todos` | TodoList | required | yes |
| `/data/anniversaries` | AnniversaryList | required | yes |
| `/data/links` | LinkList | required | yes |
| `/data/recipes` | RecipeList | required | yes |
| `/data/recipes/:id` | RecipeEditor | required | yes |
| `/calendar` | CalendarPage | required | yes |
| `/admin` | Admin | ADMIN | yes |
| `/admin/categories` | AdminCategories | ADMIN | yes |

Query params worth knowing:
- `/` — `?note=N` activates that note
- `/sheets` — `?sheet=N`
- `/data/purchases` — `?month=YYYY-MM`, `?date=YYYY-MM-DD`, `?edit=N`, `?row=N`
- `/data/todos` / `/data/anniversaries` — `?date=YYYY-MM-DD`

## Entity & permission pattern

Every shared entity follows this contract:

- **Read** — any authenticated user (both allowlisted)
- **Write** — author only (`createdBy.userId === me.userId`)
- **Delete** — author or ADMIN
- **Soft-delete** — `deletedAt: Instant?`, plus `/restore` + `/forever`

The exception is `Note.visibility` (Phase 1): PRIVATE notes are invisible to the non-author even though both users are authenticated.

## Adding a new data feature

Mirror the existing pattern:

1. **Backend** — `com.shareddocs.backend.<feature>/`: Entity, Repository, Service, Controller, Dto. Optional Category + Bootstrapper.
2. **Frontend** — `src/features/<feature>/`: `api.ts` + `types.ts` + component tree. **One `.module.css` per component.**
3. Forms use `Modal` + primitives. Use the **wrapper + keyed inner** pattern, never `setState` in effect.
4. List pages use `Page`/`PageHeader`/`PageTitle`/`BackLink` or a custom List/Header/Item structure. FAB via `Fab`. For `/data/*` sub-pages, use `<BackLink to="/data" mobileOnly>`.
5. Add the route to `src/App.tsx` and **`React.lazy`-split it.**
6. Mobile-first: single-pane drill-in, back button, safe-area-inset on chrome.

## Plans

Implementation plans live in `docs/plans/`. The active one is:

- [`docs/plans/2026-05-28-personal-shared-notes.md`](docs/plans/2026-05-28-personal-shared-notes.md) — Phase 1

Plans for Phases 2–4 are written when the prior phase ships, not earlier.

## When in doubt

- Visual question → [`docs/DESIGN.md`](docs/DESIGN.md)
- Scope question → [`docs/VISION.md`](docs/VISION.md) and the "not-list"
- Build-order question → [`docs/ROADMAP.md`](docs/ROADMAP.md)
- "How is X wired?" → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

Memory file (Claude-internal): `~/.claude/projects/-Users-jeongjin-WebstormProjects-shared-docs-root/memory/MEMORY.md`.
