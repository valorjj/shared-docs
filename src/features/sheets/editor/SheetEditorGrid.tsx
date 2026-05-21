import { useMemo, useState } from 'react'
import {
  DataGrid,
  renderTextEditor,
  type Column,
  type RenderCellProps,
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
import SheetStatusBar from './SheetStatusBar'
import SheetHeaderMenu from './SheetHeaderMenu'
import SheetColumnRenameDialog from './SheetColumnRenameDialog'
import styles from './SheetEditorGrid.module.css'

type Props = {
  data: SheetData
  onChange: (next: SheetData) => void
}

type GridRow = SheetRow & { _idx?: number | string }

const ROW_HEIGHT = 34
const HEADER_HEIGHT = 36
const MIN_COL_WIDTH = 80

export default function SheetEditorGrid({ data, onChange }: Props) {
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

  // Per-render formula resolver. Memoized inside on the (column, row)
  // coordinate so a chained ref (A1=B1+1, B1=C1*2) evaluates in linear
  // time. Cycles surface as #CYCLE without infinite recursion.
  const resolver = useMemo<FormulaResolver>(() => buildFormulaResolver(data), [data])

  // Precedent-highlight map: when the focused cell is a formula, paint
  // its referenced cells with cycling colors (Excel-style). The map is
  // keyed `colIdx:rowIdx → refIndex` so the column's cellClass can
  // cheaply look up whether to add a highlight.
  const highlightMap = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>()
    if (focusedKey == null || focusedRowIdx == null) return out
    const colIdx = data.columns.findIndex((c) => c.key === focusedKey)
    if (colIdx < 0) return out
    const raw = String(data.rows[focusedRowIdx]?.[focusedKey] ?? '')
    if (!isFormulaCell(raw)) return out
    for (const ref of extractRefs(raw)) {
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
  }, [focusedKey, focusedRowIdx, data])

  const columns = useMemo<Column<GridRow>[]>(() => {
    const rightAlign = (kind: SheetColumnKind | undefined) =>
      isRightAligned(kind) ? styles.cellRight : ''
    return data.columns.map((col, idx) => ({
      key: col.key,
      name: col.name,
      width: col.width ?? 160,
      minWidth: MIN_COL_WIDTH,
      resizable: true,
      editable: true,
      // Freeze the first column so it stays visible while scrolling
      // wide sheets. Common spreadsheet ergonomic — labels stay anchored.
      frozen: idx === 0,
      cellClass: (row: GridRow) => {
        const ridx = Number(row._idx)
        const refIdx = highlightMap.get(`${idx}:${ridx}`)
        const align = rightAlign(col.kind)
        if (refIdx == null) return align || undefined
        return `${align} ${styles[`refColor${refIdx % 4}` as 'refColor0']}`.trim()
      },
      renderEditCell: renderTextEditor,
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
  }, [data.columns, resolver, highlightMap]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRowsChange(next: GridRow[]) {
    onChange({
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
    onChange({ columns: nextCols, rows: data.rows })
  }

  function renameColumn(key: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    onChange({
      columns: data.columns.map((c) => (c.key === key ? { ...c, name: trimmed } : c)),
      rows: data.rows,
    })
  }

  function setColumnKind(key: string, kind: SheetColumnKind) {
    onChange({
      columns: data.columns.map((c) => (c.key === key ? { ...c, kind } : c)),
      rows: data.rows,
    })
  }

  function deleteColumn(key: string) {
    if (!window.confirm(`이 열을 삭제할까요?`)) return
    onChange({
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
      {headerMenuColumn && headerMenu && (
        <SheetHeaderMenu
          column={headerMenuColumn}
          position={{ x: headerMenu.x, y: headerMenu.y }}
          onClose={() => setHeaderMenu(null)}
          onRequestRename={() => setRenamingKey(headerMenuColumn.key)}
          onSetKind={(kind) => setColumnKind(headerMenuColumn.key, kind)}
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
