# BASIC calc — chaining + function palette — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox syntax.

**Goal:** Add keyboard result-chaining (`ans` + leading-operator) to the BASIC calc engine, and a tap-to-insert function palette to the BASIC page.

**Architecture:** Pure engine change in `compute/basic.ts` (running `ans` var + leading-operator rewrite). New `BasicFunctionBar` component inserts function/constant tokens at the textarea cursor via an extended `insertAtCursor(text, caretOffset?)` in `BasicMode`.

**Tech Stack:** React 19 + TS, `expr-eval` 2.0.2, CSS Modules + tokens.

## Global Constraints

- All UI text Korean; Lucide icons never emoji; CSS Modules + design tokens only (no hardcoded hex).
- No test runner may be added. Gates: `npx tsc -b --noEmit`, `npx eslint src/features/calc/`, `npm run build`.
- BASIC mode only; no changes to other modes, save/history, existing operators/formatting, or the rail click-to-insert.
- `%` chip omitted (modulo ≠ percentage).

---

## Task 1: Engine — `ans` + leading-operator continuation

**Files:** Modify `src/features/calc/compute/basic.ts`

**Produces:** `computeBasic` gains: a running `ans` injected per-line; leading `+ - * / ^ %` on a line rewrites to `ans <line>` when `ans` is defined.

- [ ] **Step 1** — Add a continuation matcher near the `ASSIGNMENT` regex:

```ts
const CONTINUATION = /^[+\-*/^%]/
```

- [ ] **Step 2** — In `computeBasic`, track running ans and inject it. Change the loop so `vars` always carries the latest `ans`, and rewrite continuation lines. Specifically: keep a `let ans: number | null = null`. In each branch that produces a numeric `value` (assign and expr), set `ans = value` after pushing the line. For evaluation, pass `ans` into the vars map, and for a bare expression that matches `CONTINUATION` with `ans != null`, evaluate `` `ans ${trimmed}` `` instead of `trimmed`.

Replace the assignment + bare-expression blocks with:

```ts
    const evalVars = ans === null ? vars : { ...vars, ans }

    const assign = trimmed.match(ASSIGNMENT)
    if (assign) {
      const [, name, expr] = assign
      try {
        const value = evaluateNumeric(expr, evalVars)
        vars[name] = value
        ans = value
        lines.push({ source, kind: 'assign', name, value, formatted: formatNumber(value) })
      } catch (err) {
        lines.push({ source, kind: 'error', error: errorMessage(err) })
      }
      continue
    }

    try {
      const toEval = CONTINUATION.test(trimmed) && ans !== null ? `ans ${trimmed}` : trimmed
      const value = evaluateNumeric(toEval, evalVars)
      lines.push({ source, kind: 'expr', value, formatted: formatNumber(value) })
      ans = value
    } catch (err) {
      lines.push({ source, kind: 'error', error: errorMessage(err) })
    }
```

Note: `evalVars` includes `ans` so both the `ans` token and the `ans ${trimmed}` rewrite resolve. A user `ans = …` assignment sets `vars.ans`, which then overrides the injected running value on later lines (their binding wins) — acceptable per spec.

- [ ] **Step 3** — Verify by node (throwaway):

```bash
cd shared-docs && node -e "
const { computeBasic } = require('./src/features/calc/compute/basic.ts')" 2>/dev/null || echo "TS not node-runnable; verify via cases below in the app"
```

Since `.ts` isn't directly node-runnable, verify by inspection against these cases (must hold):
- `80000 - 10000\n+ 5000` → 70000, 75000
- `10\nans * 2\nans + 1` → 10, 20, 21
- `-5` → -5 (no prior ans; not continuation)
- `* 3` (first line) → error
- `a = 2\n^10` → a=2, then 1024

- [ ] **Step 4** — Gates: `npx tsc -b --noEmit` (PASS), `npx eslint src/features/calc/compute/basic.ts` (PASS).

- [ ] **Step 5** — Commit: `feat(calc): ans + leading-operator chaining in BASIC engine`.

---

## Task 2: `BasicFunctionBar` component

**Files:** Create `src/features/calc/modes/BasicFunctionBar.tsx` + `BasicFunctionBar.module.css`

**Produces:** `export default function BasicFunctionBar({ onInsert }: { onInsert: (text: string, caretOffset?: number) => void })` — renders grouped chips; clicking calls `onInsert`.

- [ ] **Step 1** — Create `BasicFunctionBar.tsx`:

