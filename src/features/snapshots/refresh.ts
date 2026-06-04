import type { QueryClient } from '@tanstack/react-query'
import { getActiveWorkspaceId } from '../../auth/workspaceStorage'
import { monthBounds } from '../../lib/format'
import { fetchPurchaseList, purchaseKeys } from '../purchases/api'
import { fetchSettlementList, settlementKeys } from '../purchases/settlementApi'
import { anniversaryKeys, fetchAnniversaryList } from '../anniversaries/api'
import { fetchTodoList, todoKeys } from '../todos/api'
import {
  computeAnniversarySnapshot,
  computePurchaseTotal,
  computeSettlementSnapshot,
  computeTodoSubset,
} from './compute'
import type { SnapshotAttrs, SnapshotFrozen } from './types'

/**
 * Re-fetches the source data for a snapshot and recomputes its frozen
 * payload. Uses `queryClient.fetchQuery` so we share the regular cache
 * with the rest of the app — opening `/data/purchases` will see the
 * same fresh rows the refresh just pulled.
 */
export async function refreshSnapshot(
  qc: QueryClient,
  attrs: SnapshotAttrs,
  currentUserId: number | undefined,
): Promise<SnapshotFrozen> {
  // This is a plain helper (no hooks), so read the active workspace from storage
  // — the same synchronous source the axios interceptor uses — so the cache key
  // matches the X-Workspace-Id the fetch sends.
  const wsId = getActiveWorkspaceId()
  switch (attrs.kind) {
    case 'purchase-total': {
      const f = attrs.filter as { month: string; category?: string }
      const range = monthBounds(f.month)
      const rows = await qc.fetchQuery({
        queryKey: purchaseKeys.list(wsId, range),
        queryFn: () => fetchPurchaseList(range.from, range.to),
      })
      return computePurchaseTotal(f, rows)
    }
    case 'settlement': {
      const f = attrs.filter as { month: string }
      const range = monthBounds(f.month)
      const [rows, records] = await Promise.all([
        qc.fetchQuery({
          queryKey: purchaseKeys.list(wsId, range),
          queryFn: () => fetchPurchaseList(range.from, range.to),
        }),
        qc.fetchQuery({
          queryKey: settlementKeys.list(wsId, f.month),
          queryFn: () => fetchSettlementList(f.month),
        }),
      ])
      return computeSettlementSnapshot(f, rows, records, currentUserId)
    }
    case 'todo-subset': {
      const f = attrs.filter as { status: 'open' | 'done' | 'all'; category?: string }
      const todos = await qc.fetchQuery({
        queryKey: todoKeys.list(wsId, 'all'),
        queryFn: () => fetchTodoList('all'),
      })
      return computeTodoSubset(f, todos)
    }
    case 'anniversary': {
      const f = attrs.filter as { window: 'upcoming-30' | 'past-year' | 'all' }
      const rows = await qc.fetchQuery({
        queryKey: anniversaryKeys.list(wsId),
        queryFn: fetchAnniversaryList,
      })
      return computeAnniversarySnapshot(f, rows)
    }
  }
}
