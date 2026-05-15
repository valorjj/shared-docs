export type NoteUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type Note = {
  id: number
  title: string | null
  body: string
  pinned: boolean
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
