# Mobile-first note editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the note editor a mobile-first formatting experience — a keyboard-anchored accessory bar (curated buttons + a `+` insert sheet) — while leaving desktop untouched, plus a written whole-app mobile audit.

**Architecture:** Desktop keeps the existing top `NoteEditorToolbar`. On touch/mobile that toolbar is hidden via CSS and replaced by a new `NoteEditorAccessoryBar` pinned above the on-screen keyboard (tracked with the `visualViewport` API via a new `useKeyboardInset` hook). The bar's `+` opens a `NoteInsertSheet` bottom sheet that reuses `buildSlashItems` — the same source of truth as the `/` slash menu.

**Tech Stack:** React 19 + TypeScript, Tiptap v3 (`@tiptap/react`), CSS Modules + design tokens, Lucide icons, `visualViewport` browser API.

## Global Constraints

Copied verbatim from project rules (`shared-docs/CLAUDE.md` + design memory). Every task implicitly includes these:

- **All UI text in Korean.** No English chrome.
- **Lucide icons, never emoji** in chrome.
- **CSS Modules + tokens only.** No Tailwind, no styled-components, no hardcoded hex. Use existing tokens (`--c-border`, `--c-surface`, `--c-surface-tint`, `--c-text`, `--c-text-muted`, `--c-primary`, `--c-primary-soft`, `--r-sm`, `--t-fast`, `--fs-*`, `--fw-*`).
- **Card never lifts.** Hairline border + `--c-surface-tint` hover; shadow only for floating surfaces (the bottom sheet qualifies).
- **No `setState` in effect** for derivable state.
- **No backwards-compat shims, no feature flags.**
- **Comments default to none** — only where the *why* is non-obvious.
- **Toolbar stays Bear-minimal** — single highlight swatch, no toolbar expansion; the curated 8-item accessory set is deliberate.
- **Touch targets ≥ 44px.**

**Testing note (project reality):** This frontend has **no test runner** (no vitest/jest; `package.json` scripts are `dev`/`build`/`lint`/`preview`; zero `*.test.*` files). The authoritative gates are `npm run build` (= `tsc -b && vite build`) and `npx eslint src/`. This plan therefore uses **type-check + lint + manual verification** in place of automated unit tests, and isolates the one piece of pure logic (keyboard-inset math) into an exported function so it can be verified by inspection. Do **not** add a test framework — that is out of scope.

**Type-check command (use this exact form):** `npx tsc -b --noEmit`
(Plain `tsc --noEmit` checks zero files — the root tsconfig is a references stub.)

**Branch:** work is on `mobile-note-editor` (already created, design doc committed).

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/features/notes/editor/useKeyboardInset.ts` | Create | Pure `computeKeyboardInset()` + `useKeyboardInset()` hook tracking the on-screen keyboard via `visualViewport`. |
| `src/features/notes/editor/NoteEditorAccessoryBar.tsx` | Create | Mobile-only formatting bar pinned above the keyboard; curated button set + `+`. |
| `src/features/notes/editor/NoteEditorAccessoryBar.module.css` | Create | Styles for the accessory bar. |
| `src/features/notes/editor/NoteInsertSheet.tsx` | Create | Bottom sheet listing `buildSlashItems` for block inserts. |
| `src/features/notes/editor/NoteInsertSheet.module.css` | Create | Styles for the bottom sheet. |
| `src/features/notes/editor/NoteEditorToolbar.module.css` | Modify | Hide `.bar` under 768px (desktop-only toolbar). |
| `src/features/notes/editor/NoteEditor.tsx` | Modify | Mount accessory bar + insert sheet; own insert-sheet state + `insertItems` memo. |
| `docs/plans/2026-07-23-mobile-readiness-audit.md` | Create | Second deliverable: whole-app mobile audit roadmap (no code). |

---

## Task 1: `useKeyboardInset` hook

**Files:**
- Create: `src/features/notes/editor/useKeyboardInset.ts`

**Interfaces:**
- Produces:
  - `computeKeyboardInset(innerHeight: number, viewport: { height: number; offsetTop: number } | null): number` — pure; returns rounded px the keyboard occupies at the bottom, or `0` when below threshold / no viewport.
  - `useKeyboardInset(): number` — live inset, re-rendering on `visualViewport` resize/scroll; `0` when the API is absent.

- [ ] **Step 1: Create the hook file with pure function + hook**

Create `src/features/notes/editor/useKeyboardInset.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react'

