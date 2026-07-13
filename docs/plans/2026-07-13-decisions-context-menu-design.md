# Decisions 안건 context menu + customization — design

> 2026-07-13. Right-click (and long-press) context menu on 안건 cards, combining
> existing actions with new customization: a **shared** color/icon tag and a
> **personal** collapse-by-default. Decisions-first; the menu primitive is built
> generic so other surfaces can adopt it later.

## Goal

Give each 안건 (SubPlan) card a right-click context menu that is both:

1. **A faster path to existing actions** — 열기 / 수정 / 연결 / 기한 설정 / 삭제, so users
   don't have to hunt for hover icon-buttons.
2. **A place to customize the card** —
   - **Shared** (part of the record, synced live to everyone): an accent **color**
     and a small **icon** — team semantics like "red = risky", "🏠→Home icon".
   - **Personal** (this device only): **기본으로 접기** — remember the card collapsed to
     a compact one-line row.

Scope: **안건 only** (not 선택지, not 계획). Not app-wide yet — the menu component is
reusable, but this round wires it only to 안건 cards.

## Non-goals (YAGNI)

- No pin-to-top, no menu-driven rename (수정 already covers title/description).
- No per-user color override of a shared tag; color/icon are one shared value.
- No timeline (`PlanEvent`) entry for appearance changes — cosmetic, would be noise.
- No appearance on 선택지/계획 this round.

## Data model (backend)

Flyway **V26** — two nullable columns on `sub_plans`:

```sql
ALTER TABLE sub_plans
  ADD COLUMN accent_color VARCHAR(16) NULL,
  ADD COLUMN icon         VARCHAR(32) NULL;
```

- `accent_color` — a slug from a fixed set (below); `NULL` = no color.
- `icon` — a Lucide icon name from a curated allowlist (below); `NULL` = no icon.

`SubPlan` entity gains `accentColor: String?` and `icon: String?` (nullable, updatable).
Both are **light annotations**:

- **Not lock-guarded** — a frozen (잠금) plan can still be color-organized, matching how
  자료/댓글 stay open on a locked plan (only 안건/선택지/결정 content writes are guarded).
- **No `PlanEvent`** — cosmetic.

## Endpoint + permissions

`PATCH /api/subplans/{id}/appearance`

- Body: `{ "accentColor": string | null, "icon": string | null }` — **both fields always
  present** and both applied on every call (`null` clears that field). This avoids the
  Jackson "field omitted vs. explicitly null" ambiguity: the menu changes one at a time, so
  the FE carries the current value of the field it isn't changing (it has both on the node).
- Workspace-scoped via `findByIdAndWorkspaceId` → **404** if not in the caller's workspace
  (never a 403 existence leak, matching the rest of Decisions).
