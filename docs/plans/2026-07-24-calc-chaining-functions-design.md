# BASIC calc — result chaining + function palette — design

> Date: 2026-07-24 · Pillar 4 (Calculator), BASIC mode only
> Status: design approved
> Related memory: Bear-minimal aesthetic; Lucide icons; CSS Modules + tokens; no setState-in-effect

## Problem

The BASIC calc is a Soulver-style multi-line scratchpad (`expr-eval`), but:

1. **Reusing a previous line's result requires the mouse** — you must click a result on the rail to insert its value at the cursor. There's no keyboard way to continue a calculation.
2. **Engineering functions are undiscoverable.** The engine (`expr-eval` 2.0.2) already supports `sqrt`, `^` (power), `abs`, `round`, `floor`/`ceil`, `sin`/`cos`/`tan`, `ln`, `log`/`log10`, `min`/`max`, `pow`, factorial, and the constants `PI`/`E` — but nothing in the UI surfaces them, so users don't know they can type `sqrt(70000)` or `2^10`. The page also reads as a plain box.

Both are **BASIC-mode-only** (the other tabs — 할부/대출/더치페이/날짜 — are structured forms, not free scratchpads).

## Feature 1 — previous-result chaining (engine)

File: `src/features/calc/compute/basic.ts`.

Maintain a running `ans` = the most recent line's numeric result, injected as a variable before each line is evaluated. Two keyboard-native, **live** ways to use it (both recompute when earlier lines change):

- **`ans` token** — usable anywhere in an expression or assignment RHS: `ans * 2`, `a = ans + 100`.
- **Leading-operator continuation** — a line whose first non-space character is one of `+ - * / ^ %` is rewritten to `ans <line>`, **only when a prior numeric result exists**. Example: after `80000 - 10000` (→70,000), a line `+ 5000` evaluates as `ans + 5000` = 75,000.

### Rules & edge cases

- `ans` updates after every line that produces a number (both `expr` and `assign` kinds). Before the first such line, `ans` is undefined.
- Leading-operator rewrite fires **only if `ans` is defined**. So with no prior result, a leading `-`/`+` is still a normal signed literal (`-5` = negative five); a leading `* / ^ %` with no `ans` falls through to the parser and errors as it does today.
- If the user explicitly assigns `ans = …`, that binding wins (their value flows into `vars['ans']` normally).
- Continuation operators: `+ - * / ^ %` only (ASCII, matching the existing operator set; no `×`/`÷`).
- Implementation sketch: after computing `vars`, evaluate each line with `{ ...vars, ans }` (ans = running last value); detect continuation with `/^[+\-*/^%]/` on the trimmed source and, when `ans != null`, evaluate `` `ans ${trimmed}` ``. The existing assignment regex runs first, so an `a = …` line is never mistaken for continuation.

## Feature 2 — function palette

New component `src/features/calc/modes/BasicFunctionBar.tsx` (+ `.module.css`), rendered between the toolbar and the scratchpad in `BasicMode.tsx`. A compact, grouped, tap-to-insert row. Every token maps to an already-supported engine feature:

| Group | Chips → inserted text (caret) |
|---|---|
| 기본 | `√`→`sqrt(‸)` · `x²`→`^2` · `xʸ`→`^` · `( )`→`(‸)` · `!`→`!` |
| 함수 | `sin`→`sin(‸)` · `cos`→`cos(‸)` · `tan`→`tan(‸)` · `ln`→`ln(‸)` · `log`→`log(‸)` · `abs`→`abs(‸)` |
| 상수 | `π`→`PI` · `e`→`E` |

`‸` = caret position after insert. `%` is **omitted** (it is modulo in this engine, not percentage — would mislead finance users; true percentage is a possible later engine addition).

### Insertion mechanism

Extend the existing cursor-insert in `BasicMode` to accept a caret offset: `insertAtCursor(text, caretOffset?)` places the caret at `start + caretOffset` (default `text.length`). Function chips pass the offset that lands the caret inside the parens (e.g. `sqrt()` with offset 5). After insert, refocus the textarea (same `requestAnimationFrame` pattern already used). The palette itself does not steal focus permanently — chips use the standard click; focus returns to the textarea on insert.

Palette item shape: `{ label: string; insert: string; caret?: number; group: '기본'|'함수'|'상수' }` in a plain array in `BasicFunctionBar.tsx`.

## Visual & placement

- The bar sits between the title/save toolbar and the scratchpad. Quiet group labels (기본 · 함수 · 상수) with small pill chips — hairline border, `--c-surface-tint` active, no lift — matching Tabs/ContextMenu styling. This is the added "strength" without a skeuomorphic keypad.
- Horizontally scrollable on narrow phones (`overflow-x: auto`), chips ≥ the touch-target norm.
- Update the summary hint line to mention chaining: e.g. append `· 연산자로 시작하면 이전 결과에 이어집니다`. Keep it one quiet line.

## Non-goals

- No changes to other calc modes, to save/history, or to the existing operators/formatting.
- No percentage operator, no new engine functions (only surfacing what exists).
- No on-screen numeric keypad (rejected in brainstorming — fights the text-scratchpad paradigm + minimal mandate).
- No change to the result-rail click-to-insert (kept; the palette and chaining are additive).

## Testing

No frontend test runner (project norm) — but the chaining logic is pure and lives in `compute/basic.ts`, so it is verifiable by inspection and (optionally) a throwaway `node` eval. Gates: `npx tsc -b --noEmit`, `npx eslint src/features/calc/`, `npm run build`.

Reasoned test cases for `computeBasic` (verify by inspection / node):
- `80000 - 10000\n+ 5000` → lines 70000, 75000; `finalValue` 75000.
- `10\nans * 2\nans + 1` → 10, 20, 21.
- `-5` (first line) → -5 (not a continuation; no prior ans).
- `* 3` (first line) → error (no ans, parser can't start with `*`).
- `a = 2\n^10` → a=2, then `ans ^ 10` = 1024 (ans=2 from the assign).
- `sqrt(70000)` → 264.575…; `2^10` → 1024.

Manual (owed by user): type a chain with leading operators, use `ans`, tap palette chips (caret lands inside parens), confirm on mobile the bar scrolls and chips are tappable.
