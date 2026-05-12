import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY' | 'GBP' | 'CNY'
export const SUPPORTED_CURRENCIES: Currency[] = ['KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY']

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
}

export const purchaseKeys = {
  list: (range: { from: string; to: string }) =>
    ['purchases', 'list', range.from, range.to] as const,
  categories: () => ['purchase-categories'] as const,
}

async function fetchList(from: string, to: string): Promise<Purchase[]> {
  const { data } = await apiClient.get<Purchase[]>('/api/purchases', { params: { from, to } })
  return data
}

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
  return useQuery({
    queryKey: purchaseKeys.list(range),
    queryFn: () => fetchList(range.from, range.to),
    enabled: !!(range.from && range.to),
  })
}

export function usePurchaseCategories() {
  return useQuery({
    queryKey: purchaseKeys.categories(),
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PurchasePayload) => createPurchase(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases', 'list'] }),
  })
}

export function useUpdatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PurchasePayload }) =>
      updatePurchaseReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases', 'list'] }),
  })
}

export function useDeletePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePurchaseReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases', 'list'] }),
  })
}

export function formatMoney(amount: number, currency: string, locale = 'ko-KR'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`
  }
}

export function monthBounds(yyyyMm: string): { from: string; to: string } {
  const [y, m] = yyyyMm.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(first), to: fmt(last) }
}

export function currentMonthString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}
