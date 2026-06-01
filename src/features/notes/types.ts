export type NoteUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

/** Whether a note is visible to every member of its workspace (WORKSPACE,
 *  default) or only its author (PRIVATE). Renamed from SHARED → WORKSPACE in v2
 *  (the "group" is now the workspace). Must match backend Visibility. */
export type NoteVisibility = 'PRIVATE' | 'WORKSPACE'

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
