import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type {
  CreateSheetPayload,
  SheetFull,
  SheetSummary,
  UpdateSheetPayload,
} from './types'

export const sheetKeys = {
  scope: (wsId: number | null) => ['sheets', wsId] as const,
  list: (wsId: number | null) => ['sheets', wsId, 'list'] as const,
  detail: (wsId: number | null, id: number) => ['sheets', wsId, 'detail', id] as const,
}

async function fetchSheets(): Promise<SheetSummary[]> {
  const { data } = await apiClient.get<SheetSummary[]>('/api/sheets')
  return data
}

async function fetchSheet(id: number): Promise<SheetFull> {
  const { data } = await apiClient.get<SheetFull>(`/api/sheets/${id}`)
  return data
}

async function createSheetReq(payload: CreateSheetPayload): Promise<SheetFull> {
  const { data } = await apiClient.post<SheetFull>('/api/sheets', payload)
  return data
}

async function updateSheetReq(id: number, payload: UpdateSheetPayload): Promise<SheetFull> {
  const { data } = await apiClient.patch<SheetFull>(`/api/sheets/${id}`, payload)
  return data
}

async function deleteSheetReq(id: number): Promise<void> {
  await apiClient.delete(`/api/sheets/${id}`)
}

export function useSheets() {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: sheetKeys.list(activeId),
    queryFn: fetchSheets,
    enabled: activeId != null,
  })
}

export function useSheet(id: number | null) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: sheetKeys.detail(activeId, id ?? 0),
    queryFn: () => fetchSheet(id as number),
    enabled: id !== null && activeId != null,
  })
}

export function useCreateSheet() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (payload: CreateSheetPayload) => createSheetReq(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: sheetKeys.list(activeId) })
      qc.setQueryData(sheetKeys.detail(activeId, created.id), created)
    },
  })
}

export function useUpdateSheet() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSheetPayload }) =>
      updateSheetReq(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(sheetKeys.detail(activeId, updated.id), updated)
      qc.setQueryData<SheetSummary[]>(sheetKeys.list(activeId), (prev) => {
        if (!prev) return prev
        const summary: SheetSummary = {
          id: updated.id,
          title: updated.title,
          pinned: updated.pinned,
          createdBy: updated.createdBy,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        }
        return prev
          .map((s) => (s.id === updated.id ? summary : s))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt.localeCompare(a.updatedAt)
          })
      })
    },
  })
}

export function useDeleteSheet() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deleteSheetReq(id),
    onSuccess: (_v, id) => {
      qc.invalidateQueries({ queryKey: sheetKeys.list(activeId) })
      qc.removeQueries({ queryKey: sheetKeys.detail(activeId, id) })
    },
  })
}
