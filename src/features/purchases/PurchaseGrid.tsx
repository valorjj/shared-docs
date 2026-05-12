import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DataGrid,
  renderTextEditor,
  type Column,
  type RenderEditCellProps,
  type RowsChangeData,
} from 'react-data-grid'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import 'react-data-grid/lib/styles.css'

import { useAuth } from '../../auth/AuthContext'
import {
  SUPPORTED_CURRENCIES,
  formatMoney,
  todayString,
  useCreatePurchase,
  useDeletePurchase,
  usePurchaseCategories,
  useUpdatePurchase,
  type Purchase,
  type PurchaseCategory,
  type PurchasePayload,
} from './api'

const DRAFT_ID = 'draft' as const

type GridRow = {
  id: number | typeof DRAFT_ID
  date: string
  item: string
  store: string
  amount: number
  currency: string
  category: string
  note: string
  byName: string
  byPic: string | null
  byUserId: number | null
}

function makeDraft(defaultCategory: string): GridRow {
  return {
    id: DRAFT_ID,
    date: todayString(),
    item: '',
    store: '',
    amount: 0,
    currency: 'KRW',
    category: defaultCategory,
    note: '',
    byName: '',
    byPic: null,
    byUserId: null,
  }
}

function fromPurchase(p: Purchase): GridRow {
  return {
    id: p.id,
    date: p.date,
    item: p.item,
    store: p.store ?? '',
    amount: p.amount,
    currency: p.currency,
    category: p.category,
    note: p.note ?? '',
    byName: p.createdBy.name,
    byPic: p.createdBy.pictureUrl,
    byUserId: p.createdBy.userId,
  }
}

function toPayload(r: GridRow): PurchasePayload {
  return {
    date: r.date,
    item: r.item.trim(),
    store: r.store.trim() || null,
    amount: r.amount,
    currency: r.currency,
    category: r.category,
    note: r.note.trim() || null,
  }
}

function isDraftReady(r: GridRow): boolean {
  return r.item.trim().length > 0 && r.amount > 0 && r.category.length > 0
}

interface Props {
  rows: Purchase[]
  onEditDetails?: (row: Purchase) => void
}

