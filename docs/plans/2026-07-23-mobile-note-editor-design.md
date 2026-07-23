# Mobile-first note editor — design

> Date: 2026-07-23 · Pillars: Personal/Shared notebook (1 & 2)
> Status: design approved, plan pending
> Related memory: mobile-first mandate, Bear aesthetic, toolbar-stays-Bear-minimal

## Problem

The note editor's formatting story is desktop-shaped. On a phone:

- The 16-button `NoteEditorToolbar` collapses to a **horizontal-scroll strip pinned to the top of the screen** (40×40 buttons). When the keyboard is up and the caret is mid-document, that bar is far from the thumbs and half its buttons are off-screen.
- The `NoteEditorBubbleMenu` is **disabled on touch** (`if (!editor || isTouch) return null`) because it collides with iOS's native Copy/Look-Up selection menu.
- So mobile formatting effectively relies on the `/` slash command alone.

Request 1 ("explicit toolbar") is already satisfied on desktop by `NoteEditorToolbar`. The real gap is **mobile**, which is request 2.

This design also resolves a standing tension: the "toolbar-stays-Bear-minimal" rule (prefer slash/bubble menu over toolbar expansion) vs. wanting an explicit, always-reachable formatting affordance. Resolution: **desktop keeps the compact top toolbar; mobile gets a keyboard-anchored accessory bar with a curated minimal set + a `+` insert sheet.** No toolbar sprawl on either platform.

## Approach

Desktop behavior is **unchanged**. All new behavior is **mobile/touch-only**, gated by `useIsTouch()` / `useIsMobile()`, so there is zero desktop regression risk. The chosen mechanism is a **keyboard accessory bar** — a compact formatting bar pinned just above the on-screen keyboard whenever the editor is focused, disappearing when it is not. This is the Bear / iOS-native pattern: thumb-reachable, always where the hands are.

## Components

Each unit has one job, a clear prop interface, and is independently testable.

| Unit | Type | Responsibility |
|---|---|---|
| `NoteEditorAccessoryBar.tsx` | new component | The formatting bar pinned above the keyboard. Mounts only on touch/mobile and only while the editor is focused. Renders the curated button set + `+`. |
| `useKeyboardInset.ts` | new hook | Tracks the on-screen keyboard via the `visualViewport` API; returns the pixel offset the bar should sit at (0 when no `visualViewport` or no keyboard present, so the bar stays hidden). |
| `NoteInsertSheet.tsx` | new component | Bottom sheet opened by the bar's `+`; renders `buildSlashItems` as a tap list. Thumb-anchored. |
| `NoteEditorToolbar.tsx` | changed | Accepts a `className` so `NoteEditor` can hide it under 768px (`display:none`) instead of rendering the scrolling strip. Desktop markup/behavior unchanged. |
| `NoteEditor.tsx` | changed | Mounts the accessory bar (mobile) alongside the toolbar (desktop); owns insert-sheet open state; wires the shared `buildSlashItems` callbacks it already has. |

### Accessory bar contents (Bear-minimal)

Curated inline/common set — **not** all 16. Everything heavier lives behind `+`.

```
B · I · highlight · H · bullet list · checklist · link · +
```

- 8 targets, each ≥44px, fits phone width with **no horizontal scroll**.
- `H` **cycles** ¶ → H1 → H2 → H3 (simpler than a picker; chosen over a 3-way heading picker).
- highlight = single swatch (per the Bear-minimal memory).
- These are the mid-sentence actions. Lower-frequency block/structural inserts live in the `+` sheet.

### `+` insert sheet contents

Bottom sheet rendering `buildSlashItems(...)` — the **same source of truth** as the `/` slash menu:
제목 1–3, 글머리 기호, 번호 매기기, 체크리스트, 인용, 코드 블록, 표, 파일 첨부, 링크 카드, 데이터 스냅샷, 계산 스냅샷.

## Keyboard tracking

`useKeyboardInset` subscribes to `window.visualViewport` `resize` + `scroll`:

```
keyboardInset = window.innerHeight - visualViewport.height - visualViewport.offsetTop
```

The bar is `position: fixed; bottom: <keyboardInset>px`, so it rides on top of the keyboard and follows it up/down.

Rules:
- **Keyboard-driven** — the bar appears only when the editor is focused **and** a software keyboard is present (`visualViewport` inset > 0). On browsers without `visualViewport`, or on `<768px` viewports where no software keyboard is up (e.g. a tablet with a hardware keyboard, or a narrowed desktop window), the bar does not appear; the slash `/` menu is the universal formatting fallback available everywhere, on every surface.
- **Focus-gated** — the bar appears when the editor gains focus and a keyboard inset is detected, and hides on blur (or when the inset returns to 0), so it never floats over the note list or a dismissed keyboard.
- **Safe-area insets** honored via `env(safe-area-inset-bottom)` for the home-indicator gap.

**Future enhancement (not built):** a `position: sticky; bottom: 0` fallback for browsers without `visualViewport` was considered and deliberately deferred — its value is limited, since without `visualViewport` a bottom-fixed bar would itself sit behind the keyboard with no way to detect and avoid it.

## Edge cases

- **iOS native selection menu** — no conflict: the accessory bar anchors to the *keyboard*, not the *selection*, so it doesn't fight Copy/Look-Up (the reason the bubble menu was disabled). The bubble menu stays off on touch, as-is.
- **Collab cursors / avatar stack** — untouched; the bar is a sibling overlay.
- **Non-touch / desktop** — bar never mounts; top toolbar unchanged.
- **Note switching / unmount** — bar unmounts with the editor; no stray fixed element.

## Non-goals

- No changes to desktop formatting UX.
- No re-enabling of the touch bubble menu.
- No changes to autosave, collab, attachments, or the slash command itself (only reused).
- No overflow menu / toolbar expansion on desktop.

## Testing

- `useKeyboardInset`: unit test the offset math and the no-`visualViewport` branch (returns 0, so the bar stays hidden).
- `NoteEditorAccessoryBar`: renders the curated set; each button dispatches the correct Tiptap chain; `+` opens the sheet; hidden when unfocused / on desktop.
- `NoteInsertSheet`: renders `buildSlashItems`; a tap runs the item and closes the sheet.
- Manual smoke on a real phone (owed by user): type mid-document, verify the bar tracks the keyboard, format inline, insert a block via `+`, rotate orientation.

## Second deliverable — whole-app mobile audit

A written roadmap doc, **no code**: `docs/plans/2026-07-23-mobile-readiness-audit.md`.

For each pillar/page (notes, sheets, decisions, calendar, calc, data → todos/anniversaries/links/recipes, settings, search) it records: current mobile state, concrete problems (tap targets, horizontal scroll, off-screen chrome, keyboard handling, safe-area), and a **priority-ranked fix list**. Each item later becomes its own spec. This session builds only the note-editor slice above; the audit gives the roadmap for the rest.
