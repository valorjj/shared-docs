import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type { SplitMode } from './api'

export type RecurringAuthor = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type RecurringPurchase = {
  id: number
  category: string
  item: string
  store: string | null
  amount: number
  currency: string
  note: string | null
  splitMode: SplitMode
  dayOfMonth: number
  active: boolean
  lastGeneratedYearMonth: string | null
  createdBy: RecurringAuthor
  createdAt: string
  updatedAt: string
}

export type CreateRecurringPayload = {
  category: string
  item: string
  store?: string | null
  amount: number
  currency: string
  note?: string | null
  splitMode: SplitMode
  dayOfMonth: number
}

export type UpdateRecurringPayload = CreateRecurringPayload & {
  active: boolean
}

export const recurringKeys = {
  // Workspace-scoped: prefix for invalidating all of a workspace's recurring queries.
  scope: (wsId: number | null) => ['recurring-purchases', wsId] as const,
  list: (wsId: number | null) => ['recurring-purchases', wsId, 'list'] as const,
}

async function fetchList(): Promise<RecurringPurchase[]> {
  const { data } = await apiClient.get<RecurringPurchase[]>('/api/recurring-purchases')
  return data
}

async function createRecurring(payload: CreateRecurringPayload): Promise<RecurringPurchase> {
  const { data } = await apiClient.post<RecurringPurchase>('/api/recurring-purchases', payload)
  return data
}

async function updateRecurringReq(id: number, payload: UpdateRecurringPayload): Promise<RecurringPurchase> {
  const { data } = await apiClient.patch<RecurringPurchase>(`/api/recurring-purchases/${id}`, payload)
  return data
}

async function deleteRecurringReq(id: number): Promise<void> {
  await apiClient.delete(`/api/recurring-purchases/${id}`)
}

export function useRecurringPurchases() {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: recurringKeys.list(activeId),
    queryFn: fetchList,
    staleTime: 60_000,
    enabled: activeId != null,
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (payload: CreateRecurringPayload) => createRecurring(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: recurringKeys.list(activeId) }),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRecurringPayload }) =>
      updateRecurringReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: recurringKeys.list(activeId) }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deleteRecurringReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: recurringKeys.list(activeId) }),
  })
}
