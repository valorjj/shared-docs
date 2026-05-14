import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DataGrid,
  renderTextEditor,
  type Column,
  type DataGridHandle,
  type RenderEditCellProps,
  type RowsChangeData,
} from 'react-data-grid'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import 'react-data-grid/lib/styles.css'

import { useAuth } from '../../auth/useAuth'
import { Badge, Button, IconButton, Kbd } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import {
  SPLIT_META,
  SPLIT_MODES,
  SUPPORTED_CURRENCIES,
  todayString,
  useCreatePurchase,
  useDeletePurchase,
  usePurchaseCategories,
  useUpdatePurchase,
  type Purchase,
  type PurchaseCategory,
  type PurchasePayload,
  type SplitMode,
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
  splitMode: SplitMode
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
    splitMode: 'SHARED',
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
    splitMode: p.splitMode,
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
    splitMode: r.splitMode,
  }
}

function isDraftReady(r: GridRow): boolean {
  return r.item.trim().length > 0 && r.amount > 0 && r.category.length > 0
}

interface Props {
  rows: Purchase[]
  onEditDetails?: (row: Purchase) => void
  highlightRowId?: number
}

export default function PurchaseGrid({ rows, onEditDetails, highlightRowId }: Props) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { data: categories = [] } = usePurchaseCategories()
  const createMut = useCreatePurchase()
  const updateMut = useUpdatePurchase()
  const deleteMut = useDeletePurchase()
  const gridRef = useRef<DataGridHandle>(null)

  const defaultCategory = categories.find((c) => c.active)?.name ?? categories[0]?.name ?? ''
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<GridRow>(() => makeDraft(defaultCategory))

  const dataRows = useMemo<GridRow[]>(
    () => (adding ? [draft, ...rows.map(fromPurchase)] : rows.map(fromPurchase)),
    [adding, draft, rows],
  )

  const startAdd = useCallback(() => {
    setDraft(makeDraft(defaultCategory))
    setAdding(true)
  }, [defaultCategory])

  const cancelAdd = useCallback(() => {
    setAdding(false)
    setDraft(makeDraft(defaultCategory))
  }, [defaultCategory])

  const commitDraft = useCallback(() => {
    if (!isDraftReady(draft) || createMut.isPending) return
    createMut.mutate(toPayload(draft), {
      onSuccess: () => {
        setDraft(makeDraft(defaultCategory))
        setAdding(false)
      },
    })
  }, [createMut, defaultCategory, draft])

  // After draft row mounts, jump focus to the first meaningful cell (item).
  useEffect(() => {
    if (!adding) return
    const id = requestAnimationFrame(() => {
      gridRef.current?.selectCell({ rowIdx: 0, idx: 1 }, { enableEditor: true })
    })
    return () => cancelAnimationFrame(id)
  }, [adding])

  // Scroll a highlighted row into view (called from the calendar via ?row= URL param).
  useEffect(() => {
    if (highlightRowId == null) return
    const idx = dataRows.findIndex((r) => r.id === highlightRowId)
    if (idx < 0) return
    const id = requestAnimationFrame(() => {
      gridRef.current?.scrollToCell({ rowIdx: idx, idx: 0 })
    })
    return () => cancelAnimationFrame(id)
  }, [highlightRowId, dataRows])

  const columns = useMemo<Column<GridRow>[]>(() => {
    const catNames = categories.filter((c) => c.active).map((c) => c.name)
    return [
      {
        key: 'date',
        name: '날짜',
        width: 120,
        renderEditCell: dateEditor,
      },
      {
        key: 'item',
        name: '품목',
        width: 200,
        renderEditCell: renderTextEditor,
        renderCell: ({ row }) =>
          row.id === DRAFT_ID && !row.item ? (
            <span className="purchase__grid-placeholder">예: 장보기</span>
          ) : (
            row.item
          ),
      },
      {
        key: 'store',
        name: '상점',
        width: 140,
        renderEditCell: renderTextEditor,
        renderCell: ({ row }) =>
          row.id === DRAFT_ID && !row.store ? (
            <span className="purchase__grid-placeholder">선택</span>
          ) : (
            row.store
          ),
      },
      {
        key: 'amount',
        name: '금액',
        width: 120,
        cellClass: 'rdg-cell--right',
        renderCell: ({ row }) =>
          row.id === DRAFT_ID && row.amount === 0 ? (
            <span className="purchase__grid-placeholder">0</span>
          ) : (
            formatMoney(row.amount, row.currency)
          ),
        renderEditCell: amountEditor,
      },
      {
        key: 'currency',
        name: '통화',
        width: 80,
        renderEditCell: (p) => selectEditor(p, SUPPORTED_CURRENCIES),
      },
      {
        key: 'category',
        name: '카테고리',
        width: 130,
        renderCell: ({ row }) => <CategoryCell row={row} categories={categories} />,
        renderEditCell: (p) => selectEditor(p, catNames),
      },
      {
        key: 'splitMode',
        name: '나눔',
        width: 90,
        renderCell: ({ row }) => (
          <span className="purchase__split-cell" title={SPLIT_META[row.splitMode].hint}>
            <span aria-hidden="true">{SPLIT_META[row.splitMode].emoji}</span>
            <span>{SPLIT_META[row.splitMode].label}</span>
          </span>
        ),
        renderEditCell: (p) => selectEditor(p, SPLIT_MODES),
      },
      {
        key: 'byName',
        name: '누가',
        width: 110,
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
              <span className="purchase__grid-actions">
                <Button
                  variant="primary"
                  size="sm"
                  leading={<Plus size={14} strokeWidth={2.5} />}
                  disabled={!isDraftReady(row) || createMut.isPending}
                  onClick={commitDraft}
                >
                  저장
                </Button>
                <IconButton label="취소" variant="ghost" size="sm" onClick={cancelAdd}>
                  <X size={14} strokeWidth={2} />
                </IconButton>
              </span>
            )
          }
          const canMutate = row.byUserId === user?.userId || isAdmin
          if (!canMutate) return null
          return (
            <span className="purchase__grid-actions">
              {onEditDetails && (
                <IconButton
                  label="메모 편집"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const p = rows.find((x) => x.id === row.id)
                    if (p) onEditDetails(p)
                  }}
                >
                  <Pencil size={14} strokeWidth={2} />
                </IconButton>
              )}
              <IconButton
                label="삭제"
                variant="danger"
                size="sm"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirm(`"${row.item}" 항목을 삭제할까요?`)) {
                    deleteMut.mutate(row.id as number)
                  }
                }}
              >
                <Trash2 size={14} strokeWidth={2} />
              </IconButton>
            </span>
          )
        },
      },
    ]
  }, [categories, createMut, deleteMut, isAdmin, onEditDetails, rows, user?.userId, commitDraft, cancelAdd])

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
        before.category !== after.category ||
        before.splitMode !== after.splitMode
      if (!changed) continue
      if (!after.item.trim() || after.amount <= 0) continue
      updateMut.mutate({ id: after.id as number, payload: toPayload(after) })
    }
  }

  return (
    <div className="purchase__grid-wrap">
      <div className="purchase__grid-toolbar">
        {adding ? (
          <>
            <Button
              variant="primary"
              size="sm"
              leading={<Plus size={14} strokeWidth={2.5} />}
              disabled={!isDraftReady(draft) || createMut.isPending}
              onClick={commitDraft}
            >
              저장
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelAdd}>
              취소
            </Button>
            <span className="purchase__grid-toolbar-hint">
              <Kbd>⌘/Ctrl + Enter</Kbd> 로 저장 · <Kbd>Esc</Kbd> 로 취소
            </span>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              leading={<Plus size={14} strokeWidth={2.5} />}
              onClick={startAdd}
            >
              항목 추가
            </Button>
            <span className="purchase__grid-toolbar-hint">새 행을 추가합니다</span>
          </>
        )}
      </div>

      <DataGrid<GridRow>
        ref={gridRef}
        className="rdg-light purchase__grid"
        columns={columns}
        rows={dataRows}
        rowKeyGetter={(r) => r.id}
        rowClass={(r) => {
          const parts: string[] = []
          if (r.id === DRAFT_ID) parts.push('rdg-cell--draft')
          if (highlightRowId != null && r.id === highlightRowId) parts.push('rdg-row--pulse')
          return parts.length ? parts.join(' ') : undefined
        }}
        onRowsChange={handleRowsChange}
        onCellKeyDown={({ row, mode }, event) => {
          if (mode !== 'SELECT') return
          if (row.id !== DRAFT_ID) return
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventGridDefault()
            commitDraft()
            return
          }
          if (event.key === 'Escape') {
            event.preventGridDefault()
            cancelAdd()
          }
        }}
        defaultColumnOptions={{ resizable: true, sortable: false }}
        rowHeight={42}
        headerRowHeight={40}
      />
      {!adding && (
        <p className="purchase__grid-hint">
          셀 더블클릭(또는 <Kbd>Enter</Kbd>)으로 편집 · <Kbd>Tab</Kbd> 이동 · <Kbd>Ctrl+C/V</Kbd>
          복사·붙여넣기
        </p>
      )}
    </div>
  )
}

