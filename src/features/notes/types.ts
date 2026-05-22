export type NoteUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

/** Caller's effective access on a single note, set server-side from
 *  `AccessControl.permissionFor`. Drives the editor's read-only switch.
 *  OWNER = creator; EDIT = share with EDIT permission; VIEW = share
 *  with VIEW permission (read-only). */
export type NotePermission = 'OWNER' | 'EDIT' | 'VIEW'

export type Note = {
  id: number
  title: string | null
  body: string
  pinned: boolean
  createdBy: NoteUserRef
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  myPermission: NotePermission
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
}

export type UpdateNotePayload = {
  title?: string | null
  body?: string
  pinned?: boolean
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
