import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RenderEditCellProps } from 'react-data-grid'
import type { SheetRow } from '../types'
import {
  getAutocompleteContext,
  isFormulaCell,
  matchFunctions,
  type AutocompleteContext,
  type FunctionMeta,
} from '../shared/formula'
import SheetFunctionAutocomplete from './SheetFunctionAutocomplete'
import styles from './SheetCellEditor.module.css'

type GridRow = SheetRow & { _idx?: number | string }

export type DraftFormula = {
  colIdx: number
  rowIdx: number
  text: string
}

/**
 * Imperative handle exposed to the grid so it can drive the formula
 * editor without lifting all of its state up. The grid stashes this in
 * a ref and consults it on mousedown when the user is mid-formula:
 *
 *   isPickReady()    → true when the cursor is in a spot that can
 *                       accept a cell ref (right after `=`, `(`, `,`,
 *                       or an arithmetic operator).
 *   insertRef(text)  → inserts at the current cursor position, leaves
 *                       focus + a fresh insertion point behind.
 *   replaceLastRef(text) → replaces the most recent ref/range token
 *                       (used during drag to grow `H34` into `H34:H36`).
 */
export type EditorApi = {
  isPickReady: () => boolean
  insertRef: (text: string) => void
  replaceLastRef: (text: string) => void
}

type Props = RenderEditCellProps<GridRow> & {
  columnKey: string
  colIdx: number
  onDraftChange: (draft: DraftFormula | null) => void
  /** Wired by the grid: receives the editor's imperative API on
   *  mount, gets `null` on unmount. */
  onEditorApi?: (api: EditorApi | null) => void
}

/**
 * Custom edit cell that reports its current text upward on every
 * keystroke, so the grid can paint formula-precedent highlights *while
 * the user is typing*, not only after Enter. Behaves like the default
 * text editor otherwise: Enter / blur commits, Escape aborts.
 *
 * The draft is broadcast through a callback (held at the grid level
 * via useCallback) rather than via React Context so the edit cell
 * stays a tiny leaf — rdg mounts and unmounts it sharply, and the
 * cleanup naturally clears the draft on commit/abort.
 */
/** Chars that can precede a cell ref in pick mode. After typing any
 *  of these (or at the very start after `=`), clicking a cell should
 *  insert its address. `:` extends a range; `=` covers `=A1`-style. */
const REF_TRIGGERS = new Set(['=', '(', ',', '+', '-', '*', '/', ':', ' '])

