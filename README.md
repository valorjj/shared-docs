# shared-docs

A private web app for two people. Vite + React 19 + TypeScript on the
front, Spring Boot + Kotlin on the back, MariaDB on the side.

Deployed at **https://shared-docs-nine.vercel.app** (Vercel for the
front, Cloudflare Tunnel → Mac Mini for the API). Access is restricted
to two Google accounts via an OAuth + JWT pipeline; everything else
404s after a login redirect.

## What it does

- **Guides** — long-form markdown/JSX pages (신혼여행, 입주 청소, 주식 등)
  with a comments section per page.
- **Data** — typed mini-apps for tracking things together:
  - 구매 내역 (purchases) — multi-currency, inline-edit grid on desktop,
    per-row split mode (SHARED · MINE · THEIRS), per-currency
    settlement card with one-click 정산 완료 + history, KRW donut chart
    by category, recurring expenses with monthly auto-generation
  - 할 일 (shared todos) — tabs filter, anyone toggles done
  - 기념일 (anniversaries) — annual recurrence, N주년 badges,
    upcoming-30-days section
- **캘린더** — single calendar view that aggregates dated rows across
  4 sources: anniversaries, due-today todos, purchases, and settlement
  records. Built on `react-day-picker` with a custom day renderer that
  shows colored dots per event type. Clickable events jump back to
  their source page (purchases scroll to the exact row).
- **관리** — admin page for the email allowlist + user roles.

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict)
- **React Router v7** with layout routes (`<MobileShell>` adds bottom
  nav + safe-area padding under all protected routes) and `React.lazy`
  for every non-trivial page
- **TanStack Query** for server state; **axios** for HTTP with a bearer
  interceptor + 401 → /login redirect
- **react-data-grid v7** for the desktop spreadsheet on purchases
- **react-day-picker v10** with a custom `DayButton` for the calendar
- **MDX** via `@mdx-js/rollup` (scaffold for now)
- **jwt-decode** to read claims from the issued JWT (auth state)
- **Plain CSS Modules** per shared primitive; tokens-based design system
  in `src/components/ui/`. No Tailwind, no CSS-in-JS runtime.

## Repo layout (frontend)

```
src/
├── api/                        # axios client + shared QueryClient
├── auth/
│   ├── authContext.ts          # AuthContext + Role / AuthUser types
│   ├── AuthProvider.tsx        # Provider component
│   ├── useAuth.ts              # useAuth hook (separate file for Fast Refresh)
│   ├── RequireAuth.tsx
│   └── RequireRole.tsx
├── components/
│   ├── ui/                     # shared design system (CSS Modules + tokens.css)
│   │                           # Page, Card, Stack/Row, Field, Input, Select, Textarea,
│   │                           # Button, IconButton, Badge, Modal, Tabs, Checkbox,
│   │                           # Fab, Section, BackLink, Kbd
│   ├── common/                 # MobileTable, MobileShell, BottomNav (responsive primitives)
│   ├── Comments.tsx + .css     # comment list/form (per doc)
│   ├── CommentsFab.tsx + .css  # floating button + slide-in drawer
│   ├── DocLayout.tsx + .css    # shared wrapper for MDX-rendered docs
│   └── FloatingToc.tsx + .css  # right-side TOC for long guides
├── content/                    # *.mdx files (registry-driven, scaffold for now)
├── features/
│   ├── purchases/              # api + List + Grid + Form + settlement
│   │                           # SettlementCard + settlementApi + CategoryChart
│   │                           # RecurringPurchasesModal + recurringApi
│   ├── todos/
│   ├── anniversaries/
│   └── calendar/               # aggregator hook (4 event sources)
├── lib/
│   ├── format.ts               # formatMoney, monthBounds, ...
│   ├── color.ts                # hexWithAlpha
│   └── useMediaQuery.ts        # useSyncExternalStore based
├── pages/                      # Hub, DataHub, CalendarPage, Doc, Login, AuthCallback,
│                                # Forbidden, NotFound, Admin, + legacy {Honeymoon,Cleaning,Stock}
└── App.tsx                     # routes + Suspense fallback
```

## Run locally

```bash
npm install
npm run dev               # http://localhost:5173 (Vite)
```

Set `VITE_API_BASE_URL` in `.env.development` to point at a backend
(`http://localhost:8090` for local; the production env var on Vercel is
`https://docs-api.markflowing.com`).

Backend lives in the sibling repo `shared-docs-backend`. For local
end-to-end work, run `./gradlew bootRun` there and the
`SPRING_PROFILES_ACTIVE=local` profile exposes a `POST /api/auth/dev-login`
that issues a JWT for any allowlisted email without going through Google.

## Build

```bash
npm run build             # tsc -b && vite build → dist/
```

Vercel uses this same command. The build bakes `VITE_API_BASE_URL` into
the bundle, so a deploy after changing the env var is required for prod
to pick it up.

Initial JS bundle is ~202 kB (65 kB gzip). Heavy routes
(`/data/purchases`, `/calendar`, legacy guides) are code-split via
`React.lazy` and load on demand.

## Backend & deployment

The backend repo (`valorjj/shared-docs-backend`) handles:
- Google OAuth2 + JWT issuance
- All `/api/**` data endpoints (purchases, settlements, recurring
  purchases, todos, anniversaries, calendar aggregator, comments, admin)
- A self-hosted GitHub Actions runner on the Mac Mini that
  builds + redeploys via Docker Compose on every push to `main`

A Cloudflare Tunnel routes `docs-api.markflowing.com` → `localhost:8090`
on the Mac Mini.

Two blueprints in `shared-docs-backend/docs/` document the architecture
and roadmap:

- `AUTH_BLUEPRINT.md` — Google OAuth, JWT, allowlist, admin model
- `SCALING_BLUEPRINT.md` — feature roadmap + implementation log (latest
  entries cover settlement/split, recurring expenses, design system,
  calendar enrichment, code splitting)

## Conventions

- All UI text is in Korean.
- TypeScript strict mode.
- New code uses the shared primitives in `src/components/ui/` — don't
  hand-roll a new button or input. Tokens live in `tokens.css`.
- One feature = one folder under `src/features/` with `api.ts` + a list
  page + a form + a CSS file. Backend mirrors with one Kotlin package
  per feature.
- BigDecimal money + ISO 4217 currency code per row; `formatMoney()`
  from `src/lib/format.ts` wraps `Intl.NumberFormat('ko-KR', { currency })`.
- No global state library — React state + TanStack Query cache.
- No setState inside `useEffect` (ESLint `react-hooks/set-state-in-effect`
  is on). Use `useSyncExternalStore` for subscriptions, derived state
  for prop reset, the wrapper + keyed inner pattern for "reset form on
  open" — see any of the three `*Form.tsx` files for the canonical shape.

## Cross-feature routing tricks

PurchaseList recognises these URL query params (all clearable on close):

- `?month=YYYY-MM` — month filter (URL is the source of truth)
- `?date=YYYY-MM-DD` — opens add modal pre-filled with that date
- `?edit=N` — opens edit modal for that purchase id once rows load
- `?row=N` — scrolls grid to that row + 1.8s pulse highlight

TodoList and AnniversaryList both honor `?date=YYYY-MM-DD`. The
calendar uses these to make every event clickable: clicking a
purchase event lands on `/data/purchases?month=...&row=...`, scrolls,
and pulses.
