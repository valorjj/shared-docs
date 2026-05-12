import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Plus } from 'lucide-react'
import MobileTable, { type Column } from '../../components/common/MobileTable'
import { useAuth } from '../../auth/AuthContext'
import {
  currentMonthString,
  formatMoney,
  monthBounds,
  useDeletePurchase,
  usePurchaseCategories,
  usePurchases,
  type Purchase,
} from './api'
import PurchaseForm from './PurchaseForm'
import './purchases.css'

export default function PurchaseList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [month, setMonth] = useState<string>(currentMonthString())
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)

  const range = useMemo(() => monthBounds(month), [month])
  const { data: rows, isLoading, isError, error, refetch } = usePurchases(range)
  const { data: categories } = usePurchaseCategories()
  const deletePurchase = useDeletePurchase()

  const filtered = useMemo(() => {
    if (!rows) return []
    if (categoryFilter === 'ALL') return rows
    return rows.filter((r) => r.category === categoryFilter)
  }, [rows, categoryFilter])

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered) {
      map.set(r.currency, (map.get(r.currency) ?? 0) + r.amount)
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === 'KRW' ? -1 : b === 'KRW' ? 1 : a.localeCompare(b)))
  }, [filtered])

  const handleRowClick = (row: Purchase) => {
    setEditing(row)
    setFormOpen(true)
  }

  const handleDelete = (row: Purchase) => {
    const canDelete = row.createdBy.userId === user?.userId || isAdmin
    if (!canDelete) return
    if (confirm(`"${row.item}" 항목을 삭제할까요?`)) {
      deletePurchase.mutate(row.id)
    }
  }

  const columns: Column<Purchase>[] = [
    {
      key: 'item',
      header: '항목',
      mobile: 'primary',
      render: (r) => (
        <span className="purchase__item-cell">
          <span className="purchase__item-name">{r.item}</span>
          {r.store && <span className="purchase__store"> @ {r.store}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      header: '금액',
      mobile: 'primary',
      align: 'right',
      render: (r) => (
        <span className="purchase__amount">{formatMoney(r.amount, r.currency)}</span>
      ),
    },
    {
      key: 'date',
      header: '날짜',
      mobile: 'secondary',
      render: (r) => formatShortDate(r.date),
    },
    {
      key: 'category',
      header: '카테고리',
      mobile: 'secondary',
      render: (r) => <CategoryBadge name={r.category} categories={categories ?? []} />,
    },
    {
      key: 'store',
      header: '상점',
      mobile: 'hidden',
      render: (r) => r.store ?? '—',
    },
    {
      key: 'createdBy',
      header: '누가',
      mobile: 'meta',
      render: (r) => (
        <span className="purchase__author">
          {r.createdBy.pictureUrl ? (
            <img className="purchase__avatar" src={r.createdBy.pictureUrl} alt="" />
          ) : null}
          {r.createdBy.name}
        </span>
      ),
    },
  ]

  return (
    <div className="purchase">
      <header className="purchase__header">
        <Link to="/data" className="purchase__back">← 데이터</Link>
        <h1 className="purchase__title">
          <Wallet size={22} strokeWidth={2} aria-hidden="true" />
          <span>구매 내역</span>
        </h1>
      </header>

      <section className="purchase__controls">
        <div className="purchase__month">
          <label className="purchase__control-label">월</label>
          <input
            type="month"
            className="purchase__month-input"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonthString())}
          />
        </div>

        <div className="purchase__category-filter">
          <label className="purchase__control-label">카테고리</label>
          <select
            className="purchase__select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">전체</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.name}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="purchase__totals">
          {totalsByCurrency.length === 0 ? (
            <span className="purchase__total-empty">합계 —</span>
          ) : (
            totalsByCurrency.map(([cur, sum]) => (
              <span key={cur} className="purchase__total">
                <span className="purchase__total-label">합계</span>
                <span className="purchase__total-value">{formatMoney(sum, cur)}</span>
              </span>
            ))
          )}
        </div>
      </section>

      {isLoading && <p className="purchase__status">불러오는 중…</p>}
      {isError && (
        <p className="purchase__status purchase__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <button type="button" onClick={() => refetch()}>다시 시도</button>
        </p>
      )}

      {rows && (
        <MobileTable<Purchase>
          columns={columns}
          rows={filtered}
          keyOf={(r) => r.id}
          onRowClick={handleRowClick}
          empty={
            <div>
              이 달에는 등록된 구매 내역이 없습니다.<br />
              <span style={{ fontSize: '0.85em', color: '#8a857c' }}>오른쪽 아래 + 버튼으로 추가하세요.</span>
            </div>
          }
          rowActions={(row) => {
            const canDelete = row.createdBy.userId === user?.userId || isAdmin
            return canDelete ? (
              <button
                type="button"
                className="purchase__delete-btn"
                onClick={() => handleDelete(row)}
                disabled={deletePurchase.isPending}
              >
                삭제
              </button>
            ) : null
          }}
        />
      )}

      <button
        type="button"
        className="purchase__fab"
        aria-label="구매 추가"
        onClick={() => { setEditing(null); setFormOpen(true) }}
      >
        <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
      </button>

      <PurchaseForm
        open={formOpen}
        initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />
    </div>
  )
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

function CategoryBadge({
  name,
  categories,
}: {
  name: string
  categories: Array<{ name: string; icon: string | null; color: string | null }>
}) {
  const match = categories.find((c) => c.name === name)
  const style = match?.color
    ? { background: hexWithAlpha(match.color, 0.15), color: match.color }
    : undefined
  return (
    <span className="purchase__cat-badge" style={style}>
      {match?.icon && <span>{match.icon}</span>}
      <span>{name}</span>
    </span>
  )
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([\da-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
