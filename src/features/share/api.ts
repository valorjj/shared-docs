import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { apiClient } from '../../api/client'
import type {
  CreateSharePayload,
  PublicLink,
  PublicNoteView,
  ResourceKind,
  Share,
  UpdateSharePayload,
} from './types'

export const shareKeys = {
  list: (kind: ResourceKind, id: number) => ['shares', kind, id] as const,
  publicLink: (kind: ResourceKind, id: number) => ['shares', kind, id, 'public-link'] as const,
  publicNote: (id: number, token: string) => ['public', 'notes', id, token] as const,
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

// ── Public link (Phase D) ────────────────────────────────────────────

async function getPublicLinkReq(kind: ResourceKind, id: number): Promise<PublicLink | null> {
  try {
    const { data } = await apiClient.get<PublicLink>(`/api/${kind}/${id}/public-link`)
    return data
  } catch (e) {
    // 404 = no active link, which is a normal state (toggle off). We
    // map it to null so the UI can render "Generate" without throwing.
    if (axios.isAxiosError(e) && e.response?.status === 404) return null
    throw e
  }
}

async function createPublicLinkReq(kind: ResourceKind, id: number): Promise<PublicLink> {
  const { data } = await apiClient.post<PublicLink>(`/api/${kind}/${id}/public-link`)
  return data
}

async function rotatePublicLinkReq(kind: ResourceKind, id: number): Promise<PublicLink> {
  const { data } = await apiClient.post<PublicLink>(`/api/${kind}/${id}/public-link/rotate`)
  return data
}

async function revokePublicLinkReq(kind: ResourceKind, id: number): Promise<void> {
  await apiClient.delete(`/api/${kind}/${id}/public-link`)
}

export function usePublicLink(kind: ResourceKind, id: number | null) {
  return useQuery({
    queryKey: id !== null ? shareKeys.publicLink(kind, id) : ['shares', kind, 'public-link', 'noop'],
    queryFn: () => getPublicLinkReq(kind, id as number),
    enabled: id !== null,
  })
}

export function useCreatePublicLink(kind: ResourceKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => createPublicLinkReq(kind, id),
    onSuccess: (link) => qc.setQueryData(shareKeys.publicLink(kind, id), link),
  })
}

export function useRotatePublicLink(kind: ResourceKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => rotatePublicLinkReq(kind, id),
    onSuccess: (link) => qc.setQueryData(shareKeys.publicLink(kind, id), link),
  })
}

export function useRevokePublicLink(kind: ResourceKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => revokePublicLinkReq(kind, id),
    onSuccess: () => qc.setQueryData(shareKeys.publicLink(kind, id), null),
  })
}

// ── Guest viewer (Phase D) ───────────────────────────────────────────

/**
 * Anonymous fetch of a publicly-shared note. Uses a bare axios call
 * (NOT `apiClient`) so we don't accidentally send the caller's JWT —
 * the endpoint is unauthenticated and must remain so, otherwise the
 * server's permitAll rule for /api/public/** is moot.
 */
export function usePublicNote(id: number | null, token: string | null) {
  const baseURL = (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env
    .VITE_API_BASE_URL ?? 'http://localhost:8090'
  return useQuery({
    queryKey: id !== null && token ? shareKeys.publicNote(id, token) : ['public', 'noop'],
    queryFn: async () => {
      const { data } = await axios.get<PublicNoteView>(`${baseURL}/api/public/notes/${id}`, {
        params: { token },
      })
      return data
    },
    enabled: id !== null && !!token,
    retry: false,
    staleTime: 60 * 1000,
  })
}
