import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type { CalcEntry, CalcMode } from './types'

export const calcKeys = {
  list: () => ['calc', 'list'] as const,
  detail: (id: number) => ['calc', 'detail', id] as const,
}

async function fetchCalcEntries(): Promise<CalcEntry[]> {
  const { data } = await apiClient.get<CalcEntry[]>('/api/calc')
  return data
}

async function fetchCalcEntry(id: number): Promise<CalcEntry> {
  const { data } = await apiClient.get<CalcEntry>(`/api/calc/${id}`)
  return data
}

type CreatePayload = {
  mode: CalcMode
  inputJson: string
  resultJson: string
  label?: string | null
}

async function createCalcEntryReq(payload: CreatePayload): Promise<CalcEntry> {
  const { data } = await apiClient.post<CalcEntry>('/api/calc', payload)
  return data
}

async function updateCalcEntryReq(
  id: number,
  payload: { label?: string | null; pinned?: boolean },
): Promise<CalcEntry> {
  const { data } = await apiClient.patch<CalcEntry>(`/api/calc/${id}`, payload)
  return data
}

async function deleteCalcEntryReq(id: number): Promise<void> {
  await apiClient.delete(`/api/calc/${id}`)
}

export function useCalcEntries() {
  return useQuery({ queryKey: calcKeys.list(), queryFn: fetchCalcEntries })
}

export function useCalcEntry(id: number | null) {
  return useQuery({
    queryKey: calcKeys.detail(id ?? -1),
    queryFn: () => fetchCalcEntry(id as number),
    enabled: id !== null && id >= 0,
  })
}

export function useCreateCalcEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCalcEntryReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.list() }),
  })
}

export function useUpdateCalcEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { label?: string | null; pinned?: boolean } }) =>
      updateCalcEntryReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.list() }),
  })
}

export function useDeleteCalcEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCalcEntryReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.list() }),
  })
}