export default function PurchaseGrid({ rows, onEditDetails }: Props) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { data: categories = [] } = usePurchaseCategories()
  const createMut = useCreatePurchase()
  const updateMut = useUpdatePurchase()
  const deleteMut = useDeletePurchase()

  const defaultCategory = categories.find((c) => c.active)?.name ?? categories[0]?.name ?? ''
  const [draft, setDraft] = useState<GridRow>(() => makeDraft(defaultCategory))

  useEffect(() => {
    if (!draft.category && defaultCategory) {
      setDraft((d) => ({ ...d, category: defaultCategory }))
    }
  }, [defaultCategory, draft.category])

  const dataRows = useMemo<GridRow[]>(
    () => [draft, ...rows.map(fromPurchase)],
    [draft, rows],
  )

  const columns = useMemo<Column<GridRow>[]>(() => {
    const catNames = categories.filter((c) => c.active).map((c) => c.name)
    return [
      {
        key: 'date',
        name: '날짜',
        width: 130,
        renderEditCell: dateEditor,
      },
      {
        key: 'item',
        name: '품목',
        width: 200,
        renderEditCell: renderTextEditor,
      },
      {
        key: 'store',
        name: '상점',
        width: 140,
        renderEditCell: renderTextEditor,
      },
      {
        key: 'amount',
        name: '금액',
        width: 130,
        cellClass: 'rdg-cell--right',
        headerCellClass: 'rdg-header--right',
        renderCell: ({ row }) =>
          row.id === DRAFT_ID && row.amount === 0
            ? <span className="purchase__grid-placeholder">—</span>
            : formatMoney(row.amount, row.currency),
        renderEditCell: amountEditor,
      },
      {
        key: 'currency',
        name: '통화',
        width: 90,
        renderEditCell: (p) => selectEditor(p, SUPPORTED_CURRENCIES),
      },
      {
        key: 'category',
        name: '카테고리',
        width: 150,
        renderCell: ({ row }) => <CategoryCell row={row} categories={categories} />,
        renderEditCell: (p) => selectEditor(p, catNames),
      },
      {
        key: 'byName',
        name: '누가',
        width: 120,
        renderCell: ({ row }) => {
          if (row.id === DRAFT_ID) return <span className="purchase__grid-placeholder">—</span>
          return (
            <span className="purchase__author">
              {row.byPic ? <img className="purchase__avatar" src={row.byPic} alt="" /> : null}
              {row.byName}
            </span>
          )
        },
      },
      {
        key: '__actions',
        name: '',
        width: 130,
        cellClass: 'rdg-cell--actions',
        renderCell: ({ row }) => {
          if (row.id === DRAFT_ID) {
            return (
              <button
                type="button"
                className="purchase__grid-btn purchase__grid-btn--primary"
                disabled={!isDraftReady(row) || createMut.isPending}
                onClick={() => {
                  createMut.mutate(toPayload(row), {
                    onSuccess: () => setDraft(makeDraft(defaultCategory)),
                  })
                }}
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                <span>추가</span>
              </button>
            )
          }
          const canMutate = row.byUserId === user?.userId || isAdmin
          if (!canMutate) return null
          return (
            <span className="purchase__grid-actions">
              {onEditDetails && (
                <button
                  type="button"
                  className="purchase__grid-btn purchase__grid-btn--ghost"
                  onClick={() => {
                    const p = rows.find((x) => x.id === row.id)
                    if (p) onEditDetails(p)
                  }}
                  aria-label="메모 편집"
                  title="메모 편집"
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="purchase__grid-btn purchase__grid-btn--danger"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirm(`"${row.item}" 항목을 삭제할까요?`)) {
                    deleteMut.mutate(row.id as number)
                  }
                }}
                aria-label="삭제"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          )
        },
      },
    ]
  }, [categories, createMut, deleteMut, defaultCategory, isAdmin, onEditDetails, rows, user?.userId])

  function handleRowsChange(newRows: GridRow[], { indexes }: RowsChangeData<GridRow>) {
    for (const i of indexes) {
      const after = newRows[i]
      if (after.id === DRAFT_ID) {
        setDraft(after)
        continue
      }
      const before = dataRows[i]
      if (!before) continue
      const changed =
        before.date !== after.date ||
        before.item !== after.item ||
        before.store !== after.store ||
        before.amount !== after.amount ||
        before.currency !== after.currency ||
        before.category !== after.category
      if (!changed) continue
      if (!after.item.trim() || after.amount <= 0) continue
      updateMut.mutate({ id: after.id as number, payload: toPayload(after) })
    }
  }

  return (
    <div className="purchase__grid-wrap">
      <DataGrid<GridRow>
        className="rdg-light purchase__grid"
        columns={columns}
        rows={dataRows}
        rowKeyGetter={(r) => r.id}
        onRowsChange={handleRowsChange}
        defaultColumnOptions={{ resizable: true, sortable: false }}
        rowHeight={42}
        headerRowHeight={40}
      />
      <p className="purchase__grid-hint">
        셀을 더블클릭(또는 Enter)하면 편집됩니다 · Tab/Shift+Tab 이동 · Ctrl+C/V 복사·붙여넣기
      </p>
    </div>
  )
}

function dateEditor(p: RenderEditCellProps<GridRow>) {
  return (
    <input
      autoFocus
      type="date"
      className="rdg-text-editor"
      value={p.row.date}
      onChange={(e) => p.onRowChange({ ...p.row, date: e.target.value })}
      onBlur={() => p.onClose(true)}
    />
  )
}

function amountEditor(p: RenderEditCellProps<GridRow>) {
  return (
    <input
      autoFocus
      type="number"
      min="0"
      step="any"
      className="rdg-text-editor rdg-text-editor--right"
      value={p.row.amount === 0 ? '' : p.row.amount}
      onChange={(e) => p.onRowChange({ ...p.row, amount: Number(e.target.value) || 0 })}
      onBlur={() => p.onClose(true)}
    />
  )
}

function selectEditor(p: RenderEditCellProps<GridRow>, options: string[]) {
  const key = p.column.key as keyof GridRow
  const value = (p.row[key] ?? '') as string
  return (
    <select
      autoFocus
      className="rdg-text-editor"
      value={value}
      onChange={(e) => p.onRowChange({ ...p.row, [key]: e.target.value } as GridRow, true)}
      onBlur={() => p.onClose(false)}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

function CategoryCell({ row, categories }: { row: GridRow; categories: PurchaseCategory[] }) {
  const c = categories.find((x) => x.name === row.category)
  const style: CSSProperties | undefined = c?.color
    ? { background: hexWithAlpha(c.color, 0.15), color: c.color }
    : undefined
  if (!row.category) return <span className="purchase__grid-placeholder">—</span>
  return (
    <span className="purchase__cat-badge" style={style}>
      {c?.icon ? <span>{c.icon}</span> : null}
      <span>{row.category}</span>
    </span>
  )
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([\da-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`
}
