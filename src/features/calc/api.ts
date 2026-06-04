import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type { CalcEntry, CalcMode } from './types'

export const calcKeys = {
  scope: (wsId: number | null) => ['calc', wsId] as const,
  list: (wsId: number | null) => ['calc', wsId, 'list'] as const,
  detail: (wsId: number | null, id: number) => ['calc', wsId, 'detail', id] as const,
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
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: calcKeys.list(activeId),
    queryFn: fetchCalcEntries,
    enabled: activeId != null,
  })
}

export function useCalcEntry(id: number | null) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: calcKeys.detail(activeId, id ?? -1),
    queryFn: () => fetchCalcEntry(id as number),
    enabled: activeId != null && id !== null && id >= 0,
  })
}

export function useCreateCalcEntry() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: createCalcEntryReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.scope(activeId) }),
  })
}

export function useUpdateCalcEntry() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { label?: string | null; pinned?: boolean } }) =>
      updateCalcEntryReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.scope(activeId) }),
  })
}

export function useDeleteCalcEntry() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: deleteCalcEntryReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.scope(activeId) }),
  })
}
