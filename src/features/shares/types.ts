import type { Note } from '../notes/types'

export type SharePermission = 'VIEW' | 'EDIT'

export type Share = {
  grantedToUserId: number
  recipientName: string
  recipientEmail: string
  permission: SharePermission
  createdAt: string
}

export type SharedNoteSummary = {
  noteId: number
  title: string | null
  ownerName: string
  permission: SharePermission
  sharedAt: string
}

export type SharedNoteResponse = {
  note: Note
  effectivePermission: SharePermission
}

export type GrantSharePayload = { email: string; permission: SharePermission }
export type UpdateSharePayload = { permission: SharePermission }
