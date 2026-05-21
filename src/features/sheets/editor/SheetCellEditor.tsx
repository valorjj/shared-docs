import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RenderEditCellProps } from 'react-data-grid'
import type { SheetRow } from '../types'
import { isFormulaCell } from '../shared/formula'
import styles from './SheetCellEditor.module.css'

type GridRow = SheetRow & { _idx?: number | string }

export type DraftFormula = {
  colIdx: number
  rowIdx: number
  text: string
}

type Props = RenderEditCellProps<GridRow> & {
  columnKey: string
  colIdx: number
  onDraftChange: (draft: DraftFormula | null) => void
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
export default function SheetCellEditor({
  row,
  column,
  columnKey,
  colIdx,
  rowIdx,
  onRowChange,
  onClose,
  onDraftChange,
}: Props) {
  const initial = String(row[columnKey] ?? '')
  const [text, setText] = useState(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const committedRef = useRef(false)

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
  }, [])

  const handleChange = (v: string) => {
    setText(v)
    onDraftChange({ colIdx, rowIdx, text: v })
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
    <input
      ref={inputRef}
      className={`${styles.input} ${isFormula ? styles.formulaInput : ''}`}
      type="text"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
