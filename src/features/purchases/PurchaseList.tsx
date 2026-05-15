import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet, Plus, RotateCcw } from 'lucide-react'
import MobileTable, { type Column } from '../../components/common/MobileTable'
import {
  Page,
  PageHeader,
  PageTitle,
  BackLink,
  Card,
  Row,
  Field,
  Label,
  Input,
  Select,
  Button,
  Badge,
  Skeleton,
  ErrorState,
} from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useIsDesktop } from '../../lib/useMediaQuery'
import { formatShortDate } from '../../lib/format'
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
import PurchaseGrid from './PurchaseGrid'
import { SettlementCard } from './SettlementCard'
import { computeSettlement } from './settlement'
import { useSettlements } from './settlementApi'
import { CategoryChart } from './CategoryChart'
import RecurringPurchasesModal from './RecurringPurchasesModal'
import './purchases.css'

export default function PurchaseList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const isDesktop = useIsDesktop()
  const [searchParams, setSearchParams] = useSearchParams()

  const month = searchParams.get('month') ?? currentMonthString()
  const dateParam = searchParams.get('date')
  const editIdParam = searchParams.get('edit')
  const rowIdParam = searchParams.get('row')
  const highlightRowId = rowIdParam ? Number(rowIdParam) : undefined

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const [recurringOpen, setRecurringOpen] = useState(false)

  const setMonth = useCallback(
    (m: string) => {
      const next = new URLSearchParams(searchParams)
      next.set('month', m)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const clearOpenIntent = useCallback(() => {
    if (!dateParam && !editIdParam) return
    const next = new URLSearchParams(searchParams)
    next.delete('date')
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }, [dateParam, editIdParam, searchParams, setSearchParams])

  const range = useMemo(() => monthBounds(month), [month])
  const { data: rows, isLoading, isError, error, refetch } = usePurchases(range)
  const { data: categories } = usePurchaseCategories()
  const { data: settlementRecords } = useSettlements(month)
  const deletePurchase = useDeletePurchase()

  // Derived edit target from URL param ?edit=N, when the row is loaded.
  const urlEditingTarget = useMemo(() => {
    if (!editIdParam || !rows) return null
    const id = Number(editIdParam)
    return rows.find((r) => r.id === id) ?? null
  }, [editIdParam, rows])

  const formInitial = editing ?? urlEditingTarget
  const formIsOpen = formOpen || !!dateParam || !!urlEditingTarget

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
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === 'KRW' ? -1 : b === 'KRW' ? 1 : a.localeCompare(b),
    )
  }, [filtered])

  const settlementRows = useMemo(() => {
    if (!rows) return []
    const me = user
      ? { userId: user.userId, name: user.name, pictureUrl: user.pictureUrl }
      : null
    return computeSettlement(rows, settlementRecords ?? [], me)
  }, [rows, settlementRecords, user])

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
      render: (r) => <span className="purchase__amount">{formatMoney(r.amount, r.currency)}</span>,
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
      render: (r) => {
        const c = categories?.find((x) => x.name === r.category)
        return <Badge color={c?.color ?? undefined}>{r.category}</Badge>
      },
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
    <Page>
      <PageHeader>
        <BackLink to="/data" mobileOnly>데이터</BackLink>
        <Row gap={3} justify="between" wrap>
          <PageTitle icon={<Wallet size={22} strokeWidth={2} />}>구매 내역</PageTitle>
          <Button
            variant="outline"
            size="sm"
            leading={<RotateCcw size={14} strokeWidth={2} />}
            onClick={() => setRecurringOpen(true)}
          >
            반복 항목
          </Button>
        </Row>
      </PageHeader>

      <Card className="purchase__filters" padding="md">
        <Row gap={4} align="end" wrap>
          <Field className="purchase__filter-col">
            <Label htmlFor="purchase-month">월</Label>
            <Input
              id="purchase-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonthString())}
            />
          </Field>
          <Field className="purchase__filter-col">
            <Label htmlFor="purchase-category">카테고리</Label>
            <Select
              id="purchase-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">전체</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </Row>

        <div className="purchase__totals-row">
          <span className="purchase__totals-label">이 달 합계</span>
          <div className="purchase__totals-values">
            {totalsByCurrency.length === 0 ? (
              <span className="purchase__totals-empty">—</span>
            ) : (
              totalsByCurrency.map(([cur, sum]) => (
                <span key={cur} className="purchase__totals-value">
                  {formatMoney(sum, cur)}
                </span>
              ))
            )}
          </div>
        </div>
      </Card>

      <SettlementCard
        rows={settlementRows}
        records={settlementRecords ?? []}
        yearMonth={month}
        currentUserId={user?.userId}
      />

      {rows && rows.length > 0 && (
        <CategoryChart
          rows={rows}
          categories={categories ?? []}
          currentFilter={categoryFilter}
          onFilterChange={setCategoryFilter}
        />
      )}

      {isLoading && (
        <div
          className="purchase__skeleton"
          aria-busy="true"
          aria-label="구매 내역 불러오는 중"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="purchase__skeleton-row">
              <Skeleton width={80} height={12} />
              <Skeleton width="35%" height={14} />
              <Skeleton width={64} height={18} radius="pill" />
              <Skeleton width={90} height={14} />
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {rows && (
        isDesktop ? (
          <PurchaseGrid
            rows={filtered}
            highlightRowId={highlightRowId}
            onEditDetails={(row) => {
              setEditing(row)
              setFormOpen(true)
            }}
          />
        ) : (
          <MobileTable<Purchase>
            columns={columns}
            rows={filtered}
            keyOf={(r) => r.id}
            onRowClick={handleRowClick}
            empty={
              <div>
                이 달에는 등록된 구매 내역이 없습니다.
                <br />
                <span style={{ fontSize: '0.85em', color: 'var(--c-text-subtle)' }}>
                  오른쪽 아래 + 버튼으로 추가하세요.
                </span>
              </div>
            }
            rowActions={(row) => {
              const canDelete = row.createdBy.userId === user?.userId || isAdmin
              return canDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(row)}
                  disabled={deletePurchase.isPending}
                >
                  삭제
                </Button>
              ) : null
            }}
          />
        )
      )}

      {!isDesktop && (
        <button
          type="button"
          className="purchase__fab"
          aria-label="구매 추가"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}

      <PurchaseForm
        open={formIsOpen}
        initial={formInitial}
        initialDate={dateParam ?? undefined}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
          clearOpenIntent()
        }}
      />

      <RecurringPurchasesModal open={recurringOpen} onClose={() => setRecurringOpen(false)} />
    </Page>
  )
}
