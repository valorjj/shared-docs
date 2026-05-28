# Design

> Visual identity. Last revised: 2026-05-28 (condensed from the old `CSS_ARCHITECTURE.md`).

## 1. Three principles

1. **Bear is the aesthetic baseline.** Calm typography, hairline borders, generous whitespace, no card lift, one sparingly-used accent. If a screen looks "designed," it's already off.
2. **Notion is the structural baseline.** Density on rest, affordances on hover. Slash menu for blocks, `@` for references. Sidebars are quiet rails.
3. **Dark is the default.** Specifically Dracula. The app is for nighttime prose; light is a deliberate alternative.

These are non-negotiable per-feature.

## 2. Three layers

```
Features    src/features/<feature>/*.module.css   — consume primitives + tokens
Primitives  src/components/ui/*.tsx + .module.css — consume tokens only
Tokens      src/components/ui/tokens.css + themes.css — pure CSS variables
```

**Dependency rule:** layers reference downward only. **File rule:** every visual unit gets its own CSS Module next to its TSX.

## 3. Tokens

### Color (semantic, not literal)

| Token | Use |
|---|---|
| `--c-bg` | Page background |
| `--c-surface` | Card / panel background |
| `--c-surface-tint` | Hover / secondary panels |
| `--c-surface-sunken` | Toolbars, grounded panels |
| `--c-overlay` | Modal scrim |
| `--c-text` / `--c-text-muted` / `--c-text-subtle` / `--c-text-placeholder` | Type hierarchy |
| `--c-primary` / `--c-primary-soft` | Commit-action color + tinted fill |
| `--c-accent` / `--c-accent-soft` | Identity / mark — **sparingly** |
| `--c-danger` | Destructive only |
| `--c-highlight` | Tiptap Highlight mark only |
| `--c-border` / `--c-border-strong` / `--c-border-dashed` | Hairlines |

### Spacing (always tokens, never raw px)

```
--sp-1: 4px    --sp-2: 8px    --sp-3: 12px   --sp-4: 16px
--sp-5: 20px   --sp-6: 24px   --sp-7: 32px   --sp-8: 40px   --sp-9: 48px
```

If a spec demands 18px, it's wrong — round to `--sp-4` (16) or `--sp-5` (20).

### Radius

```
--r-xs: 4px (chips)
--r-sm: 6px (small buttons)
--r-md: 8px (cards, inputs — identity radius)
--r-lg: 12px (modals)
--r-pill: 999px (pills, toggle thumbs)
```

### Type

```
--font-sans:  'Noto Sans KR'
--font-serif: 'Noto Serif KR'
--font-mono:  ui-monospace, SFMono-Regular, Menlo

--fs-xs:   0.72rem (timestamps, dense meta)
--fs-sm:   0.82rem (small labels)
--fs-base: 0.92rem (body)
--fs-md:   1rem    (inputs)
--fs-lg:   1.1rem  (section headings)
--fs-xl:   1.55rem (page titles)
--fs-2xl:  2rem    (display titles)

--fw-regular: 400  --fw-medium: 500  --fw-semi: 600  --fw-bold: 700

--lh-tight: 1.25  --lh-snug: 1.4  --lh-body: 1.65  --lh-loose: 1.85

--tracking-display: -0.01em  (serif h1 — fights Korean glyph stretch)
--tracking-tight:   -0.005em
--tracking-normal:  0
```

### Shadow

`--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--shadow-fab` — for floating surfaces (modals, menus, FABs) only. **Cards do not get shadow.**

### Motion

`--t-fast: 120ms ease` (micro) / `--t-base: 180ms ease` (state change). Anything longer than 250ms is too slow for this app.

## 4. Themes

A single attribute on `<html>` switches everything:

```html
<html data-theme="dracula" data-font="sans" data-line-height="normal">
```

