export type NoteUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

/** Whether a note is visible to both partners (SHARED, default) or only
 *  its author (PRIVATE). The 2026-05-28 reset replaced the per-note ACL
 *  with this binary — see docs/plans/2026-05-28-personal-shared-notes.md. */
export type NoteVisibility = 'PRIVATE' | 'SHARED'

export type Note = {
  id: number
  title: string | null
  body: string
  pinned: boolean
  visibility: NoteVisibility
  createdBy: NoteUserRef
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type NoteSummary = {
  id: number
  title: string | null
  updatedAt: string
}

export type CreateNotePayload = {
  title?: string | null
  body?: string
  pinned?: boolean
  visibility?: NoteVisibility
}

export type UpdateNotePayload = {
  title?: string | null
  body?: string
  pinned?: boolean
  visibility?: NoteVisibility
}

export type Attachment = {
  id: number
  noteId: number
  originalFilename: string
  contentType: string
  sizeBytes: number
  url: string
  createdAt: string
}
