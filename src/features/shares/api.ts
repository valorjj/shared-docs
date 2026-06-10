import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type {
  GrantSharePayload, Share, SharedNoteResponse, SharedNoteSummary, UpdateSharePayload,
} from './types'

export const shareKeys = {
  root: ['shares'] as const,
  sharedWithMe: ['shares', 'with-me'] as const,
  sharedNote: (noteId: number) => ['shares', 'note', noteId] as const,
  grants: (noteId: number) => ['shares', 'grants', noteId] as const,
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: shareKeys.sharedWithMe,
    queryFn: async () => (await apiClient.get<SharedNoteSummary[]>('/api/shares')).data,
  })
}

export function useSharedNote(noteId: number) {
  return useQuery({
    queryKey: shareKeys.sharedNote(noteId),
    queryFn: async () => (await apiClient.get<SharedNoteResponse>(`/api/shares/notes/${noteId}`)).data,
  })
}

export function useUpdateSharedNote(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { title?: string; body?: string }) =>
      (await apiClient.patch<SharedNoteResponse>(`/api/shares/notes/${noteId}`, body)).data,
    onSuccess: (data) => qc.setQueryData(shareKeys.sharedNote(noteId), data),
  })
}

export function useNoteShares(noteId: number, enabled = true) {
  return useQuery({
    queryKey: shareKeys.grants(noteId),
    queryFn: async () => (await apiClient.get<Share[]>(`/api/notes/${noteId}/shares`)).data,
    enabled,
  })
}

export function useGrantShare(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: GrantSharePayload) =>
      (await apiClient.post<Share>(`/api/notes/${noteId}/shares`, p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.grants(noteId) }),
  })
}

export function useUpdateGrant(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { recipientId: number; payload: UpdateSharePayload }) =>
      (await apiClient.patch<Share>(`/api/notes/${noteId}/shares/${v.recipientId}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.grants(noteId) }),
  })
}

export function useRevokeShare(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (recipientId: number) => {
      await apiClient.delete(`/api/notes/${noteId}/shares/${recipientId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.grants(noteId) }),
  })
}
