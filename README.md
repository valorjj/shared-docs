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
  구매 내역 (purchases · multi-currency), 할 일 (shared todos), 기념일
  (anniversaries with recurrence). All shipped.
- **캘린더** — single calendar view that aggregates dated rows across
  anniversaries + due-today todos. Built on `react-day-picker`.
- **관리** — admin page for the email allowlist + user roles.

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **React Router v7** with layout routes (`<MobileShell>` adds bottom nav
  + safe-area padding under all protected routes)
- **TanStack Query** for server state; **axios** for HTTP with a bearer
  interceptor + 401 → /login redirect
- **MDX** via `@mdx-js/rollup` for content authoring (`src/content/*.mdx`)
- **react-day-picker** for the calendar
- **jwt-decode** to read claims from the issued JWT (auth state)
- Plain CSS modules per feature (no Tailwind)

## Repo layout (frontend)

```
src/
├── api/                        # axios client + shared QueryClient
├── auth/                       # AuthContext, RequireAuth, RequireRole, tokenStorage
├── components/
│   ├── common/                 # MobileTable, MobileShell, BottomNav (responsive primitives)
│   ├── Comments.tsx + .css     # comment list/form (per doc)
│   ├── CommentsFab.tsx + .css  # floating button + slide-in drawer
│   ├── DocLayout.tsx + .css    # shared wrapper for MDX-rendered docs
│   └── FloatingToc.tsx + .css  # right-side TOC for long guides
├── content/                    # *.mdx files (registry-driven, scaffold for now)
├── features/
│   ├── purchases/              # api.ts + PurchaseList + PurchaseForm + css
│   ├── todos/                  # api.ts + TodoList + TodoForm + css
│   ├── anniversaries/          # api.ts + AnniversaryList + AnniversaryForm + css
│   └── calendar/               # api.ts (aggregator hook)
├── lib/useMediaQuery.ts        # useIsDesktop / useIsMobile
├── pages/                      # Hub, DataHub, CalendarPage, Doc, Login, AuthCallback,
│                                # Forbidden, NotFound, Admin, + legacy {Honeymoon,Cleaning,Stock}
└── App.tsx
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

## Backend & deployment

The backend repo (`valorjj/shared-docs-backend`) handles:
- Google OAuth2 + JWT issuance
- All `/api/**` data endpoints
- A self-hosted GitHub Actions runner on the Mac Mini that
  builds + redeploys via Docker Compose on every push to `main`

A Cloudflare Tunnel routes `docs-api.markflowing.com` → `localhost:8090`
on the Mac Mini.

Two blueprints in `shared-docs-backend/docs/` document the architecture
and roadmap in detail:

- `AUTH_BLUEPRINT.md` — Google OAuth, JWT, allowlist, admin model
- `SCALING_BLUEPRINT.md` — MDX, mobile-first patterns, typed data
  features, calendar aggregator, what's done vs deferred

## Conventions

- All UI text is in Korean.
- TypeScript strict mode.
- One feature = one folder under `src/features/` with `api.ts` + a list
  page + a form + a CSS file. Backend mirrors with one Kotlin package
  per feature.
- BigDecimal money + ISO 4217 currency code per row;
  `Intl.NumberFormat('ko-KR', { currency: 'KRW' })` formats naturally.
- No global state library — React state + TanStack Query cache.
