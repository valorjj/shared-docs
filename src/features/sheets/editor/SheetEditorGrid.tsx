import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DataGrid,
  type Column,
  type RenderCellProps,
  type RenderEditCellProps,
  type RenderHeaderCellProps,
} from 'react-data-grid'
import { X } from 'lucide-react'
import 'react-data-grid/lib/styles.css'
import type { SheetColumn, SheetColumnKind, SheetData, SheetRow } from '../types'
import {
  formatCellDisplay,
  isRightAligned,
} from '../shared/sheetData'
import {
  buildFormulaResolver,
  evaluateForDisplay,
  extractRefs,
  isFormulaCell,
  type FormulaResolver,
} from '../shared/formula'
import { makeEmptyRow, parseCellNumber, toExcelLabel } from '../shared/sheetData'
import SheetStatusBar from './SheetStatusBar'
import SheetHeaderMenu from './SheetHeaderMenu'
import SheetColumnRenameDialog from './SheetColumnRenameDialog'
import SheetCellEditor, { type DraftFormula, type EditorApi } from './SheetCellEditor'
import styles from './SheetEditorGrid.module.css'

type Props = {
  data: SheetData
  /** Undefined when the caller is in read-only mode (VIEW recipient).
   *  Every column then renders with `editable: false` and the grid's
   *  onRowsChange callback is a no-op. */
  onChange?: (next: SheetData) => void
  readOnly?: boolean
}

type GridRow = SheetRow & { _idx?: number | string }

const ROW_HEIGHT = 34
const HEADER_HEIGHT = 36
const MIN_COL_WIDTH = 80

