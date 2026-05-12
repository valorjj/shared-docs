import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type CommentAuthor = {
  userId: number | null     // null for legacy pre-auth comments
  name: string
  pictureUrl: string | null
}

export type Comment = {
  id: number
  pageId: string
  author: CommentAuthor
  content: string
  createdAt: string
  updatedAt: string
}

export type CreateCommentRequest = {
  pageId: string
  content: string
}

export type UpdateCommentRequest = {
  content: string
}

export const commentKeys = {
  all: ['comments'] as const,
  byPage: (pageId: string) => ['comments', pageId] as const,
}

async function listComments(pageId: string): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>('/api/comments', { params: { pageId } })
  return data
}

async function createComment(request: CreateCommentRequest): Promise<Comment> {
  const { data } = await apiClient.post<Comment>('/api/comments', request)
  return data
}

async function updateComment(id: number, request: UpdateCommentRequest): Promise<Comment> {
  const { data } = await apiClient.patch<Comment>(`/api/comments/${id}`, request)
  return data
}

async function deleteComment(id: number): Promise<void> {
  await apiClient.delete(`/api/comments/${id}`)
}

export function useComments(pageId: string) {
  return useQuery({
    queryKey: commentKeys.byPage(pageId),
    queryFn: () => listComments(pageId),
    enabled: !!pageId,
  })
}

export function useCreateComment(pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request: Omit<CreateCommentRequest, 'pageId'>) =>
      createComment({ ...request, pageId }),
    onSuccess: (created) => {
      qc.setQueryData<Comment[]>(commentKeys.byPage(pageId), (prev) =>
        prev ? [...prev, created] : [created],
      )
    },
  })
}

export function useUpdateComment(pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateComment(id, { content }),
    onSuccess: (updated) => {
      qc.setQueryData<Comment[]>(commentKeys.byPage(pageId), (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)) ?? [updated],
      )
    },
  })
}

export function useDeleteComment(pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Comment[]>(commentKeys.byPage(pageId), (prev) =>
        prev?.filter((c) => c.id !== id) ?? [],
      )
    },
  })
}
