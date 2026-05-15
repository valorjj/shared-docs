import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL, absoluteFileUrl } from '../../lib/files'
import type {
  Attachment,
  CreateNotePayload,
  Note,
  NoteSummary,
  UpdateNotePayload,
} from './types'

// Re-export the shared file helpers so existing callers (NoteEditor,
// NoteEditorBody, NoteAttachmentRow, …) keep importing from this api.ts
// without churn. New code should import directly from src/lib/files.ts.
export { MAX_IMAGE_BYTES, absoluteFileUrl }

export const noteKeys = {
  list: () => ['notes', 'list'] as const,
  attachments: (noteId: number) => ['notes', 'attachments', noteId] as const,
  // Tombstone hydration cache — keyed separately from list so referrer
  // resolves for soft-deleted notes don't poison the active list.
  tombstone: (id: number) => ['notes', 'tombstone', id] as const,
  referrers: (id: number) => ['notes', 'referrers', id] as const,
  trash: () => ['notes', 'trash'] as const,
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

async function fetchNoteIncludingDeletedReq(id: number): Promise<Note> {
  const { data } = await apiClient.get<Note>(`/api/notes/${id}`, {
    params: { includeDeleted: true },
  })
  return data
}

async function fetchReferrersReq(id: number): Promise<NoteSummary[]> {
  const { data } = await apiClient.get<NoteSummary[]>(`/api/notes/${id}/referrers`)
  return data
}

async function fetchTrashReq(): Promise<Note[]> {
  const { data } = await apiClient.get<Note[]>('/api/notes/trash')
  return data
}

async function restoreNoteReq(id: number): Promise<Note> {
  const { data } = await apiClient.post<Note>(`/api/notes/${id}/restore`)
  return data
}

async function deleteForeverReq(id: number): Promise<void> {
  await apiClient.delete(`/api/notes/${id}/forever`)
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.list() })
      qc.invalidateQueries({ queryKey: ['notes', 'referrers'] })
    },
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateNotePayload }) =>
      updateNoteReq(id, payload),
    onSuccess: (updated, vars) => {
      qc.setQueryData<Note[]>(noteKeys.list(), (prev) => {
        if (!prev) return prev
        return prev
          .map((n) => (n.id === updated.id ? updated : n))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt.localeCompare(a.updatedAt)
          })
      })
      // Body edit may have added/removed backlinks — every other note's
      // referrer list could be affected. Coarse invalidation is the
      // simplest correct option; payload counts are small.
      if (vars.payload.body !== undefined) {
        qc.invalidateQueries({ queryKey: ['notes', 'referrers'] })
      }
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteNoteReq(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.list() })
      // Soft-deleted notes survive as tombstones in referrer panels —
      // every existing referrer query may now show a different shell.
      qc.invalidateQueries({ queryKey: ['notes', 'referrers'] })
      qc.invalidateQueries({ queryKey: ['notes', 'tombstone'] })
    },
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

/** Lazily hydrate a soft-deleted note so a NoteLink chip can render its
 *  last-known title as a tombstone. The active list (`useNotes`) filters
 *  deleted rows out, so the chip falls back here when the id isn't present.
 *
 *  retry: false because the most likely failure is a 404 from a hard-
 *  deleted note (DELETE /forever) — retrying gains nothing and would burn
 *  4 round-trips for every chip pointing at a missing id. */
export function useTombstoneNote(id: number | null) {
  return useQuery({
    queryKey: id == null ? [] : noteKeys.tombstone(id),
    queryFn: () => fetchNoteIncludingDeletedReq(id as number),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useNoteReferrers(id: number | null) {
  return useQuery({
    queryKey: id == null ? [] : noteKeys.referrers(id),
    queryFn: () => fetchReferrersReq(id as number),
    enabled: id !== null,
  })
}

/** Soft-deleted notes — feeds the "휴지통" sidebar item and trash list. */
export function useTrashNotes(enabled: boolean = true) {
  return useQuery({
    queryKey: noteKeys.trash(),
    queryFn: fetchTrashReq,
    enabled,
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => restoreNoteReq(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.list() })
      qc.invalidateQueries({ queryKey: noteKeys.trash() })
      qc.invalidateQueries({ queryKey: ['notes', 'referrers'] })
      qc.invalidateQueries({ queryKey: ['notes', 'tombstone'] })
    },
  })
}

export function useDeleteForever() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteForeverReq(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.trash() })
      qc.invalidateQueries({ queryKey: ['notes', 'referrers'] })
      qc.invalidateQueries({ queryKey: ['notes', 'tombstone'] })
    },
  })
}