// Below this many px we treat the viewport shrink as browser chrome / jitter
// rather than a real software keyboard — avoids the bar flickering in on scroll.
const KEYBOARD_MIN = 60

/**
 * Pure keyboard-height math, split out from the hook so it can be reasoned
 * about in isolation (this frontend has no test runner). The software
 * keyboard occupies the gap between the layout viewport (window.innerHeight)
 * and the visual viewport (its height + how far it's been pushed down).
 */
export function computeKeyboardInset(
  innerHeight: number,
  viewport: { height: number; offsetTop: number } | null,
): number {
  if (!viewport) return 0
  const inset = innerHeight - viewport.height - viewport.offsetTop
  return inset > KEYBOARD_MIN ? Math.round(inset) : 0
}

/**
 * Live bottom inset (px) the on-screen keyboard occupies. 0 when the keyboard
 * is closed or the browser lacks visualViewport (falls back to 0 → callers
 * render nothing / use their sticky fallback).
 */
export function useKeyboardInset(): number {
  const subscribe = useCallback((notify: () => void) => {
    const vv = window.visualViewport
    if (!vv) return () => {}
    vv.addEventListener('resize', notify)
    vv.addEventListener('scroll', notify)
    return () => {
      vv.removeEventListener('resize', notify)
      vv.removeEventListener('scroll', notify)
    }
  }, [])

  const getSnapshot = useCallback(() => {
    const vv = window.visualViewport
    return computeKeyboardInset(
      window.innerHeight,
      vv ? { height: vv.height, offsetTop: vv.offsetTop } : null,
    )
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Lint**

Run: `npx eslint src/features/notes/editor/useKeyboardInset.ts`
Expected: PASS (no errors/warnings).

- [ ] **Step 4: Verify the pure math by inspection**

Confirm each case against `computeKeyboardInset`:
- `computeKeyboardInset(800, null)` → `0` (no visualViewport).
- `computeKeyboardInset(800, { height: 800, offsetTop: 0 })` → `0` (keyboard closed).
- `computeKeyboardInset(800, { height: 500, offsetTop: 0 })` → `300` (300 > 60).
- `computeKeyboardInset(800, { height: 780, offsetTop: 0 })` → `0` (20 ≤ 60, treated as chrome).
- `computeKeyboardInset(800, { height: 460, offsetTop: 40 })` → `300` (800−460−40).

- [ ] **Step 5: Commit**

```bash
git add src/features/notes/editor/useKeyboardInset.ts
git commit -m "feat(notes): add useKeyboardInset hook for mobile editor bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LBT2xdBGiirYp15Ddo3Xue"
```

---

## Task 2: `NoteEditorAccessoryBar` component

**Files:**
- Create: `src/features/notes/editor/NoteEditorAccessoryBar.tsx`
- Create: `src/features/notes/editor/NoteEditorAccessoryBar.module.css`

**Interfaces:**
- Consumes: `useKeyboardInset` (Task 1); Tiptap `Editor`.
- Produces: `default` React component with props `{ editor: Editor | null; onOpenInsert: () => void }`.

Behavior: renders only when `editor` exists, is focused, and the keyboard inset > 0. Curated buttons: 굵게, 기울임, 강조(highlight), 제목(cycles ¶→H1→H2→H3), 글머리 기호, 체크리스트, 링크(opens insert sheet? no — link needs the dialog), 삽입(`+`). Note: the **link** button requests the shared link dialog, but the accessory bar has no link-dialog prop; to keep scope tight and avoid threading another callback, link is placed in the `+` sheet via `buildSlashItems` (which already has `link-card`) — the accessory bar's inline set is: 굵게, 기울임, 강조, 제목, 글머리 기호, 체크리스트, 인용, `+`. This keeps 8 targets, all pure Tiptap chains (no external dialog), and routes link/link-card/table/etc. through the sheet.

- [ ] **Step 1: Create the component**

Create `src/features/notes/editor/NoteEditorAccessoryBar.tsx`:

```tsx
import { useEffect, useReducer } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Highlighter,
  Heading,
  List,
  ListTodo,
  Quote,
  Plus,
} from 'lucide-react'
import { useKeyboardInset } from './useKeyboardInset'
import styles from './NoteEditorAccessoryBar.module.css'

type Props = {
  editor: Editor | null
  /** Opens the block-insert bottom sheet (owned by NoteEditor). */
  onOpenInsert: () => void
}

/** ¶ → H1 → H2 → H3 → ¶. One button cycles through heading levels. */
function cycleHeading(editor: Editor): void {
  const c = editor.chain().focus()
  if (editor.isActive('heading', { level: 1 })) c.toggleHeading({ level: 2 })
  else if (editor.isActive('heading', { level: 2 })) c.toggleHeading({ level: 3 })
  else if (editor.isActive('heading', { level: 3 })) c.setParagraph()
  else c.toggleHeading({ level: 1 })
  c.run()
}

/**
 * Mobile-only formatting bar pinned just above the on-screen keyboard while
 * the editor is focused. Desktop uses NoteEditorToolbar instead (this never
 * mounts there — the keyboard inset stays 0).
 */
export default function NoteEditorAccessoryBar({ editor, onOpenInsert }: Props) {
  const inset = useKeyboardInset()
  // Editor mutations (focus/blur/selection/marks) don't re-render this
  // component on their own — it lives above useEditor. Force a re-render on
  // editor transactions so active states + the focus gate stay live.
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', force)
    editor.on('focus', force)
    editor.on('blur', force)
    return () => {
      editor.off('transaction', force)
      editor.off('focus', force)
      editor.off('blur', force)
    }
  }, [editor])

  if (!editor) return null
  if (inset <= 0 || !editor.isFocused) return null

  const btn = (
    active: boolean,
    label: string,
    onPress: () => void,
    Icon: typeof Bold,
  ) => (
    <button
      type="button"
      className={`${styles.btn}${active ? ` ${styles.active}` : ''}`}
      // pointerdown + preventDefault keeps the editor focused (and the
      // keyboard up) — a plain click would blur the editor first.
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
      }}
      aria-label={label}
      title={label}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )

  return (
    <div className={styles.bar} style={{ bottom: inset }} role="toolbar" aria-label="서식">
      {btn(editor.isActive('bold'), '굵게', () => editor.chain().focus().toggleBold().run(), Bold)}
      {btn(editor.isActive('italic'), '기울임', () => editor.chain().focus().toggleItalic().run(), Italic)}
      {btn(editor.isActive('highlight'), '강조', () => editor.chain().focus().toggleHighlight().run(), Highlighter)}
      {btn(editor.isActive('heading'), '제목', () => cycleHeading(editor), Heading)}
      {btn(editor.isActive('bulletList'), '글머리 기호', () => editor.chain().focus().toggleBulletList().run(), List)}
      {btn(editor.isActive('taskList'), '체크리스트', () => editor.chain().focus().toggleTaskList().run(), ListTodo)}
      {btn(editor.isActive('blockquote'), '인용', () => editor.chain().focus().toggleBlockquote().run(), Quote)}
      {btn(false, '삽입', onOpenInsert, Plus)}
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

Create `src/features/notes/editor/NoteEditorAccessoryBar.module.css`:

```css
.bar {
  position: fixed;
  left: 0;
  right: 0;
  /* `bottom` is set inline to the live keyboard inset. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  padding: 4px 6px;
  border-top: 1px solid var(--c-border);
  background: var(--c-surface);
  z-index: 20;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 44px;
  height: 44px;
  border-radius: var(--r-sm);
  background: transparent;
  border: 0;
  color: var(--c-text-muted);
  cursor: pointer;
  transition: color var(--t-fast), background var(--t-fast);
}

.btn:active {
  background: var(--c-surface-tint);
  color: var(--c-text);
}

.active {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS. (If `toggleHeading`/`setParagraph`/`toggleTaskList` are flagged, confirm the extensions are registered in `NoteEditorBody.tsx` — they are: StarterKit heading, TaskList, Highlight, Blockquote.)

- [ ] **Step 4: Lint**

Run: `npx eslint src/features/notes/editor/NoteEditorAccessoryBar.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/notes/editor/NoteEditorAccessoryBar.tsx src/features/notes/editor/NoteEditorAccessoryBar.module.css
git commit -m "feat(notes): mobile keyboard accessory formatting bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LBT2xdBGiirYp15Ddo3Xue"
```

---

## Task 3: `NoteInsertSheet` bottom sheet

**Files:**
- Create: `src/features/notes/editor/NoteInsertSheet.tsx`
- Create: `src/features/notes/editor/NoteInsertSheet.module.css`

**Interfaces:**
- Consumes: `SlashItem[]` from `buildSlashItems` (`./slashItems`); Tiptap `Editor`.
- Produces: `default` component with props `{ open: boolean; onClose: () => void; editor: Editor | null; items: SlashItem[] }`.

Behavior: bottom sheet. Tapping an item runs it at the current selection (empty range = no deletion, unlike the slash flow which deletes the typed `/query`) and closes. Backdrop tap closes. Locks body scroll while open (mirrors `Modal`).

- [ ] **Step 1: Create the component**

Create `src/features/notes/editor/NoteInsertSheet.tsx`:

```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import type { SlashItem } from './extensions/SlashCommand'
import styles from './NoteInsertSheet.module.css'

type Props = {
  open: boolean
  onClose: () => void
  editor: Editor | null
  items: SlashItem[]
}

/**
 * Mobile block-insert sheet opened from the accessory bar's `+`. Reuses the
 * slash-menu items so `/` and `+` stay one source of truth. Runs each item at
 * the current (empty) selection — `deleteRange` on an empty range is a no-op,
 * so nothing is removed (the slash flow instead deletes the typed query).
 */
export default function NoteInsertSheet({ open, onClose, editor, items }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !editor) return null

  const runItem = (item: SlashItem) => {
    const { from, to } = editor.state.selection
    item.run(editor, { from, to })
    onClose()
  }

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="삽입">
        <div className={styles.grabber} aria-hidden="true" />
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => runItem(item)}
              >
                <item.Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>,
    document.body,
  )
}
```

Note: `SlashItem` shape (from `extensions/SlashCommand.ts`) is `{ id: string; title: string; hint: string; Icon: LucideIcon; run(editor, range): void }`. If the exported member name differs, adjust the import — but the field names above match `slashItems.ts`.

- [ ] **Step 2: Create the styles**

Create `src/features/notes/editor/NoteInsertSheet.module.css`:

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
  z-index: 40;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 41;
  background: var(--c-surface);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  border-top: 1px solid var(--c-border);
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  max-height: 60vh;
  overflow-y: auto;
}

.grabber {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--c-border);
  margin: 4px auto 8px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  background: transparent;
  border: 0;
  border-radius: var(--r-sm);
  color: var(--c-text);
  font-family: inherit;
  font-size: var(--fs-base);
  text-align: left;
  cursor: pointer;
}

.item:active {
  background: var(--c-surface-tint);
}

.item svg {
  color: var(--c-text-muted);
  flex-shrink: 0;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS. If `item.run(editor, { from, to })` is flagged on the range type, open `src/features/notes/editor/extensions/SlashCommand.ts`, read the `run` parameter type, and match it (it is a `{ from: number; to: number }`-compatible range).

- [ ] **Step 4: Lint**

Run: `npx eslint src/features/notes/editor/NoteInsertSheet.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/notes/editor/NoteInsertSheet.tsx src/features/notes/editor/NoteInsertSheet.module.css
git commit -m "feat(notes): block-insert bottom sheet for mobile editor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LBT2xdBGiirYp15Ddo3Xue"
```

---

## Task 4: Wire into `NoteEditor` + hide desktop toolbar on mobile

**Files:**
- Modify: `src/features/notes/editor/NoteEditorToolbar.module.css`
- Modify: `src/features/notes/editor/NoteEditor.tsx`

**Interfaces:**
- Consumes: `NoteEditorAccessoryBar` (Task 2), `NoteInsertSheet` (Task 3), `buildSlashItems` (`./slashItems`).

- [ ] **Step 1: Hide the desktop toolbar under 768px**

In `src/features/notes/editor/NoteEditorToolbar.module.css`, replace the existing mobile media query (lines 53–56, which enlarged buttons) with a hide rule:

Replace:
```css
@media (max-width: 767px) {
  .bar { padding: 4px 6px; gap: 1px; }
  .btn { width: 40px; height: 40px; }
}
```
With:
```css
/* Mobile uses the keyboard accessory bar (NoteEditorAccessoryBar) instead of
   this top strip — hide it so formatting lives at the thumbs, not off-screen. */
@media (max-width: 767px) {
  .bar { display: none; }
}
```

- [ ] **Step 2: Add imports to `NoteEditor.tsx`**

In `src/features/notes/editor/NoteEditor.tsx`, add near the other editor imports (after line 22, `import NoteEditorToolbar from './NoteEditorToolbar'`):

```tsx
import NoteEditorAccessoryBar from './NoteEditorAccessoryBar'
import NoteInsertSheet from './NoteInsertSheet'
import { buildSlashItems } from './slashItems'
```

Ensure `useMemo` is in the React import on line 1 (currently `import { useCallback, useEffect, useRef, useState } from 'react'`) — change to:
```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 3: Add insert-sheet state + items memo**

In `NoteEditor`, after the existing `const [linkDialogOpen, setLinkDialogOpen] = useState(false)` / `openLinkDialog` block (around line 57–58), add:

```tsx
  const [insertSheetOpen, setInsertSheetOpen] = useState(false)
  const openInsertSheet = useCallback(() => setInsertSheetOpen(true), [])
  const closeInsertSheet = useCallback(() => setInsertSheetOpen(false), [])
```

Then after the `onPickLinkCard` callback (around line 165), add the items memo (uses the four pick callbacks already defined above it):

```tsx
  const insertItems = useMemo(
    () => buildSlashItems(onPickFile, onPickSnapshot, onPickLinkCard, onPickCalcSnapshot),
    [onPickFile, onPickSnapshot, onPickLinkCard, onPickCalcSnapshot],
  )
```

- [ ] **Step 4: Mount the accessory bar and sheet**

In `NoteEditor`'s JSX, right after the `{canEdit && (<NoteEditorToolbar ... />)}` block (ends line 223), add the accessory bar:

```tsx
      {canEdit && (
        <NoteEditorAccessoryBar editor={editor} onOpenInsert={openInsertSheet} />
      )}
```

Then near the other dialogs at the bottom (after `<LinkDialog ... />`, around line 291), add the sheet:

```tsx
      <NoteInsertSheet
        open={insertSheetOpen}
        onClose={closeInsertSheet}
        editor={editor}
        items={insertItems}
      />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npx eslint src/features/notes/editor/`
Expected: PASS (no new errors; pre-existing debt elsewhere is out of scope — lint only this folder).

- [ ] **Step 7: Build (authoritative gate)**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build` both succeed).

- [ ] **Step 8: Manual verification (desktop, in `npm run dev`)**

- Open a note on a desktop viewport (≥768px): the top toolbar renders as before; no accessory bar appears; formatting works.
- Confirm no console errors.

- [ ] **Step 9: Manual verification (mobile — device or DevTools device toolbar with touch + a real software keyboard)**

Best on a real phone (DevTools can't raise a real keyboard, so `visualViewport` won't shrink — note this limitation):
- Focus the note body → keyboard rises → accessory bar sits directly above it.
- Tap 굵게/기울임/강조 → marks toggle, keyboard stays up, active state highlights.
- Tap 제목 repeatedly → cycles ¶→H1→H2→H3.
- Tap `+` → bottom sheet opens with 제목/목록/표/파일 첨부/링크 카드/스냅샷 etc.; tap 표 → table inserts, sheet closes.
- Blur (tap outside) → bar disappears.
- The top toolbar is hidden.

- [ ] **Step 10: Commit**

```bash
git add src/features/notes/editor/NoteEditor.tsx src/features/notes/editor/NoteEditorToolbar.module.css
git commit -m "feat(notes): wire mobile accessory bar + insert sheet into NoteEditor

Hides the desktop toolbar under 768px; mounts the keyboard accessory bar
and block-insert sheet on mobile. Desktop unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LBT2xdBGiirYp15Ddo3Xue"
```

---

## Task 5: Whole-app mobile-readiness audit (second deliverable)

**Files:**
- Create: `docs/plans/2026-07-23-mobile-readiness-audit.md`

This is a **written roadmap, no code.** The implementer reads each pillar's top-level pages and records findings. Use the frontend routes table in `shared-docs/CLAUDE.md` (§Routes) as the page inventory.

- [ ] **Step 1: Inventory the pages**

For each route/page, open its top-level component + `.module.css` and skim for mobile issues. Pages to cover (from the routes table):
- Notes hub (`/` → `NoteWorkspace`) + editor (just improved — record as "done, reference pattern").
- Sheets (`/sheets`).
- Decisions (`/decisions`, `/decisions/:planId`).
- Calendar (`/calendar`).
- Calc (`/calc`).
- Data sub-pages (`/data/*`: purchases, todos, anniversaries, links, recipes).
- Shared items (`/shared`).
- Settings (`/settings/members`, `/settings/categories`), Search palette, Admin.

- [ ] **Step 2: Record findings per page**

For each page, write a short block with these fields (fill with real observations, not placeholders):
- **Current state:** does it have a mobile layout at all? single-pane drill-in? back button? bottom nav?
- **Problems:** concrete — tap targets < 44px, horizontal scroll / overflow, chrome pinned top (far from thumbs), no keyboard handling, missing `env(safe-area-inset-*)`, tables/grids that don't reflow, modals that don't fit.
- **Severity:** High / Medium / Low.

Look for signals already in the codebase: which components use `env(safe-area-inset-*)` (grep shows `purchases`, `sheets`, `PlanDetail`, `CalcWorkspace`, `NoteWorkspace`, `Fab`, `BottomNav` do) vs. which don't; which use `useIsMobile`/`useIsTouch`.

- [ ] **Step 3: Write the priority-ranked fix list**

End the doc with a single table: each row = one prospective spec (page + fix summary + severity + rough size). Order by severity then reach. This is the roadmap the user asked for.

- [ ] **Step 4: Commit**

```bash
git add docs/plans/2026-07-23-mobile-readiness-audit.md
git commit -m "docs: whole-app mobile-readiness audit + priority roadmap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LBT2xdBGiirYp15Ddo3Xue"
```

---

## Self-Review

**Spec coverage:**
- Keyboard accessory bar → Tasks 2 + 4. ✓
- `visualViewport` tracking + fallback → Task 1 (`useKeyboardInset`, returns 0 without the API → bar hides; sheet uses `env(safe-area-inset-bottom)`). ✓
- Curated Bear-minimal button set → Task 2. ✓ (Design listed a `link` button on the bar; the plan moves link into the `+` sheet to avoid threading the link-dialog callback — noted in Task 2. The bar keeps 8 targets with 인용 in link's place. This is a deliberate, documented refinement.)
- `+` insert sheet reusing `buildSlashItems` → Task 3 + 4. ✓
- Focus-gated visibility; no fight with iOS selection menu (bubble menu stays off) → Task 2 (focus gate); bubble menu untouched. ✓
- Desktop unchanged → Task 4 hides toolbar only under 768px; accessory bar never mounts on desktop (inset 0). ✓
- Whole-app audit deliverable → Task 5. ✓

**Placeholder scan:** No TBD/TODO; all code is complete; the audit task specifies exact fields to fill (its *content* is genuinely discovered at execution — that's the deliverable, not a placeholder).

**Type consistency:** `computeKeyboardInset`/`useKeyboardInset` signatures match between Task 1 and Task 2. `NoteEditorAccessoryBar` props `{ editor, onOpenInsert }` match the mount in Task 4. `NoteInsertSheet` props `{ open, onClose, editor, items }` match Task 4. `buildSlashItems(onPickFile, onPickSnapshot, onPickLinkCard, onPickCalcSnapshot)` argument order matches `slashItems.ts` and the existing call in `NoteEditorBody.tsx`. `SlashItem.run(editor, range)` reused with an empty range. ✓

**Deviation from skill default (TDD):** No test runner exists in this frontend; verification is `tsc -b` + `eslint` + `npm run build` + manual, with pure logic isolated for inspection. Documented in Global Constraints.
