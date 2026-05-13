import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

export type SettlementUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type SettlementRecord = {
  id: number
  yearMonth: string        // YYYY-MM
  currency: string
  payer: SettlementUserRef
  recipient: SettlementUserRef
  amount: number
  note: string | null
  recordedBy: SettlementUserRef
  settledAt: string        // ISO timestamp
}

export type CreateSettlementPayload = {
  yearMonth: string
  currency: string
  payerUserId: number
  recipientUserId: number
  amount: number
  note?: string | null
}

export const settlementKeys = {
  list: (yearMonth: string) => ['settlements', 'list', yearMonth] as const,
}

async function fetchList(yearMonth: string): Promise<SettlementRecord[]> {
  const { data } = await apiClient.get<SettlementRecord[]>('/api/settlements', {
    params: { yearMonth },
  })
  return data
}

async function createSettlement(payload: CreateSettlementPayload): Promise<SettlementRecord> {
  const { data } = await apiClient.post<SettlementRecord>('/api/settlements', payload)
  return data
}

async function deleteSettlementReq(id: number): Promise<void> {
  await apiClient.delete(`/api/settlements/${id}`)
}

export function useSettlements(yearMonth: string) {
  return useQuery({
    queryKey: settlementKeys.list(yearMonth),
    queryFn: () => fetchList(yearMonth),
    enabled: !!yearMonth,
  })
}

export function useCreateSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSettlementPayload) => createSettlement(payload),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: settlementKeys.list(vars.yearMonth) }),
  })
}

export function useDeleteSettlement(yearMonth: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteSettlementReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settlementKeys.list(yearMonth) }),
  })
}