```tsx
import styles from './BasicFunctionBar.module.css'

type Chip = { label: string; insert: string; caret?: number }
type Group = { name: string; chips: Chip[] }

// caret = caret offset from the insert start; default = end of inserted text.
const GROUPS: Group[] = [
  {
    name: '기본',
    chips: [
      { label: '√', insert: 'sqrt()', caret: 5 },
      { label: 'x²', insert: '^2' },
      { label: 'xʸ', insert: '^' },
      { label: '( )', insert: '()', caret: 1 },
      { label: '!', insert: '!' },
    ],
  },
  {
    name: '함수',
    chips: [
      { label: 'sin', insert: 'sin()', caret: 4 },
      { label: 'cos', insert: 'cos()', caret: 4 },
      { label: 'tan', insert: 'tan()', caret: 4 },
      { label: 'ln', insert: 'ln()', caret: 3 },
      { label: 'log', insert: 'log()', caret: 4 },
      { label: 'abs', insert: 'abs()', caret: 4 },
    ],
  },
  {
    name: '상수',
    chips: [
      { label: 'π', insert: 'PI' },
      { label: 'e', insert: 'E' },
    ],
  },
]

type Props = {
  onInsert: (text: string, caretOffset?: number) => void
}

export default function BasicFunctionBar({ onInsert }: Props) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="함수 삽입">
      {GROUPS.map((g) => (
        <div key={g.name} className={styles.group}>
          <span className={styles.groupLabel}>{g.name}</span>
          {g.chips.map((c) => (
            <button
              key={c.label}
              type="button"
              className={styles.chip}
              // pointerdown+preventDefault keeps the textarea selection intact
              // so the insert lands at the caret, not at position 0 after blur.
              onPointerDown={(e) => {
                e.preventDefault()
                onInsert(c.insert, c.caret)
              }}
              aria-label={c.label}
            >
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2** — Create `BasicFunctionBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.groupLabel {
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
  margin-right: 2px;
  white-space: nowrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text);
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-sm);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--t-fast), border-color var(--t-fast);
}

.chip:hover {
  background: var(--c-surface-tint);
  border-color: var(--c-border-strong);
}

.chip:active {
  background: var(--c-primary-soft);
}
```

If `--font-mono` doesn't exist as a token, the `monospace` fallback applies — acceptable. (Verify during implementation; if a mono token exists in `tokens.css`, use it.)

- [ ] **Step 3** — Gates: `npx tsc -b --noEmit`, `npx eslint src/features/calc/modes/BasicFunctionBar.tsx`.

- [ ] **Step 4** — Commit: `feat(calc): BasicFunctionBar palette component`.

---

## Task 3: Wire the palette + caret-offset insert into BasicMode

**Files:** Modify `src/features/calc/modes/BasicMode.tsx`

**Consumes:** `BasicFunctionBar` (Task 2).

- [ ] **Step 1** — Import: add `import BasicFunctionBar from './BasicFunctionBar'` near the other imports.

- [ ] **Step 2** — Extend `insertAtCursor` to accept a caret offset (default end):

```ts
  const insertAtCursor = (text: string, caretOffset?: number) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart ?? body.length
    const end = ta.selectionEnd ?? body.length
    const next = body.slice(0, start) + text + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + (caretOffset ?? text.length)
      ta.setSelectionRange(pos, pos)
    })
  }
```

(The existing rail `onInsert={insertAtCursor}` call passes `String(line.value)` with no offset — still valid since `caretOffset` is optional.)

- [ ] **Step 3** — Render the bar between the toolbar `</div>` and the `<div className={styles.scratchpad}>`:

```tsx
      <BasicFunctionBar onInsert={insertAtCursor} />
```

- [ ] **Step 4** — Update the summary hint to mention chaining. Replace the `copyHint` span text:

```tsx
        <span className={styles.copyHint}>
          연산자로 시작하면 이전 결과에 이어집니다 · 결과를 클릭하면 삽입돼요
        </span>
```

- [ ] **Step 5** — Gates: `npx tsc -b --noEmit`, `npx eslint src/features/calc/`, `npm run build` (all PASS).

- [ ] **Step 6** — Manual (owed by user): chain with leading operators + `ans`; tap chips (caret inside parens); mobile bar scrolls.

- [ ] **Step 7** — Commit: `feat(calc): wire function palette + caret-offset insert into BasicMode`.

---

## Self-Review

- **Spec coverage:** Feature 1 (ans + leading-op) → Task 1 ✓; Feature 2 palette → Tasks 2+3 ✓; caret-inside-parens → Task 3 Step 2 + Task 2 caret values ✓; hint update → Task 3 Step 4 ✓; `%` omitted ✓; BASIC-only, no other-mode changes ✓.
- **Placeholder scan:** none (the `--font-mono` note is a verify-and-use instruction, with a working fallback).
- **Type consistency:** `onInsert(text, caretOffset?)` signature matches between `BasicFunctionBar` props (Task 2) and `insertAtCursor` (Task 3). `computeBasic` output shape unchanged (Task 1 only changes internals).