- **Validation**: `accentColor` must be in the color allowlist, `icon` in the icon
  allowlist, else **400** (RFC-7807 problem+json, matching the app's error contract).
- **Permission**: **any active workspace member** — shared team semantics, low-stakes,
  same posture as 투표/댓글/장단점. Not gated to author/owner.
- On `AFTER_COMMIT`, fires the existing decisions change-signal
  (`DecisionChangePublisher`, `{planId}` over `/ws/decisions/{workspaceId}`) so the tag
  appears live for every viewer.
- Returns the updated `SubPlanNode` (FE also invalidates `decisionKeys.scope`).

`accentColor` + `icon` are threaded into the existing `SubPlanNode` (getTree) and
`SubPlanDetail` (GET /api/subplans/{id}) responses.

## Color + icon sets

**6 tag colors** as semantic tokens — the one real token-system touch. Added to
`src/components/ui/tokens.css` and given per-theme values in `themes.css` for all four
themes (light / dark / dracula / monokai), so tags stay theme-correct with no hardcoded
hex (house rule). Proposed slugs: `red`, `amber`, `green`, `blue`, `purple`, `gray`
→ `--c-tag-red` … `--c-tag-gray`. Used only as a small accent (3px left bar + a dot),
never a full fill, so they read on any surface.

**~8–10 curated Lucide icons** as a single shared allowlist (e.g. `Flag`, `Star`,
`AlertTriangle`, `Home`, `Car`, `Heart`, `Briefcase`, `Clock`). Defined once on the FE
(`ACCENT_COLORS`, `ACCENT_ICONS`); the BE validates names against the same list (kept in
sync manually — small, stable list). Only these render; an unknown stored value is ignored.

## Frontend — `ContextMenu` primitive

New reusable primitive `src/components/ui/ContextMenu.tsx` (+ `.module.css`), tokens-only.
It is a **floating surface**, so `--shadow-md` is allowed (cards still never lift).

- Opens on `onContextMenu` (preventDefault) at the cursor position, or on **long-press
  (~500ms via pointer events)** on touch devices.
- Positioned so it never overflows the viewport (flip/clamp to edges); respects safe areas.
- Closes on outside-click, `Esc`, scroll, or item select.
- `role="menu"`, arrow-key + `Esc` handling, focus moves into the menu on open and back on
  close; `prefers-reduced-motion` disables the open animation.
- Renders menu items (label + optional shortcut hint + danger variant), dividers, and
  **arbitrary custom rows** (used for the color swatch row and icon grid).
- Touch targets in the menu ≥44px.

## Frontend — 안건 card wiring (`SubPlanCard`)

- `onContextMenu` / long-press on the card opens the menu, anchored at the pointer.
- **Actions** reuse the exact handlers the hover icons already call: 열기 (navigate to
  detail), 수정 (`handleEdit`), 연결 (`onOpenConnect`, top-level only), 기한 설정 (opens the
  `DeadlineChip` editor / a small deadline control), 삭제 (`handleDelete`, danger).
- **Customization rows**:
  - **색** — 6 swatches + a "없음" (clear) chip → `setAppearance({ accentColor: <slug|null>, icon: <current> })`.
  - **아이콘** — the curated icon grid + clear → `setAppearance({ accentColor: <current>, icon: <name|null> })`.
  - **기본으로 접기** — a checkbox item → writes `localStorage`.
- Appearance render:
  - **color** → a 3px accent bar on the card's left edge (`border-left`/pseudo) + a small
    dot next to the `안건 N` eyebrow.
  - **icon** → a small Lucide glyph before the title.
  - **collapsed** → the card renders as a one-line row (eyebrow · icon · title · status ·
    color dot) with a chevron to expand; the expanded/collapsed choice is **derived on
    render** from localStorage (no setState-in-effect), toggled by the menu item and the
    chevron.
- The hover icon-buttons **stay** — the context menu is an additive faster path, not a
  replacement (discoverability + touch users who long-press).

## Realtime & persistence

- **Shared** color/icon: `PATCH …/appearance` → AFTER_COMMIT change-signal →
  `decisionKeys.scope(wsId)` invalidation → tree/detail refetch → live for all viewers.
- **Personal** collapse: `localStorage["subplan-collapsed-{subPlanId}"]` (`subPlanId` is
  globally unique, so no workspace prefix needed), mirroring the existing
  `discussion-open-{planId}` precedent. Read via a tiny `useLocalStorageFlag`-style
  derive; never synced to the server.

## FE data layer

- `types.ts`: `SubPlanNode` + `SubPlanDetail` gain `accentColor: string | null` and
  `icon: string | null`. New `AccentColor` / `AccentIcon` string-literal unions +
  `ACCENT_COLORS` / `ACCENT_ICONS` constant lists (also drive the pickers).
- `api.ts`: `useSetAppearance(subPlanId)` — `PATCH /api/subplans/{id}/appearance`,
  invalidates `decisionKeys.scope`.

## Testing

**Backend**
- `appearance` accepts a valid color+icon, persists, and is reflected in getTree +
  getSubPlanDetail.
- invalid color or icon → 400.
- cross-workspace id → 404.
- works on a **locked** plan (not lock-guarded).
- clearing (`null`) removes the value.
- fires the decisions change-signal on commit.

**Frontend**
- gates: `tsc -b`, `npm run build`, `eslint src/features/decisions/` + `src/components/ui/`.
- manual: right-click opens the menu; long-press opens it on touch; set color/icon →
  persists and appears in a second browser (realtime); 기본으로 접기 collapses to a row and
  survives reload on that device only; menu closes on Esc/outside-click; keyboard nav works.

## Files

**Backend** (`shared-docs-backend`)
- `db/migration/V26__subplan_appearance.sql` (new)
- `decision/SubPlan.kt` (+2 columns)
- `decision/PlanService.kt` (setAppearance; thread into tree/detail responses)
- `decision/SubPlanController.kt` (PATCH …/appearance)
- `decision/DecisionDto.kt` (AppearanceRequest; SubPlanNode/SubPlanDetail fields)
- tests

**Frontend** (`shared-docs`)
- `components/ui/ContextMenu.tsx` + `.module.css` (new primitive)
- `features/decisions/types.ts` (fields + AccentColor/AccentIcon + constant lists)
- `features/decisions/api.ts` (`useSetAppearance`)
- `features/decisions/SubPlanCard.tsx` + `.module.css` (menu wiring + color/icon/collapse render)
- `components/ui/tokens.css` + `themes.css` (`--c-tag-*` ×6 ×4 themes)

## Open decisions (resolved)

- Menu UX: **inline** color swatches + icon grid (not a submenu).
- Backend: **columns on `sub_plans`** (not a separate annotations table).
- 기본으로 접기 target: **collapse the whole 안건 card** to a one-line row (personal).
- Permission: **any workspace member** may set color/icon.
- `--c-tag-*` tokens added across all four themes: **yes**.
