# Navigation compaction — design

> Date: 2026-07-24 · Global shell (`TopNav` / `BottomNav`)
> Status: design approved
> Related memory: mobile-first + lightweight mandate; Lucide icons; CSS Modules + tokens

## Problem

Both navs are overcrowded.

- **Mobile bottom bar** (`BottomNav.tsx`): 9 slots for a regular user — 메모 · 시트 · 데이터 · 계산 · 캘린더 · 결정 · 공유 · 검색 · 설정 (10 with 관리 for admins). iOS/Android guidance is ~5; this is roughly double, so labels/icons are cramped on a phone.
- **PC top bar** (`TopNav.tsx`): brand + workspace switcher + 8 nav links + 검색 + 설정 + user menu in one row.
- **Duplication:** the `ITEMS` nav array is copy-pasted in both `BottomNav.tsx` and `TopNav.tsx` — they can drift.
- **Mobile workspace gap:** `WorkspaceSwitcher` renders **only** inside `TopNav`, which returns `null` on mobile — so on a phone there is currently *no way to switch workspaces*.

## Approach

Split destinations into **primary** (one-tap everywhere) and **secondary** (behind a 더보기 grouping), from one shared definition. Pure nav reorganization — no route changes, no new pages, no behavior change to the search palette / settings dialog / workspace switcher internals (only *where* they are reached).

- **Primary:** 메모 (`/`), 결정 (`/decisions`), 캘린더 (`/calendar`), 계산 (`/calc`).
- **Secondary (더보기):** 시트 (`/sheets`), 데이터 (`/data`), 공유 (`/shared`), 관리 (`/admin`, admin-only).
- **Utilities:** 검색 (palette), 설정 (dialog) — into 더보기 on mobile; stay as-is on the right of the PC bar.

## Components

| Unit | Type | Responsibility |
|---|---|---|
| `navItems.ts` | new module | Single source of truth: each destination `{ to, Icon, label, primary, adminOnly? }`. Both navs import it; kills the duplicated `ITEMS` arrays. |
| `MoreSheet.tsx` (+ `.module.css`) | new (mobile) | The 더보기 bottom sheet (wraps the existing `AppSidebarSheet` primitive). Renders: workspace switcher → secondary nav links → 검색 / 설정 → account (name/email + 로그아웃). |
| `BottomNav.tsx` | changed | Render primary items as `NavLink`s + a 더보기 button that opens `MoreSheet`. 더보기 shows active state when the current route is a secondary destination. |
| `TopNav.tsx` | changed | Render primary items as `NavLink`s + a 더보기 dropdown (existing `Menu` primitive) holding the secondary links. 검색, 설정, workspace switcher, user menu unchanged. |

### `navItems.ts` shape

```ts
export type NavItem = {
  to: string
  Icon: LucideIcon
  label: string
  primary: boolean       // true → own slot in both navs
  adminOnly?: boolean
}
export const NAV_ITEMS: NavItem[]  // ordered
// helpers: primaryItems(), secondaryItems() (both apply the adminOnly filter at call site with the user role)
```

Order: 메모, 결정, 캘린더, 계산 (primary), then 시트, 데이터, 공유, 관리 (secondary).

### Mobile 더보기 sheet (top → bottom)

1. **Workspace switcher** — fixes the mobile switching gap.
2. Secondary nav links: 시트 · 데이터 · 공유 · 관리(admin only). Each closes the sheet on navigate.
3. 검색 (opens palette, closes sheet) · 설정 (opens settings dialog, closes sheet).
4. Account block: avatar + name + email, 로그아웃.

The 더보기 tab button gets `--active` styling when `location.pathname` matches a secondary route (`/sheets`, `/data`, `/shared`, `/admin`), so the user can tell the current page lives under 더보기.

### PC 더보기 dropdown

A `Menu` whose trigger is a `더보기` nav-style button (with a chevron). Items = secondary links (`MenuItem` with icon), navigating via router. Trigger gets active styling when on a secondary route, mirroring mobile.

## Edge cases

- **Admin-only 관리** — filtered by `user?.role === 'ADMIN'` at render, in both the bottom sheet and the PC dropdown (same rule as today).
- **Hidden routes** — the existing `HIDDEN_PREFIXES` gating (`/login`, `/auth`, `/doc`) is preserved in both navs.
- **Active state** — primary `NavLink`s keep their built-in active state; 더보기 computes active from the secondary route list.
- **Sheet dismissal** — tapping any item in `MoreSheet` closes the sheet (before navigating / opening the palette or dialog).

## Non-goals

- No route/page changes; no new destinations.
- No change to `WorkspaceSwitcher`, search palette, or settings dialog internals.
- No change to the PC right-side cluster (검색 / 설정 / user) beyond it staying put.
- No reordering of which features exist — only their nav grouping.

## Testing

No frontend test runner (project norm). Gates: `npx tsc -b --noEmit`, `npx eslint src/components/common/ src/features/workspaces/`, `npm run build`. Manual (owed by user): on a phone, confirm 5 bottom tabs, 더보기 opens the sheet with workspace switcher + secondary links + 검색/설정/account, secondary route highlights 더보기; on desktop, confirm the 더보기 dropdown holds 시트/데이터/공유/관리 and the row is no longer crowded.
