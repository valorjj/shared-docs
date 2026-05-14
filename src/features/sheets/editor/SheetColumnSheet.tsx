import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { nextColumnKey, nextColumnLabel } from '../shared/sheetData'
import type { SheetColumn, SheetData } from '../types'
import styles from './SheetColumnSheet.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: SheetData
  onChange: (next: SheetData) => void
}

/**
 * Mobile-only slide-up sheet for column management.
 * Replaces the desktop affordances (header dblclick rename + hover × delete)
 * which don't work on touch devices.
 */
export default function SheetColumnSheet({ open, onOpenChange, data, onChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>열 관리</Dialog.Title>
          <div className={styles.handle} aria-hidden="true" />
          <div className={styles.body}>
            <ColumnList data={data} onChange={onChange} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ColumnList({ data, onChange }: { data: SheetData; onChange: (n: SheetData) => void }) {
  const { columns, rows } = data

  const renameColumn = (key: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onChange({
      columns: columns.map((c) => (c.key === key ? { ...c, name: trimmed } : c)),
      rows,
    })
  }

  const deleteColumn = (key: string) => {
    onChange({
      columns: columns.filter((c) => c.key !== key),
      rows: rows.map((r) => {
        const { [key]: _removed, ...rest } = r
        void _removed
        return rest
      }),
    })
  }

  const addColumn = () => {
    const key = nextColumnKey(columns)
    const name = nextColumnLabel(columns)
    onChange({
      columns: [...columns, { key, name, width: 160 }],
      rows: rows.map((r) => ({ ...r, [key]: '' })),
    })
  }

  return (
    <>
      {columns.length === 0 ? (
        <p className={styles.empty}>아직 열이 없습니다. 아래 버튼으로 추가해주세요.</p>
      ) : (
        <ul className={styles.list}>
          {columns.map((c) => (
            <ColumnRow key={c.key} column={c} onRename={renameColumn} onDelete={deleteColumn} />
          ))}
        </ul>
      )}
      <button type="button" className={styles.addBtn} onClick={addColumn}>
        <Plus size={14} strokeWidth={2} />
        <span>열 추가</span>
      </button>
    </>
  )
}

type RowProps = {
  column: SheetColumn
  onRename: (key: string, name: string) => void
  onDelete: (key: string) => void
}

function ColumnRow({ column, onRename, onDelete }: RowProps) {
  // Wrapper-keyed inner pattern: parent keys this by column.key so we never
  // sync `column.name` into state. Local state owns the in-flight edit.
  return <ColumnRowInner key={column.key} column={column} onRename={onRename} onDelete={onDelete} />
}

function ColumnRowInner({ column, onRename, onDelete }: RowProps) {
  const [name, setName] = useState(column.name)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const commit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(column.name)
      return
    }
    if (trimmed !== column.name) onRename(column.key, trimmed)
  }

  return (
    <li className={styles.row}>
      <input
        type="text"
        className={styles.nameInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        aria-label={`${column.name} 열 이름`}
      />
      <button
        type="button"
        className={styles.del}
        onClick={() => setConfirmOpen(true)}
        aria-label={`${column.name} 열 삭제`}
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${column.name} 열을 삭제할까요?`}
        description="모든 행에서 이 열 데이터가 함께 사라집니다."
        confirmLabel="삭제"
        destructive
        onConfirm={() => onDelete(column.key)}
      />
    </li>
  )
}
