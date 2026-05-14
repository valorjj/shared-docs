import { useMemo } from 'react'
import {
  DataGrid,
  renderTextEditor,
  type Column,
  type RenderHeaderCellProps,
} from 'react-data-grid'
import { X } from 'lucide-react'
import 'react-data-grid/lib/styles.css'
import type { SheetColumn, SheetData, SheetRow } from '../types'
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

  const columns = useMemo<Column<GridRow>[]>(() => {
    return data.columns.map((col) => ({
      key: col.key,
      name: col.name,
      width: col.width ?? 160,
      minWidth: MIN_COL_WIDTH,
      resizable: true,
      editable: true,
      renderEditCell: renderTextEditor,
      renderHeaderCell: (p: RenderHeaderCellProps<GridRow>) => (
        <HeaderCell
          column={col}
          rdgColumn={p.column}
          onRename={(newName) => renameColumn(col.key, newName)}
          onDelete={() => deleteColumn(col.key)}
        />
      ),
    }))
  }, [data.columns]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className={styles.wrapper}>
      <DataGrid<GridRow>
        className={`rdg-light ${styles.grid}`}
        columns={columns}
        rows={gridRows}
        onRowsChange={handleRowsChange}
        onColumnResize={handleColumnResize}
        rowKeyGetter={(r) => String(r._idx)}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={HEADER_HEIGHT}
        defaultColumnOptions={{ resizable: true }}
      />
    </div>
  )
}

type HeaderCellProps = {
  column: SheetColumn
  rdgColumn: { name: React.ReactNode }
  onRename: (name: string) => void
  onDelete: () => void
}

function HeaderCell({ column, onRename, onDelete }: HeaderCellProps) {
  return (
    <div
      className={styles.header}
      onDoubleClick={(e) => {
        e.stopPropagation()
        const next = window.prompt('열 이름', column.name)
        if (next !== null) onRename(next)
      }}
      title="더블클릭으로 이름 변경"
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