export default function SheetEditorGrid({ data, onChange, readOnly = false }: Props) {
  // Safe wrapper — when onChange is omitted (VIEW recipient), every
  // caller below funnels into this no-op so we don't need a tree of
  // `onChange?.(…)` guards. Cells are also marked non-editable via
  // the `editable` flag we inject on each column below.
  const emitChange = onChange ?? (() => {})
  const gridRows = useMemo<GridRow[]>(
    () => data.rows.map((r, i) => ({ ...r, _idx: String(i) })),
    [data.rows],
  )

  // Focused-cell column key feeds the status bar. Click any cell to
  // pin a column; selection persists until another column is clicked
  // or the sheet is replaced. Initial value is the first column so the
  // bar shows useful aggregates immediately.
  const [focusedKey, setFocusedKey] = useState<string | null>(
    data.columns[0]?.key ?? null,
  )
  // Row index of the focused cell. Combined with `focusedKey` it lets
  // us check whether the focused cell is a formula and, if so, paint
  // its referenced cells. null until the user clicks something.
  const [focusedRowIdx, setFocusedRowIdx] = useState<number | null>(null)

  // Right-click on header opens this menu (rename / kind / delete).
  // Anchor position is the cursor at the moment of the contextmenu event.
  const [headerMenu, setHeaderMenu] = useState<{
    columnKey: string
    x: number
    y: number
  } | null>(null)
  // Header rename dialog state. Open via dblclick-on-header or menu.
  const [renamingKey, setRenamingKey] = useState<string | null>(null)

  // Draft formula state: the live in-progress text in the active edit
  // cell. Feeds highlights *while typing*, not only on commit — so
  // refs in `=A1+B1` light up as you type, the spreadsheet way.
  const [draft, setDraft] = useState<DraftFormula | null>(null)
  const onDraftChange = useCallback((d: DraftFormula | null) => setDraft(d), [])

  // Drag-selection state for the floating sum/average bubble. We track
  // the anchor (mousedown cell) and focus (current mouseover cell)
  // separately so dragging upward / leftward still produces a
  // well-ordered range. `null` means no selection (single click only).
  const [selection, setSelection] = useState<{
    anchorCol: number; anchorRow: number;
    focusCol: number;  focusRow: number;
  } | null>(null)
  // Anchor refs for the document-level mousemove/mouseup listeners. We
  // re-read these inside the handlers without rebinding, which keeps
  // the drag cheap.
  const dragAnchorRef = useRef<{ col: number; row: number } | null>(null)
  // Pick-mode drag anchor: when the user is mid-formula and clicks/
  // drags on other cells, we insert refs into the editor instead of
  // running the visual drag-select. Tracked separately so the two
  // modes never tangle.
  const pickAnchorRef = useRef<{ col: number; row: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  // Imperative handle into the active cell editor (if any). The
  // editor publishes / withdraws this on mount / unmount.
  const editorApiRef = useRef<EditorApi | null>(null)
  const onEditorApi = useCallback((api: EditorApi | null) => {
    editorApiRef.current = api
  }, [])

  // Latest-value refs mirroring state + props. The wrapper-level
  // mouse / clipboard listeners attach once with `[]` deps and read
  // current values through these. (Re-attaching on every state change
  // would be wasteful and would also clobber rdg's window-listener
  // ordering we depend on.)
  const selectionRef = useRef(selection)
  useEffect(() => { selectionRef.current = selection }, [selection])
  const focusedKeyRef = useRef(focusedKey)
  useEffect(() => { focusedKeyRef.current = focusedKey }, [focusedKey])
  const focusedRowIdxRef = useRef(focusedRowIdx)
  useEffect(() => { focusedRowIdxRef.current = focusedRowIdx }, [focusedRowIdx])
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Drag handlers — installed on the wrapper. We listen for mousedown
  // on a cell, then watch window mousemove until mouseup. Cell coords
  // are read from rdg's `aria-colindex` / `aria-rowindex` attrs (it
  // sets them 1-based; we subtract one to get our 0-based indices).
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const cellFromPoint = (x: number, y: number): { col: number; row: number } | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      if (!el) return null
      const cell = el.closest('[role="gridcell"]') as HTMLElement | null
      if (!cell || !wrapper.contains(cell)) return null
      const rawCol = cell.getAttribute('aria-colindex')
      const rawRow = cell.parentElement?.getAttribute('aria-rowindex')
      if (rawCol == null || rawRow == null) return null
      // rdg counts the header row, so data rows start at 2. Our row
      // index space is 0-based: subtract the header offset (1) and
      // the 1-based aria index (1) → -2.
      return { col: Number(rawCol) - 1, row: Number(rawRow) - 2 }
    }

    const refFor = (col: number, row: number) => `${toExcelLabel(col)}${row + 1}`

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      // The active formula editor is itself an <input>; clicking it
      // should do normal text-input things, not enter pick mode.
      if (target.closest('input, textarea, select')) return
      // Skip header clicks — they have their own context menu.
      if (target.closest('[role="columnheader"]')) return

      const c = cellFromPoint(e.clientX, e.clientY)
      if (!c) return

      // ── Pick mode ──────────────────────────────────────────────────
      // When the editor is open and its caret is positioned right
      // after `=`, `(`, `,`, or an operator, clicks on other cells
      // insert the clicked cell's address into the formula text
      // instead of focusing the cell. preventDefault on mousedown
      // keeps the editor input focused (mousedown's default action
      // is focus shift); without it, the input blurs → rdg commits
      // the edit early.
      const api = editorApiRef.current
      if (api && api.isPickReady()) {
        e.preventDefault()
        e.stopPropagation()
        api.insertRef(refFor(c.col, c.row))
        pickAnchorRef.current = c
        return
      }

      // ── Normal drag-select ────────────────────────────────────────
      dragAnchorRef.current = c
      // Don't open a selection yet — single click is just a focus.
      // Real selection blooms once the mouse moves into a *different* cell.
    }

    const onMouseMove = (e: MouseEvent) => {
      // Pick-mode drag: extend the most-recently-inserted ref into a
      // range as the mouse moves over more cells. The editor's
      // `replaceLastRef` rewrites the same slice each tick, so the
      // formula text grows from `A1` to `A1:B5` without piling up.
      const pickAnchor = pickAnchorRef.current
      const api = editorApiRef.current
      if (pickAnchor && api) {
        const c = cellFromPoint(e.clientX, e.clientY)
        if (!c) return
        const sameCell = c.col === pickAnchor.col && c.row === pickAnchor.row
        const text = sameCell
          ? refFor(pickAnchor.col, pickAnchor.row)
          : `${refFor(pickAnchor.col, pickAnchor.row)}:${refFor(c.col, c.row)}`
        api.replaceLastRef(text)
        return
      }

      // Plain drag-select.
      const anchor = dragAnchorRef.current
      if (!anchor) return
      const c = cellFromPoint(e.clientX, e.clientY)
      if (!c) return
      if (c.col === anchor.col && c.row === anchor.row) {
        setSelection(null)
        return
      }
      setSelection({
        anchorCol: anchor.col,
        anchorRow: anchor.row,
        focusCol: c.col,
        focusRow: c.row,
      })
    }

    const onMouseUp = () => {
      dragAnchorRef.current = null
      pickAnchorRef.current = null
    }

    // ── Copy: serialize the selected range to TSV (tab between cells,
    // newline between rows) so Excel / Sheets / plain text editors all
    // accept it. We only intercept when the user has a real multi-cell
    // selection going — single-cell click falls through to the
    // browser's default copy (copies the cell's display text). The
    // wrapper guard `target.closest('input')` lets the formula editor
    // keep its own clipboard behavior.
    const onCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea')) return
      const d = dataRef.current
      // Single-cell fallback: no drag selection, but a focused cell —
      // copy that one cell's raw text. Without this Cmd+C on a single
      // cell would silently do nothing (we disabled user-select on
      // cells, so the browser has no text selection to copy).
      let c0: number, c1: number, r0: number, r1: number
      const sel = selectionRef.current
      if (sel) {
        c0 = Math.min(sel.anchorCol, sel.focusCol)
        c1 = Math.max(sel.anchorCol, sel.focusCol)
        r0 = Math.min(sel.anchorRow, sel.focusRow)
        r1 = Math.max(sel.anchorRow, sel.focusRow)
      } else if (focusedKeyRef.current != null && focusedRowIdxRef.current != null) {
        const colIdx = d.columns.findIndex((c) => c.key === focusedKeyRef.current)
        if (colIdx < 0) return
        c0 = c1 = colIdx
        r0 = r1 = focusedRowIdxRef.current
      } else {
        return
      }
      const lines: string[] = []
      for (let r = r0; r <= r1; r++) {
        const row = d.rows[r] ?? {}
        const cells: string[] = []
        for (let c = c0; c <= c1; c++) {
          const col = d.columns[c]
          cells.push(col ? String(row[col.key] ?? '') : '')
        }
        lines.push(cells.join('\t'))
      }
      e.clipboardData?.setData('text/plain', lines.join('\n'))
      e.preventDefault()
    }

    // ── Paste: split TSV and write into the focused cell, expanding
    // rows if the paste runs off the bottom (columns are NOT auto-
    // grown — sheets typically have a fixed schema). Single-cell paste
    // is a normal text drop into one cell. Skips when target is an
    // input so the formula editor keeps default paste-into-text.
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea')) return
      if (focusedKeyRef.current == null || focusedRowIdxRef.current == null) return
      const text = e.clipboardData?.getData('text/plain')
      if (text == null) return
      const rows = text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'))
      // Empty trailing newline → drop a phantom empty row to avoid
      // overwriting the cell *after* the paste with "".
      if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
        rows.pop()
      }
      if (rows.length === 0) return
      const d = dataRef.current
      const startCol = d.columns.findIndex((c) => c.key === focusedKeyRef.current)
      if (startCol < 0) return
      const startRow = focusedRowIdxRef.current
      const nextRows: SheetRow[] = d.rows.map((r) => ({ ...r }))
      // Grow rows downward if needed.
      while (nextRows.length < startRow + rows.length) {
        nextRows.push(makeEmptyRow(d.columns))
      }
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const col = d.columns[startCol + c]
          if (!col) continue
          nextRows[startRow + r] = { ...nextRows[startRow + r], [col.key]: rows[r][c] }
        }
      }
      onChangeRef.current?.({ columns: d.columns, rows: nextRows })
      e.preventDefault()
    }

    // Capture phase so we win the race against rdg's React synthetic
    // mousedown handler. In pick mode we need to `preventDefault`
    // *before* the input loses focus, otherwise rdg commits the edit
    // and tears down the editor before we can insert anything.
    wrapper.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    wrapper.addEventListener('copy', onCopy)
    wrapper.addEventListener('paste', onPaste)
    return () => {
      wrapper.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      wrapper.removeEventListener('copy', onCopy)
      wrapper.removeEventListener('paste', onPaste)
    }
  }, [])

  // Per-render formula resolver. Memoized inside on the (column, row)
  // coordinate so a chained ref (A1=B1+1, B1=C1*2) evaluates in linear
  // time. Cycles surface as #CYCLE without infinite recursion.
  const resolver = useMemo<FormulaResolver>(() => buildFormulaResolver(data), [data])

  // Selected-cells map for cellClass lookup. Same `colIdx:rowIdx` key
  // shape as `highlightMap` so the two can coexist on a single cell.
  const selectionSet = useMemo<Set<string>>(() => {
    if (!selection) return new Set()
    const c0 = Math.min(selection.anchorCol, selection.focusCol)
    const c1 = Math.max(selection.anchorCol, selection.focusCol)
    const r0 = Math.min(selection.anchorRow, selection.focusRow)
    const r1 = Math.max(selection.anchorRow, selection.focusRow)
    const out = new Set<string>()
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) out.add(`${c}:${r}`)
    }
    return out
  }, [selection])

  // Sum / avg / count over numeric cells in the current selection.
  // Reuses the formula resolver so a selected formula cell contributes
  // its evaluated value, not the raw `=…` string.
  const selectionStats = useMemo(() => {
    if (!selection) return null
    const c0 = Math.min(selection.anchorCol, selection.focusCol)
    const c1 = Math.max(selection.anchorCol, selection.focusCol)
    const r0 = Math.min(selection.anchorRow, selection.focusRow)
    const r1 = Math.max(selection.anchorRow, selection.focusRow)
    let sum = 0
    let numericCount = 0
    let filledCount = 0
    let anyCurrency = false
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const col = data.columns[c]
        if (!col) continue
        const raw = String(data.rows[r]?.[col.key] ?? '')
        if (raw === '') continue
        filledCount++
        if (col.kind === 'currency') anyCurrency = true
        const evaluated = resolver(c, r)
        if (!evaluated.ok) continue
        const v = evaluated.value
        const n =
          typeof v === 'number' ? v :
          typeof v === 'string' ? parseCellNumber(v) :
          typeof v === 'boolean' ? (v ? 1 : 0) :
          null
        if (n != null) { sum += n; numericCount++ }
      }
    }
    return {
      sum,
      avg: numericCount > 0 ? sum / numericCount : null,
      numericCount,
      filledCount,
      isCurrency: anyCurrency,
      // Bottom-right corner of the selection — used to anchor the bubble.
      anchorCol: c1,
      anchorRow: r1,
    }
  }, [selection, data, resolver])

  // Precedent-highlight map: when the focused cell is a formula
  // (committed) OR the user is actively typing one, paint its
  // referenced cells with cycling colors (Excel-style). The map is
  // keyed `colIdx:rowIdx → refIndex` so the column's cellClass can
  // cheaply look up whether to add a highlight.
  //
  // Source of truth: prefer the live `draft` (mid-edit text), fall
  // back to the committed cell value. The mid-edit path is what makes
  // refs light up *as you type* `=A1+B1`, not only after Enter.
  const highlightMap = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>()
    let source: string | null = null
    if (draft && isFormulaCell(draft.text)) {
      source = draft.text
    } else if (focusedKey != null && focusedRowIdx != null) {
      const raw = String(data.rows[focusedRowIdx]?.[focusedKey] ?? '')
      if (isFormulaCell(raw)) source = raw
    }
    if (!source) return out
    for (const ref of extractRefs(source)) {
      if (ref.kind === 'cell') {
        out.set(`${ref.col}:${ref.row}`, ref.refIndex)
      } else {
        for (let r = ref.fromRow; r <= ref.toRow; r++) {
          for (let c = ref.fromCol; c <= ref.toCol; c++) {
            out.set(`${c}:${r}`, ref.refIndex)
          }
        }
      }
    }
    return out
  }, [draft, focusedKey, focusedRowIdx, data])

  const columns = useMemo<Column<GridRow>[]>(() => {
    const rightAlign = (kind: SheetColumnKind | undefined) =>
      isRightAligned(kind) ? styles.cellRight : ''
    return data.columns.map((col, idx) => ({
      key: col.key,
      name: col.name,
      width: col.width ?? 160,
      minWidth: MIN_COL_WIDTH,
      resizable: true,
      // VIEW recipients see the grid but cells don't enter edit mode
      // on click. Combined with emitChange being a no-op, every edit
      // path is closed at the react-data-grid layer.
      editable: !readOnly,
      // Freeze the first column so it stays visible while scrolling
      // wide sheets. Common spreadsheet ergonomic — labels stay anchored.
      frozen: idx === 0,
      // Turn off rdg's window-level commit-on-outside-click — it
       // schedules a commit via `scheduler.postTask` *before* any of
      // our capture-phase listeners run, which makes pick-mode
      // impossible (the editor tears down before we can insert the
      // ref). Our SheetCellEditor commits on its own blur, so this
      // does NOT lose the "click outside to save" behavior.
      editorOptions: { commitOnOutsideClick: false },
      cellClass: (row: GridRow) => {
        const ridx = Number(row._idx)
        const key = `${idx}:${ridx}`
        const refIdx = highlightMap.get(key)
        const inSelection = selectionSet.has(key)
        const parts = [rightAlign(col.kind)]
        if (refIdx != null) parts.push(styles[`refColor${refIdx % 4}` as 'refColor0'])
        if (inSelection) parts.push(styles.selectedCell)
        const cls = parts.filter(Boolean).join(' ').trim()
        return cls || undefined
      },
      renderEditCell: (p: RenderEditCellProps<GridRow>) => (
        <SheetCellEditor
          {...p}
          columnKey={col.key}
          colIdx={idx}
          onDraftChange={onDraftChange}
          onEditorApi={onEditorApi}
        />
      ),
      renderCell: (p: RenderCellProps<GridRow>) => (
        <DisplayCell
          raw={String(p.row[col.key] ?? '')}
          kind={col.kind}
          resolver={resolver}
        />
      ),
      renderHeaderCell: (p: RenderHeaderCellProps<GridRow>) => (
        <HeaderCell
          column={col}
          rdgColumn={p.column}
          onRename={() => setRenamingKey(col.key)}
          onDelete={() => deleteColumn(col.key)}
          onContextMenu={(x, y) => setHeaderMenu({ columnKey: col.key, x, y })}
        />
      ),
    }))
  }, [data.columns, resolver, highlightMap, selectionSet, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRowsChange(next: GridRow[]) {
    emitChange({
      columns: data.columns,
      rows: next.map((r) => {
        const { _idx: _ignored, ...rest } = r
        void _ignored
        return rest as SheetRow
      }),
    })
  }

  function handleColumnResize(column: { key: string }, width: number) {
    const nextCols: SheetColumn[] = data.columns.map((c) =>
      c.key === column.key ? { ...c, width: Math.round(width) } : c,
    )
    emitChange({ columns: nextCols, rows: data.rows })
  }

  function renameColumn(key: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    emitChange({
      columns: data.columns.map((c) => (c.key === key ? { ...c, name: trimmed } : c)),
      rows: data.rows,
    })
  }

  function setColumnKind(key: string, kind: SheetColumnKind) {
    emitChange({
      columns: data.columns.map((c) => (c.key === key ? { ...c, kind } : c)),
      rows: data.rows,
    })
  }

  function sortByColumn(key: string, direction: 'asc' | 'desc') {
    const colIdx = data.columns.findIndex((c) => c.key === key)
    if (colIdx < 0) return
    const kind = data.columns[colIdx].kind
    // Sort by *evaluated* values so a formula cell ranks by its
    // computed result, not the literal `=A1+B1` string. The resolver
    // we already build per render does this work for free.
    type Ranked = { row: SheetRow; sortKey: number | string | boolean | null }
    const ranked: Ranked[] = data.rows.map((row, idx) => {
      const evaluated = resolver(colIdx, idx)
      const v = evaluated.ok ? evaluated.value : ''
      return { row, sortKey: Array.isArray(v) ? '' : v }
    })
    ranked.sort((a, b) => {
      // Blanks always sink to the bottom, even on descending sort —
      // matches Excel / Sheets. Caller-supplied direction only flips
      // the *non-blank* comparison.
      const aBlank = a.sortKey == null || a.sortKey === ''
      const bBlank = b.sortKey == null || b.sortKey === ''
      if (aBlank && bBlank) return 0
      if (aBlank) return 1
      if (bBlank) return -1
      const cmp = compareSortKeys(a.sortKey, b.sortKey, kind)
      return direction === 'asc' ? cmp : -cmp
    })
    emitChange({ columns: data.columns, rows: ranked.map((r) => r.row) })
  }

  function deleteColumn(key: string) {
    if (!window.confirm(`이 열을 삭제할까요?`)) return
    emitChange({
      columns: data.columns.filter((c) => c.key !== key),
      rows: data.rows.map((r) => {
        const { [key]: _removed, ...rest } = r
        void _removed
        return rest
      }),
    })
  }

  const headerMenuColumn = useMemo(
    () => (headerMenu ? data.columns.find((c) => c.key === headerMenu.columnKey) ?? null : null),
    [headerMenu, data.columns],
  )

  return (
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      // Suppress the browser's default right-click menu everywhere
      // inside the grid. Header cells stop propagation in their own
      // handler and open the custom column menu; everywhere else just
      // gets quiet (we may grow a cell-level menu later).
      onContextMenu={(e) => e.preventDefault()}
    >
      <DataGrid<GridRow>
        className={`rdg-light ${styles.grid}`}
        columns={columns}
        rows={gridRows}
        onRowsChange={handleRowsChange}
        onColumnResize={handleColumnResize}
        onSelectedCellChange={({ column, rowIdx }) => {
          // `SelectColumn` (none here) or padding cells may yield a key
          // we don't know — fall back gracefully so the bar doesn't
          // freeze on a stale column.
          const k = column?.key
          if (k && data.columns.some((c) => c.key === k)) {
            setFocusedKey(k)
            setFocusedRowIdx(rowIdx)
          }
        }}
        rowKeyGetter={(r) => String(r._idx)}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={HEADER_HEIGHT}
        defaultColumnOptions={{ resizable: true }}
      />
      <SheetStatusBar data={data} focusedColumnKey={focusedKey} resolver={resolver} />
      {selectionStats && selectionStats.filledCount > 0 && (
        <SelectionAggregateBubble
          wrapperRef={wrapperRef}
          stats={selectionStats}
        />
      )}
      {headerMenuColumn && headerMenu && (
        <SheetHeaderMenu
          column={headerMenuColumn}
          position={{ x: headerMenu.x, y: headerMenu.y }}
          onClose={() => setHeaderMenu(null)}
          onRequestRename={() => setRenamingKey(headerMenuColumn.key)}
          onSetKind={(kind) => setColumnKind(headerMenuColumn.key, kind)}
          onSort={(dir) => sortByColumn(headerMenuColumn.key, dir)}
          onDelete={() => deleteColumn(headerMenuColumn.key)}
        />
      )}
      {renamingKey != null && (
        <SheetColumnRenameDialog
          open
          currentName={data.columns.find((c) => c.key === renamingKey)?.name ?? ''}
          onSubmit={(name) => renameColumn(renamingKey, name)}
          onClose={() => setRenamingKey(null)}
        />
      )}
    </div>
  )
}

const KRW_FMT = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

/**
 * Compare two non-blank evaluated cell values. Caller deals with
 * blanks separately so direction can flip the result safely.
 * Numeric kinds force a numeric compare even if cells happen to hold
 * strings; other kinds fall back to locale string compare.
 */
function compareSortKeys(
  a: number | string | boolean | null,
  b: number | string | boolean | null,
  kind: SheetColumnKind | undefined,
): number {
  const tryNum = (v: number | string | boolean | null): number | null => {
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'string') return parseCellNumber(v)
    return null
  }

  const numericKind = kind === 'number' || kind === 'currency'
  if (numericKind) {
    const an = tryNum(a) ?? Number.POSITIVE_INFINITY
    const bn = tryNum(b) ?? Number.POSITIVE_INFINITY
    return an < bn ? -1 : an > bn ? 1 : 0
  }

  const an = tryNum(a)
  const bn = tryNum(b)
  if (an != null && bn != null) {
    return an < bn ? -1 : an > bn ? 1 : 0
  }
  return String(a).localeCompare(String(b), 'ko')
}

