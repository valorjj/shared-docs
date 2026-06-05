import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, User, Users, type LucideIcon } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'

export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY' | 'GBP' | 'CNY'
export const SUPPORTED_CURRENCIES: Currency[] = ['KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY']

export type SplitMode = 'SHARED' | 'MINE' | 'THEIRS'
export const SPLIT_MODES: SplitMode[] = ['SHARED', 'MINE', 'THEIRS']

export const SPLIT_META: Record<SplitMode, { Icon: LucideIcon; label: string; hint: string }> = {
  SHARED: { Icon: Users, label: '함께', hint: '둘이서 반반' },
  MINE:   { Icon: User,  label: '나',   hint: '내 것' },
  THEIRS: { Icon: Gift,  label: '상대', hint: '상대 것' },
}

export type PurchaseAuthor = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type Purchase = {
  id: number
  date: string              // YYYY-MM-DD
  category: string
  item: string
  store: string | null
  amount: number            // may be int or decimal depending on currency
  currency: string
  note: string | null
  splitMode: SplitMode
  createdBy: PurchaseAuthor
  createdAt: string
  updatedAt: string
}

export type PurchaseCategory = {
  id: number
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  active: boolean
}

export type PurchasePayload = {
  date: string
  category: string
  item: string
  store?: string | null
  amount: number
  currency: string
  note?: string | null
  splitMode: SplitMode
}

export const purchaseKeys = {
  // Workspace-scoped: prefix for invalidating all of a workspace's purchase queries.
  scope: (wsId: number | null) => ['purchases', wsId] as const,
  list: (wsId: number | null, range: { from: string; to: string }) =>
    ['purchases', wsId, 'list', range.from, range.to] as const,
  // Workspace-scoped (Phase C): each workspace has its own categories.
  categories: (wsId: number | null) => ['purchase-categories', wsId] as const,
}

export async function fetchPurchaseList(from: string, to: string): Promise<Purchase[]> {
  const { data } = await apiClient.get<Purchase[]>('/api/purchases', { params: { from, to } })
  return data
}
const fetchList = fetchPurchaseList

async function createPurchase(payload: PurchasePayload): Promise<Purchase> {
  const { data } = await apiClient.post<Purchase>('/api/purchases', payload)
  return data
}

async function updatePurchaseReq(id: number, payload: PurchasePayload): Promise<Purchase> {
  const { data } = await apiClient.patch<Purchase>(`/api/purchases/${id}`, payload)
  return data
}

async function deletePurchaseReq(id: number): Promise<void> {
  await apiClient.delete(`/api/purchases/${id}`)
}

async function fetchCategories(): Promise<PurchaseCategory[]> {
  const { data } = await apiClient.get<PurchaseCategory[]>('/api/purchase-categories')
  return data
}

export function usePurchases(range: { from: string; to: string }) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: purchaseKeys.list(activeId, range),
    queryFn: () => fetchList(range.from, range.to),
    enabled: activeId != null && !!(range.from && range.to),
  })
}

export function usePurchaseCategories() {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: purchaseKeys.categories(activeId),
    queryFn: fetchCategories,
    enabled: activeId != null,
    staleTime: 5 * 60_000,
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (payload: PurchasePayload) => createPurchase(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.scope(activeId) }),
  })
}

export function useUpdatePurchase() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PurchasePayload }) =>
      updatePurchaseReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.scope(activeId) }),
  })
}

export function useDeletePurchase() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deletePurchaseReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.scope(activeId) }),
  })
}

export { formatMoney, todayString, currentMonthString, monthBounds } from '../../lib/format'