| Theme | Identity | When |
|---|---|---|
| `light` | Neutral chrome, navy primary, Bear-red accent | Daytime / printing |
| `dark` | Charcoal, desaturated navy, warm red | OS-dark expectation |
| **`dracula`** | **Plum bg, lavender primary, pink accent** | **Default** |
| `monokai` | Olive bg, cyan primary, magenta accent | Code-mood alternative |

### FOUC discipline

Two coordinated places set the initial theme:

1. `index.html` ships `<html data-theme="dracula">` so first paint is correct.
2. `SettingsProvider` lazy-reads `localStorage`; `DEFAULT_SETTINGS.theme = 'dracula'`.

When you change defaults, change both. They must agree.

### Adding a theme

1. Slug → `THEMES` in `src/features/settings/types.ts`
2. Label → `THEME_LABELS`
3. Block → `:root[data-theme='<slug>']` in `themes.css`, overriding every `--c-*` and `--shadow-*`
4. Verify contrast: body text ≥ 4.5:1; ≥18px ≥ 3:1
5. Verify every page in the new theme

## 5. Bear aesthetic — five rules

### Hairlines, not lift

```css
/* ✅ */ .card { border: 1px solid var(--c-border); border-radius: var(--r-md); }
/* ❌ */ .card { box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: none; }
```

Cards don't lift. Hover signals via `--c-surface-tint`, never `transform`.

### Single accent

`--c-accent` appears in at most three places: pinned glyph, active sidebar item, tag chip. **Never a button.** Buttons commit data; data commit is `--c-primary`.

### One primary per screen

Audit: `count(buttons with variant="primary") ≤ 1`. Browse, navigate, add → `outline`. The single primary is for the screen's one commit action.

### Empty states are sentences

A single line of `--c-text-muted` prose, optionally one outline button below. No illustration. No big icon. No big number.

### Floating ≠ lifting

| Layer | Plane | Shadow? |
|---|---|---|
| Card | Same plane as page, separated by hairlines | No |
| Modal / Menu / FAB | Above page, on a higher plane | Yes |

## 6. Notion borrowings

| Pattern | Implementation |
|---|---|
| Slash menu (`/`) | `SlashCommand` Tiptap extension |
| `@` mention | `MentionCommand` + entity search |
| `[[note title]]` backlinks (memo-only) | `EntityLink` InputRule |
| Hover-reveal action density | Sidebar drag handles, table-column `×`, attachment kebab |
| Frozen embed cards | `DataSnapshot`, `LinkCard` block nodes |

What we don't borrow: page hierarchies (we're flat), block-handle drag UI (too much chrome), toggle blocks, database views.

## 7. Typography rules

- **Single `h1` per page.** Serif. `--fs-xl` for lists / `--fs-2xl` for hero pages (Login). Body and chrome are sans.
- **Korean tracking.** Display titles need `--tracking-display`; body uses `--tracking-normal`.
- **Reading mode.** `data-font="serif"` swaps body to Noto Serif KR.
- **Weight discipline.** Body is 400. Bold (700) is display titles only. "Needs emphasis" usually means 500.

## 8. Color usage

| Color | ✅ Allowed | ❌ Forbidden |
|---|---|---|
| `--c-primary` | Commit buttons, links | Decorative bg, hover tints |
| `--c-accent` | Identity glyphs | Buttons, CTAs |
| `--c-danger` | Destructive buttons, error text | Warnings (use muted) |
| `--c-highlight` | Tiptap Highlight only | Anywhere else |
| Hardcoded hex | Calendar dots (data), brand glyphs | Everywhere else |

**Hover semantics:** background tone shift, not color shift. `background: var(--c-surface-tint)` is the default hover.

## 9. Component CSS contract

```
src/components/ui/Button.tsx
src/components/ui/Button.module.css
```

Always together. No barrel `*.css`, no shared module across components.

```css
.btn { /* root */ }
.btn--primary { /* variant */ }
.btn--outline { /* variant */ }
.btn--sm { /* size */ }
.btn:disabled, .btn[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
.btn__icon { /* BEM child */ }
```

