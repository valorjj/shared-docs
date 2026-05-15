import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type {
  Attachment,
  CreateNotePayload,
  Note,
  UpdateNotePayload,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

/** Client-side per-image upload cap. Server has its own multipart limit
 *  in application.yml as a backstop; this exists for friendly UX so the
 *  request never leaves the browser when an image is too large. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_IMAGE_LABEL = '5MB'

export const noteKeys = {
  list: () => ['notes', 'list'] as const,
  attachments: (noteId: number) => ['notes', 'attachments', noteId] as const,
}

/** Backend serves file URLs as relative paths (`/files/...`). Compose to absolute. */
export function absoluteFileUrl(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  return `${API_BASE}${relativeOrAbsolute}`
}

async function fetchNotes(): Promise<Note[]> {
  const { data } = await apiClient.get<Note[]>('/api/notes')
  return data
}

async function createNoteReq(payload: CreateNotePayload): Promise<Note> {
  const { data } = await apiClient.post<Note>('/api/notes', payload)
  return data
}

async function updateNoteReq(id: number, payload: UpdateNotePayload): Promise<Note> {
  const { data } = await apiClient.patch<Note>(`/api/notes/${id}`, payload)
  return data
}

async function deleteNoteReq(id: number): Promise<void> {
  await apiClient.delete(`/api/notes/${id}`)
}

async function listAttachmentsReq(noteId: number): Promise<Attachment[]> {
  const { data } = await apiClient.get<Attachment[]>(`/api/notes/${noteId}/attachments`)
  return data
}

async function uploadAttachmentReq(noteId: number, file: File): Promise<Attachment> {
  if (file.type.startsWith('image/') && file.size > MAX_IMAGE_BYTES) {
    throw new Error(`이미지는 ${MAX_IMAGE_LABEL} 이하만 첨부할 수 있어요.`)
  }
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<Attachment>(
    `/api/notes/${noteId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

async function deleteAttachmentReq(id: number): Promise<void> {
  await apiClient.delete(`/api/attachments/${id}`)
}

export function useNotes() {
  return useQuery({ queryKey: noteKeys.list(), queryFn: fetchNotes })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateNotePayload) => createNoteReq(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.list() }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateNotePayload }) =>
      updateNoteReq(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData<Note[]>(noteKeys.list(), (prev) => {
        if (!prev) return prev
        return prev
          .map((n) => (n.id === updated.id ? updated : n))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt.localeCompare(a.updatedAt)
          })
      })
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteNoteReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.list() }),
  })
}

export function useAttachments(noteId: number | null) {
  return useQuery({
    queryKey: noteKeys.attachments(noteId ?? 0),
    queryFn: () => listAttachmentsReq(noteId as number),
    enabled: noteId !== null,
  })
}

export function useUploadAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, file }: { noteId: number; file: File }) =>
      uploadAttachmentReq(noteId, file),
    onSuccess: (att) => {
      qc.invalidateQueries({ queryKey: noteKeys.attachments(att.noteId) })
    },
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number; noteId: number }) => deleteAttachmentReq(id),
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({ queryKey: noteKeys.attachments(vars.noteId) })
    },
  })
}