function SelectionAggregateBubble({
  wrapperRef,
  stats,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>
  stats: {
    sum: number
    avg: number | null
    numericCount: number
    filledCount: number
    isCurrency: boolean
    anchorCol: number
    anchorRow: number
  }
}) {
  // Position the bubble at the bottom-right of the selection range.
  // The anchor cell's bounding rect is sourced from rdg's DOM via
  // aria-* attrs — wrapping it in a state lets us reposition on
  // scroll / window resize / cell width change. Falls back to a
  // bottom-right corner anchor if the cell can't be found.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const update = () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return setPos(null)
      const cell = wrapper.querySelector<HTMLElement>(
        `[aria-rowindex="${stats.anchorRow + 2}"] > [aria-colindex="${stats.anchorCol + 1}"]`,
      )
      const wrapperRect = wrapper.getBoundingClientRect()
      if (!cell) {
        setPos({
          left: wrapperRect.width - 16,
          top: wrapperRect.height - 60,
        })
        return
      }
      const r = cell.getBoundingClientRect()
      setPos({
        left: r.right - wrapperRect.left,
        top: r.bottom - wrapperRect.top,
      })
    }
    update()
    window.addEventListener('resize', update)
    const wrapper = wrapperRef.current
    wrapper?.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      wrapper?.removeEventListener('scroll', update, true)
    }
  }, [stats.anchorCol, stats.anchorRow, wrapperRef])

  if (!pos) return null

  const fmt = (n: number) => (stats.isCurrency ? `₩${KRW_FMT.format(n)}` : KRW_FMT.format(n))

  return (
    <div
      className={styles.selectionBubble}
      style={{ left: pos.left, top: pos.top }}
      role="status"
      aria-label="선택 영역 집계"
    >
      <span className={styles.bubbleMetric}>
        <span className={styles.bubbleLabel}>합</span>
        <span className={styles.bubbleValue}>{fmt(stats.sum)}</span>
      </span>
      {stats.avg != null && (
        <span className={styles.bubbleMetric}>
          <span className={styles.bubbleLabel}>평균</span>
          <span className={styles.bubbleValue}>{fmt(stats.avg)}</span>
        </span>
      )}
      <span className={styles.bubbleMetric}>
        <span className={styles.bubbleLabel}>개수</span>
        <span className={styles.bubbleValue}>{stats.filledCount}</span>
      </span>
    </div>
  )
}

