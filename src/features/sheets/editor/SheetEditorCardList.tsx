import { useState } from 'react'
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Menu, MenuItem } from '../../../components/ui/Menu'
import type { SheetColumn, SheetData, SheetRow } from '../types'
import { makeEmptyRow } from '../shared/sheetData'
import styles from './SheetEditorCardList.module.css'

type Props = {
  data: SheetData
  /** Undefined for VIEW recipients — inputs become readonly and the
   *  add-row / delete-row affordances are hidden. */
  onChange?: (next: SheetData) => void
  readOnly?: boolean
}

/**
 * Mobile-only view of the sheet: each row becomes a card with one labeled
 * field per column. Cell edits stream into `onChange`; the parent debounces
 * the actual save. VIEW recipients see the same cards as read-only.
 */
export default function SheetEditorCardList({ data, onChange, readOnly = false }: Props) {
  const { columns, rows } = data
  const emitChange = onChange ?? (() => {})

  const setCell = (rowIndex: number, key: string, value: string) => {
    const nextRows = rows.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r))
    emitChange({ columns, rows: nextRows })
  }

  const deleteRow = (rowIndex: number) => {
    emitChange({ columns, rows: rows.filter((_, i) => i !== rowIndex) })
  }

  const addRow = () => {
    emitChange({ columns, rows: [...rows, makeEmptyRow(columns)] })
  }

  if (columns.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.emptyCols}>
          먼저 위쪽의 <strong>열 관리</strong>로 열을 만들어주세요.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <ol className={styles.cards}>
        {rows.map((row, i) => (
          <RowCard
            key={i}
            index={i}
            columns={columns}
            row={row}
            readOnly={readOnly}
            onCellChange={(key, value) => setCell(i, key, value)}
            onDelete={() => deleteRow(i)}
          />
        ))}
      </ol>
      {!readOnly && (
        <button type="button" className={styles.addRow} onClick={addRow}>
          <Plus size={14} strokeWidth={2} />
          <span>행 추가</span>
        </button>
      )}
    </div>
  )
}

type RowCardProps = {
  index: number
  columns: SheetColumn[]
  row: SheetRow
  readOnly: boolean
  onCellChange: (key: string, value: string) => void
  onDelete: () => void
}

function RowCard({ index, columns, row, readOnly, onCellChange, onDelete }: RowCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIndex}>#{index + 1}</span>
        {!readOnly && (
          <Menu
            trigger={
              <button type="button" className={styles.kebab} aria-label={`행 ${index + 1} 메뉴`}>
                <MoreHorizontal size={18} strokeWidth={2} />
              </button>
            }
          >
            <MenuItem onSelect={() => setConfirmOpen(true)} icon={<Trash2 size={14} />} destructive>
              행 삭제
            </MenuItem>
          </Menu>
        )}
      </div>
      <div className={styles.fields}>
        {columns.map((c) => (
          <label key={c.key} className={styles.field}>
            <span className={styles.label}>{c.name}</span>
            <input
              type="text"
              className={styles.input}
              value={row[c.key] ?? ''}
              readOnly={readOnly}
              onChange={(e) => onCellChange(c.key, e.target.value)}
              placeholder="—"
            />
          </label>
        ))}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${index + 1}번 행을 삭제할까요?`}
        description="이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        destructive
        onConfirm={onDelete}
      />
    </li>
  )
}
