import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
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
  // Workspace-scoped: prefix for invalidating all of a workspace's note queries.
  scope: (wsId: number | null) => ['notes', wsId] as const,
  list: (wsId: number | null) => ['notes', wsId, 'list'] as const,
  attachments: (wsId: number | null, noteId: number) =>
    ['notes', wsId, 'attachments', noteId] as const,
  // Tombstone hydration cache — keyed separately from list so referrer
  // resolves for soft-deleted notes don't poison the active list.
  tombstone: (wsId: number | null, id: number) => ['notes', wsId, 'tombstone', id] as const,
  referrers: (wsId: number | null, id: number) => ['notes', wsId, 'referrers', id] as const,
  trash: (wsId: number | null) => ['notes', wsId, 'trash'] as const,
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
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: noteKeys.list(activeId),
    queryFn: fetchNotes,
    enabled: activeId != null,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (payload: CreateNotePayload) => createNoteReq(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.scope(activeId) })
    },
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateNotePayload }) =>
      updateNoteReq(id, payload),
    onSuccess: (updated, vars) => {
      qc.setQueryData<Note[]>(noteKeys.list(activeId), (prev) => {
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
      // simplest correct option; payload counts are small. Scoped to the
      // active workspace's referrer queries so the optimistic list update
      // above survives.
      if (vars.payload.body !== undefined) {
        qc.invalidateQueries({ queryKey: ['notes', activeId, 'referrers'] })
      }
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deleteNoteReq(id),
    onSuccess: () => {
      // Broad scope invalidation covers list, trash (sidebar badge),
      // referrers, and tombstone in one shot — can't miss a subkey.
      // Trash counter in the sidebar updates without waiting for a visit;
      // referrer/tombstone panels re-resolve the new soft-deleted shell.
      qc.invalidateQueries({ queryKey: noteKeys.scope(activeId) })
    },
  })
}

export function useAttachments(noteId: number | null) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: noteKeys.attachments(activeId, noteId ?? 0),
    queryFn: () => listAttachmentsReq(noteId as number),
    enabled: noteId !== null && activeId != null,
  })
}

export function useUploadAttachment() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ noteId, file }: { noteId: number; file: File }) =>
      uploadAttachmentReq(noteId, file),
    onSuccess: (att) => {
      qc.invalidateQueries({ queryKey: noteKeys.attachments(activeId, att.noteId) })
    },
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id }: { id: number; noteId: number }) => deleteAttachmentReq(id),
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({ queryKey: noteKeys.attachments(activeId, vars.noteId) })
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
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: id == null ? [] : noteKeys.tombstone(activeId, id),
    queryFn: () => fetchNoteIncludingDeletedReq(id as number),
    enabled: id !== null && activeId != null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useNoteReferrers(id: number | null) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: id == null ? [] : noteKeys.referrers(activeId, id),
    queryFn: () => fetchReferrersReq(id as number),
    enabled: id !== null && activeId != null,
  })
}

/** Soft-deleted notes — feeds the "휴지통" sidebar item and trash list.
 *  Always enabled so the sidebar count updates instantly after a delete.
 *  Previously gated on `filter.kind === 'trash'`, but the lazy version
 *  showed a stale "0" on the badge until the user visited trash. */
export function useTrashNotes() {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: noteKeys.trash(activeId),
    queryFn: fetchTrashReq,
    enabled: activeId != null,
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => restoreNoteReq(id),
    onSuccess: () => {
      // Broad scope covers list, trash, referrers, and tombstone at once.
      qc.invalidateQueries({ queryKey: noteKeys.scope(activeId) })
    },
  })
}

export function useDeleteForever() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deleteForeverReq(id),
    onSuccess: () => {
      // Broad scope covers trash, referrers, and tombstone at once.
      qc.invalidateQueries({ queryKey: noteKeys.scope(activeId) })
    },
  })
}
