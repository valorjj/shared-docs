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
  isFormulaCell,
  type FormulaResolver,
} from '../shared/formula'
import SheetStatusBar from './SheetStatusBar'
import SheetHeaderMenu from './SheetHeaderMenu'
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

  // Right-click on header opens this menu (rename / kind / delete).
  // Anchor position is the cursor at the moment of the contextmenu event.
  const [headerMenu, setHeaderMenu] = useState<{
    columnKey: string
    x: number
    y: number
  } | null>(null)

  // Per-render formula resolver. Memoized inside on the (column, row)
  // coordinate so a chained ref (A1=B1+1, B1=C1*2) evaluates in linear
  // time. Cycles surface as #CYCLE without infinite recursion.
  const resolver = useMemo<FormulaResolver>(() => buildFormulaResolver(data), [data])

  const columns = useMemo<Column<GridRow>[]>(() => {
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
      cellClass: isRightAligned(col.kind) ? styles.cellRight : undefined,
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
          onRename={(newName) => renameColumn(col.key, newName)}
          onDelete={() => deleteColumn(col.key)}
          onContextMenu={(x, y) => setHeaderMenu({ columnKey: col.key, x, y })}
        />
      ),
    }))
  }, [data.columns, resolver]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className={styles.wrapper}>
      <DataGrid<GridRow>
        className={`rdg-light ${styles.grid}`}
        columns={columns}
        rows={gridRows}
        onRowsChange={handleRowsChange}
        onColumnResize={handleColumnResize}
        onSelectedCellChange={({ column }) => {
          // `SelectColumn` (none here) or padding cells may yield a key
          // we don't know — fall back gracefully so the bar doesn't
          // freeze on a stale column.
          const k = column?.key
          if (k && data.columns.some((c) => c.key === k)) setFocusedKey(k)
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
          onRename={(name) => renameColumn(headerMenuColumn.key, name)}
          onSetKind={(kind) => setColumnKind(headerMenuColumn.key, kind)}
          onDelete={() => deleteColumn(headerMenuColumn.key)}
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
  onRename: (name: string) => void
  onDelete: () => void
  onContextMenu: (x: number, y: number) => void
}

function HeaderCell({ column, onRename, onDelete, onContextMenu }: HeaderCellProps) {
  return (
    <div
      className={styles.header}
      onDoubleClick={(e) => {
        e.stopPropagation()
        const next = window.prompt('열 이름', column.name)
        if (next !== null) onRename(next)
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
