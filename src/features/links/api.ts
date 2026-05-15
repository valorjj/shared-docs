import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

export type UsefulLinkUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type UsefulLink = {
  id: number
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  faviconUrl: string | null
  siteName: string | null
  note: string | null
  pinned: boolean
  category: string
  createdBy: UsefulLinkUserRef
  createdAt: string
  updatedAt: string
}

export type UsefulLinkCategory = {
  id: number
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  active: boolean
}

export type UsefulLinkPreview = {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  faviconUrl: string | null
  siteName: string | null
}

export type CreateUsefulLinkPayload = {
  url: string
  title?: string | null
  description?: string | null
  imageUrl?: string | null
  faviconUrl?: string | null
  siteName?: string | null
  note?: string | null
  pinned?: boolean
  category: string
}

export type UpdateUsefulLinkPayload = {
  title?: string | null
  description?: string | null
  imageUrl?: string | null
  siteName?: string | null
  note?: string | null
  pinned?: boolean
  category?: string
}

export const linkKeys = {
  list: () => ['links', 'list'] as const,
  categories: () => ['link-categories'] as const,
  preview: (url: string) => ['links', 'preview', url] as const,
}

async function fetchLinks(): Promise<UsefulLink[]> {
  const { data } = await apiClient.get<UsefulLink[]>('/api/links')
  return data
}

async function fetchLinkCategories(): Promise<UsefulLinkCategory[]> {
  const { data } = await apiClient.get<UsefulLinkCategory[]>('/api/link-categories')
  return data
}

async function previewLinkReq(url: string): Promise<UsefulLinkPreview> {
  const { data } = await apiClient.post<UsefulLinkPreview>('/api/links/preview', { url })
  return data
}

async function createLinkReq(payload: CreateUsefulLinkPayload): Promise<UsefulLink> {
  const { data } = await apiClient.post<UsefulLink>('/api/links', payload)
  return data
}

async function updateLinkReq(id: number, payload: UpdateUsefulLinkPayload): Promise<UsefulLink> {
  const { data } = await apiClient.patch<UsefulLink>(`/api/links/${id}`, payload)
  return data
}

async function refreshLinkMetaReq(id: number): Promise<UsefulLink> {
  const { data } = await apiClient.post<UsefulLink>(`/api/links/${id}/refresh-meta`)
  return data
}

async function deleteLinkReq(id: number): Promise<void> {
  await apiClient.delete(`/api/links/${id}`)
}

export function useUsefulLinks() {
  return useQuery({ queryKey: linkKeys.list(), queryFn: fetchLinks })
}

export function useUsefulLinkCategories() {
  return useQuery({
    queryKey: linkKeys.categories(),
    queryFn: fetchLinkCategories,
    // Categories rarely change at runtime; admin-curated.
    staleTime: 10 * 60 * 1000,
  })
}

/** Fetches the OG preview for a URL. Disabled until the caller hands a
 *  non-empty URL — the LinkAddModal flips it on after debounce. */
export function useLinkPreview(url: string, enabled: boolean) {
  return useQuery({
    queryKey: linkKeys.preview(url),
    queryFn: () => previewLinkReq(url),
    enabled: enabled && url.length > 0,
    // Most URLs won't change their OG within a single session — keep
    // the preview around so re-typing the same URL doesn't re-fetch.
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useCreateUsefulLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUsefulLinkPayload) => createLinkReq(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.list() }),
  })
}

export function useUpdateUsefulLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUsefulLinkPayload }) =>
      updateLinkReq(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData<UsefulLink[]>(linkKeys.list(), (prev) => {
        if (!prev) return prev
        return prev
          .map((l) => (l.id === updated.id ? updated : l))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt.localeCompare(a.updatedAt)
          })
      })
    },
  })
}

export function useRefreshLinkMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => refreshLinkMetaReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.list() }),
  })
}

export function useDeleteUsefulLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteLinkReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.list() }),
  })
}
