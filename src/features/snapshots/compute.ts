import { formatMoney, formatMonthLabel } from '../../lib/format'
import type { Purchase } from '../purchases/api'
import { computeSettlement } from '../purchases/settlement'
import type { SettlementRecord } from '../purchases/settlementApi'
import type { Todo } from '../todos/api'
import type { Anniversary } from '../anniversaries/api'
import { daysFromToday, nextOccurrence, yearsSince } from '../anniversaries/api'
import type {
  AnniversaryFilter,
  PurchaseTotalFilter,
  SettlementFilter,
  SnapshotFrozen,
  TodoSubsetFilter,
} from './types'

const nowIso = () => new Date().toISOString()

// ── purchase-total ────────────────────────────────────────────────────
export function computePurchaseTotal(
  filter: PurchaseTotalFilter,
  rows: Purchase[],
): SnapshotFrozen {
  const filtered = rows.filter(
    (r) => !filter.category || filter.category === 'ALL' || r.category === filter.category,
  )
  // Per-currency totals; pick the dominant one as primary, list the rest in secondary.
  const totals = new Map<string, number>()
  for (const r of filtered) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount)
  const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  const primaryEntry = entries[0]
  const primary = primaryEntry ? formatMoney(primaryEntry[1], primaryEntry[0]) : '—'
  const others = entries
    .slice(1)
    .map(([cur, sum]) => formatMoney(sum, cur))
    .join(' · ')

  const monthLabel = formatMonthLabel(filter.month)
  const catLabel = !filter.category || filter.category === 'ALL' ? '전체' : filter.category
  return {
    label: `구매 내역 · ${monthLabel} · ${catLabel}`,
    primary,
    secondary: `${filtered.length}건${others ? ` · ${others}` : ''}`,
    capturedAt: nowIso(),
  }
}

// ── settlement ────────────────────────────────────────────────────────
export function computeSettlementSnapshot(
  filter: SettlementFilter,
  rows: Purchase[],
  records: SettlementRecord[],
  _currentUserId: number | undefined,
): SnapshotFrozen {
  // The household is fully derivable from purchases + settlements; we
  // don't need a current-user injection at snapshot time.
  void _currentUserId
  const result = computeSettlement(rows, records, null)
  const krwRow = result.find((r) => r.currency === 'KRW') ?? result[0]
  let primary = '—'
  if (krwRow) {
    const sorted = [...krwRow.perUser].sort((a, b) => b.balance - a.balance)
    const top = sorted[0]
    const bot = sorted[sorted.length - 1]
    if (top && bot && top.userId !== bot.userId && bot.balance < 0) {
      const owed = -bot.balance
      primary = `${bot.name} → ${top.name}: ${formatMoney(owed, krwRow.currency)}`
    } else {
      primary = '정산 완료'
    }
  }
  const monthLabel = formatMonthLabel(filter.month)
  const settled = records.length
  return {
    label: `정산 · ${monthLabel}`,
    primary,
    secondary: settled === 0 ? '정산 기록 없음' : `정산 기록 ${settled}건`,
    capturedAt: nowIso(),
  }
}

// ── todo-subset ───────────────────────────────────────────────────────
export function computeTodoSubset(filter: TodoSubsetFilter, rows: Todo[]): SnapshotFrozen {
  const byStatus = rows.filter((t) => {
    if (filter.status === 'open') return t.status === 'OPEN'
    if (filter.status === 'done') return t.status === 'DONE'
    return true
  })
  const byCat = byStatus.filter(
    (t) => !filter.category || filter.category === 'ALL' || t.category === filter.category,
  )

  const statusLabel =
    filter.status === 'open' ? '남은 일' : filter.status === 'done' ? '완료된 일' : '할 일'
  const catLabel = !filter.category || filter.category === 'ALL' ? '전체' : filter.category
  const sample = byCat
    .slice(0, 3)
    .map((t) => t.task)
    .join(' · ')

  return {
    label: `${statusLabel} · ${catLabel}`,
    primary: `${byCat.length}건`,
    secondary: sample || undefined,
    capturedAt: nowIso(),
  }
}

// ── anniversary ───────────────────────────────────────────────────────
export function computeAnniversarySnapshot(
  filter: AnniversaryFilter,
  rows: Anniversary[],
): SnapshotFrozen {
  const today = new Date()

  const enriched = rows
    .map((a) => {
      const occ = nextOccurrence(a, today)
      const days = daysFromToday(occ, today)
      const yrs = a.recurring ? yearsSince(a.date, occ) : null
      return { a, occ, days, yrs }
    })
    .filter((row) => {
      if (filter.window === 'upcoming-30') return row.days >= 0 && row.days <= 30
      if (filter.window === 'past-year') return row.days < 0 && row.days >= -365
      return true
    })
    .sort((x, y) => Math.abs(x.days) - Math.abs(y.days))

  const windowLabel =
    filter.window === 'upcoming-30'
      ? '다가오는 30일'
      : filter.window === 'past-year'
        ? '지난 1년'
        : '전체'

  const nearest = enriched[0]
  const primary = `${enriched.length}건`
  const secondary = nearest
    ? `${nearest.a.name}${nearest.yrs && nearest.yrs > 0 ? ` (${nearest.yrs}주년)` : ''} · ${
        nearest.days === 0
          ? '오늘'
          : nearest.days > 0
            ? `${nearest.days}일 뒤`
            : `${Math.abs(nearest.days)}일 전`
      }`
    : '해당 없음'

  return {
    label: `기념일 · ${windowLabel}`,
    primary,
    secondary,
    capturedAt: nowIso(),
  }
}
