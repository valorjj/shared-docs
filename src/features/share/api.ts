import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type {
  CreateSharePayload,
  ResourceKind,
  Share,
  UpdateSharePayload,
} from './types'

export const shareKeys = {
  list: (kind: ResourceKind, id: number) => ['shares', kind, id] as const,
}

async function listSharesReq(kind: ResourceKind, id: number): Promise<Share[]> {
  const { data } = await apiClient.get<Share[]>(`/api/${kind}/${id}/shares`)
  return data
}

async function createShareReq(
  kind: ResourceKind,
  id: number,
  payload: CreateSharePayload,
): Promise<Share> {
  const { data } = await apiClient.post<Share>(`/api/${kind}/${id}/shares`, payload)
  return data
}

async function updateShareReq(
  kind: ResourceKind,
  id: number,
  shareId: number,
  payload: UpdateSharePayload,
): Promise<Share> {
  const { data } = await apiClient.patch<Share>(`/api/${kind}/${id}/shares/${shareId}`, payload)
  return data
}

async function deleteShareReq(
  kind: ResourceKind,
  id: number,
  shareId: number,
): Promise<void> {
  await apiClient.delete(`/api/${kind}/${id}/shares/${shareId}`)
}

export function useShares(kind: ResourceKind, id: number | null) {
  return useQuery({
    queryKey: id !== null ? shareKeys.list(kind, id) : ['shares', kind, 'noop'],
    queryFn: () => listSharesReq(kind, id as number),
    enabled: id !== null,
  })
}

export function useCreateShare(kind: ResourceKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSharePayload) => createShareReq(kind, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.list(kind, id) }),
  })
}

export function useUpdateShare(kind: ResourceKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, payload }: { shareId: number; payload: UpdateSharePayload }) =>
      updateShareReq(kind, id, shareId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.list(kind, id) }),
  })
}

export function useDeleteShare(kind: ResourceKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: number) => deleteShareReq(kind, id, shareId),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.list(kind, id) }),
  })
}