export default function SheetCellEditor({
  row,
  column,
  columnKey,
  colIdx,
  rowIdx,
  onRowChange,
  onClose,
  onDraftChange,
  onEditorApi,
}: Props) {
  const initial = String(row[columnKey] ?? '')
  const [text, setText] = useState(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const committedRef = useRef(false)
  // Cursor offsets we maintain ourselves — onChange clobbers
  // selectionStart, and the grid's pick-mode inserts run *outside*
  // the input's onChange path. We rewrite the input value imperatively
  // and restore the selection from these.
  const textRef = useRef(initial)
  const selRef = useRef<{ start: number; end: number }>({ start: 0, end: initial.length })
  // Tracks the [start, end] of the most-recently-inserted ref so a
  // drag can grow it from `H34` into `H34:H36` by overwriting the
  // same slice.
  const lastRefRangeRef = useRef<{ start: number; end: number } | null>(null)

  // Push the initial draft as soon as we mount so the very first paint
  // already highlights any precedents. Cleanup pushes `null` so the
  // grid drops the draft on commit / Escape / unmount — without this
  // the highlights would linger after the editor closes.
  useEffect(() => {
    onDraftChange({ colIdx, rowIdx, text: initial })
    return () => onDraftChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Focus + select-all on open so the typical "type to overwrite"
  // pattern works the way it does in the default text editor.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
    selRef.current = { start: 0, end: initial.length }
  }, [])

  /** Apply a new text + selection synchronously. Used by both the
   *  controlled onChange path and the grid's pick-mode inserts. */
  const applyText = (next: string, selStart: number, selEnd: number) => {
    textRef.current = next
    selRef.current = { start: selStart, end: selEnd }
    setText(next)
    onDraftChange({ colIdx, rowIdx, text: next })
    // Schedule the selection restore — React will re-render with the
    // new value first; we set the caret immediately after.
    queueMicrotask(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(selStart, selEnd)
    })
  }

  const handleChange = (v: string) => {
    const el = inputRef.current
    const caret = el?.selectionStart ?? v.length
    textRef.current = v
    selRef.current = { start: caret, end: caret }
    // Manual typing clears any "we just inserted this ref" memory —
    // a drag immediately after would otherwise overwrite the user's
    // hand-typed text.
    lastRefRangeRef.current = null
    setText(v)
    onDraftChange({ colIdx, rowIdx, text: v })
    refreshAutocomplete(v, caret)
  }

  /** True when the character immediately before the caret is a
   *  ref-trigger (operator / `(` / `,` / `:` / start of formula). */
  const isPickReady = (): boolean => {
    const t = textRef.current
    if (!isFormulaCell(t)) return false
    const caret = selRef.current.start
    if (caret <= 0) return false
    if (caret === 1 && t.startsWith('=')) return true
    const prev = t[caret - 1]
    return REF_TRIGGERS.has(prev)
  }

  /** Insert `ref` at the current caret. Records the inserted slice so
   *  a subsequent drag can grow it into a range. Keeps editor focus. */
  const insertRef = (ref: string) => {
    const t = textRef.current
    const { start, end } = selRef.current
    const next = t.slice(0, start) + ref + t.slice(end)
    const after = start + ref.length
    lastRefRangeRef.current = { start, end: after }
    applyText(next, after, after)
  }

  /** Replace the most-recently-inserted ref with a new one (used
   *  while dragging to extend a single cell into a range). */
  const replaceLastRef = (ref: string) => {
    const range = lastRefRangeRef.current
    if (!range) return insertRef(ref)
    const t = textRef.current
    const next = t.slice(0, range.start) + ref + t.slice(range.end)
    const after = range.start + ref.length
    lastRefRangeRef.current = { start: range.start, end: after }
    applyText(next, after, after)
  }

  // Publish the editor handle to the grid. The grid stores it in a
  // ref and consults it on mousedown to decide whether to enter
  // pick mode.
  useEffect(() => {
    if (!onEditorApi) return
    onEditorApi({ isPickReady, insertRef, replaceLastRef })
    return () => onEditorApi(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEditorApi])

  // Function autocomplete — appears as soon as the user types `=`, and
  // narrows as they keep typing a function name. Owned by the editor
  // so the picker is naturally tied to one cell's edit session.
  const [autocomplete, setAutocomplete] =
    useState<{ ctx: AutocompleteContext; matches: FunctionMeta[] } | null>(null)
  const [autocompleteIdx, setAutocompleteIdx] = useState(0)
  // Track the last query the popup was synced to. Arrow-key navigation
  // also fires the input's onKeyUp → handleSelect → refreshAutocomplete;
  // resetting the index every time would make ↓ snap back to 0. Only
  // reset when the query *actually* changes (user typed/deleted).
  const lastAutocompleteQueryRef = useRef<string | null>(null)

  const refreshAutocomplete = (newText: string, newCaret: number) => {
    const ctx = getAutocompleteContext(newText, newCaret)
    if (!ctx) {
      lastAutocompleteQueryRef.current = null
      setAutocomplete(null)
      return
    }
    const matches = matchFunctions(ctx.query)
    if (matches.length === 0) {
      lastAutocompleteQueryRef.current = null
      setAutocomplete(null)
      return
    }
    if (lastAutocompleteQueryRef.current !== ctx.query) {
      setAutocompleteIdx(0)
      lastAutocompleteQueryRef.current = ctx.query
    }
    setAutocomplete({ ctx, matches })
  }

  const pickFunction = (fn: FunctionMeta) => {
    const ctx = autocomplete?.ctx
    if (!ctx) return
    const t = textRef.current
    const next = t.slice(0, ctx.start) + fn.name + '(' + t.slice(ctx.end)
    const caret = ctx.start + fn.name.length + 1
    setAutocomplete(null)
    // Use applyText to keep the controlled state, caret restore, and
    // draft broadcast all in sync.
    applyText(next, caret, caret)
  }

  // Track caret position so isPickReady knows where we are.
  const handleSelect = () => {
    const el = inputRef.current
    if (!el) return
    selRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
    refreshAutocomplete(textRef.current, selRef.current.start)
  }

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    onRowChange({ ...row, [columnKey]: text }, true)
  }

  const abort = () => {
    if (committedRef.current) return
    committedRef.current = true
    onClose(false, true)
  }

  // Mirror the default editor's "blur commits" behavior. Rdg also
  // calls onClose on outside click; either way we land in a committed
  // state. The `committedRef` guard prevents double-commit when both
  // blur and onClose fire in quick succession.
  const handleBlur = () => commit()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Autocomplete owns these keys when its popup is open.
    if (autocomplete && autocomplete.matches.length > 0) {
      const count = autocomplete.matches.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIdx((i) => (i + 1) % count)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIdx((i) => (i - 1 + count) % count)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const pick = autocomplete.matches[Math.min(autocompleteIdx, count - 1)]
        if (pick) pickFunction(pick)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAutocomplete(null)
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      abort()
    } else if (e.key === 'Tab') {
      // Let rdg handle Tab navigation (it commits + moves), but make
      // sure our commit fires first so the new value is persisted.
      commit()
    }
  }

  // Reference `column` so eslint-no-unused-vars stays quiet; rdg passes
  // it but we don't need its shape for editing.
  void column

  const isFormula = isFormulaCell(text)

  return (
    <>
      <input
        ref={inputRef}
        className={`${styles.input} ${isFormula ? styles.formulaInput : ''}`}
        type="text"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        onClick={handleSelect}
      />
      {autocomplete && (
        <SheetFunctionAutocomplete
          anchor={inputRef.current}
          matches={autocomplete.matches}
          activeIndex={autocompleteIdx}
          onHover={setAutocompleteIdx}
          onPick={pickFunction}
        />
      )}
    </>
  )
}