function focusInput(el: HTMLInputElement | HTMLSelectElement | null) {
  el?.focus()
  if (el instanceof HTMLInputElement && el.type !== 'date') el.select()
}

function dateEditor(p: RenderEditCellProps<GridRow>) {
  return (
    <input
      ref={focusInput}
      type="date"
      className="purchase__cell-input"
      value={p.row.date}
      onChange={(e) => p.onRowChange({ ...p.row, date: e.target.value })}
      onBlur={() => p.onClose(true, false)}
    />
  )
}

function amountEditor(p: RenderEditCellProps<GridRow>) {
  return (
    <input
      ref={focusInput}
      type="number"
      min="0"
      step="any"
      className="purchase__cell-input purchase__cell-input--right"
      value={p.row.amount === 0 ? '' : p.row.amount}
      onChange={(e) => p.onRowChange({ ...p.row, amount: Number(e.target.value) || 0 })}
      onBlur={() => p.onClose(true, false)}
    />
  )
}

function selectEditor(p: RenderEditCellProps<GridRow>, options: string[]) {
  const key = p.column.key as keyof GridRow
  const value = (p.row[key] ?? '') as string
  return (
    <select
      ref={focusInput}
      className="purchase__cell-input"
      value={value}
      onChange={(e) => p.onRowChange({ ...p.row, [key]: e.target.value } as GridRow, true)}
      onBlur={() => p.onClose(false, false)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function CategoryCell({ row, categories }: { row: GridRow; categories: PurchaseCategory[] }) {
  const c = categories.find((x) => x.name === row.category)
  if (!row.category) return <span className="purchase__grid-placeholder">—</span>
  return <Badge color={c?.color ?? undefined}>{row.category}</Badge>
}