function DisplayCell({
  raw,
  kind,
  resolver,
}: {
  raw: string
  kind: SheetColumnKind | undefined
  resolver: FormulaResolver
}) {
  // Evaluate formulas (`=A1+B1`) before formatting. Errors render as
  // their code (`#REF`, `#CYCLE`, …) — short enough that they don't
  // wreck the column width. Edit mode bypasses this entirely via
  // `renderEditCell`, so the user always edits the literal `=…` string.
  if (isFormulaCell(raw)) {
    const result = evaluateForDisplay(raw, resolver)
    if (typeof result === 'number') {
      return <>{formatCellDisplay(String(result), kind)}</>
    }
    return <>{String(result)}</>
  }
  return <>{formatCellDisplay(raw, kind)}</>
}

type HeaderCellProps = {
  column: SheetColumn
  rdgColumn: { name: React.ReactNode }
  onRename: () => void
  onDelete: () => void
  onContextMenu: (x: number, y: number) => void
}

function HeaderCell({ column, onRename, onDelete, onContextMenu }: HeaderCellProps) {
  return (
    <div
      className={styles.header}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onRename()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContextMenu(e.clientX, e.clientY)
      }}
      title="더블클릭으로 이름 변경 · 우클릭으로 종류 설정"
    >
      <span className={styles.headerName}>{column.name}</span>
      <button
        type="button"
        className={styles.headerDel}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        aria-label={`${column.name} 열 삭제`}
        title="열 삭제"
      >
        <X size={12} strokeWidth={2.25} />
      </button>
    </div>
  )
}