Reference tokens, never raw px / hex. Exception: micro-tunings (1px optical alignment) with a comment.

## 10. Spacing rhythm

- **Block separator** between major page sections: `--sp-6`
- **Default vertical rhythm** inside a section: `--sp-4`
- **Tight cluster** (icon + label): `--sp-2`
- **Page padding:** `--sp-7` mobile, `--sp-9` desktop

Use `gap` on flex/grid parents, not `margin` on children. `Stack` and `Row` already do this.

## 11. Forbidden patterns

| Pattern | Use instead |
|---|---|
| Inline `style={{ color: '#...' }}` | CSS Module class |
| Tailwind / utility classes | CSS Module class |
| Emoji as chrome icon | Lucide icon |
| Hardcoded hex (except calendar dots, brand) | `--c-*` token |
| `box-shadow` on `.card` | Hairline `border` |
| `transform: translateY(-1px)` on card hover | `background: var(--c-surface-tint)` |
| `z-index: 9999` | Define a `--z-*` scale when needed |
| `position: fixed` chrome without `safe-area-inset` | `env(safe-area-inset-*)` |
| `@media (prefers-color-scheme: dark)` in feature CSS | Token layer already handles it |
| `setState` in `useEffect` for URL→state | Derive from `useSearchParams` |

## 12. Accessibility

- Touch targets ≥ 44×44px on mobile (`min-height` + `min-width`).
- `:focus-visible` only, never `:focus`. Use `--ring-focus`.
- Contrast: body ≥ 4.5:1; large text ≥ 3:1. Re-verify for all 4 themes when changing tokens.
- `<button>` for actions, `<a>` for navigation. Never `<div onClick>`.
- `lang="ko"` on `<html>` for screen readers.

## 13. Motion

- Color, width/height, scroll-coupled animation: don't.
- Default `ease`; for snappier exits use `cubic-bezier(0.2, 0, 0.2, 1)`.
- Respect `prefers-reduced-motion` (global wrap in `App.css`).

## 14. New component checklist

Before writing `Foo.tsx + Foo.module.css`:

- [ ] Is there already a primitive? (check `components/ui/index.ts`)
- [ ] Where does it live? Feature → `features/<feature>/`. Reusable → `components/ui/`.
- [ ] Tokens it needs? Pick from §3 first. Add new ones only if the same value appears 3+ times in unrelated places.
- [ ] Variants spelled out up front?
- [ ] Mobile-first? Desktop overrides via `@media (min-width: 768px)`.
- [ ] Cycle all 4 themes — any hardcoded values?
- [ ] A11y: tab order, focus ring, semantic element, ≥44px touch target on mobile?
- [ ] Motion: `--t-fast` / `--t-base`, respects `prefers-reduced-motion`?

## 15. Layout primitives

| Primitive | Role |
|---|---|
| `Page` / `PageHeader` / `PageTitle` / `BackLink` | Page header trio |
| `Section` | Visual group inside a page |
| `Stack` / `Row` | Flex containers with `gap` |
| `Card` | Bordered block, no shadow |
| `AppSidebar` + `AppSidebarSection` + `AppSidebarItem` | Navigation rail |
| `Modal` / `ConfirmDialog` / `Menu` / `ContextMenu` | Floating surfaces (Radix-based) |
| `Fab` | Floating action button (mobile-first) |

If you write `display: flex; gap: ...` twice, you're missing a `Stack` or `Row`. Adopt instead.

## 16. Open questions

- **Light theme quality.** Currently maintained but no one uses it. A single revisit pass would catch any second-class feel.
- **Per-user theme on the server.** localStorage today; server-side sync would mean adding a `user_settings` table. Cross-device sync isn't currently a felt need.
- **Animation library.** Everything is CSS transitions. Bring in Motion One or Framer only if a single complex motion lands (e.g., draggable card with spring physics) — and scope it to that motion.
