/** Mirror of backend `com.shareddocs.backend.share.ResourceKind.slug`. */
export type ResourceKind =
  | 'notes'
  | 'sheets'
  | 'purchases'
  | 'todos'
  | 'anniversaries'
  | 'recipes'
  | 'links'

export type SharePermission = 'VIEW' | 'EDIT'

export type Share = {
  id: number
  resourceKind: string
  resourceId: number
  /** Null while the invite is still pending (recipient hasn't signed in). */
  userId: number | null
  email: string
  name: string | null
  pictureUrl: string | null
  permission: SharePermission
  createdAt: string
  pending: boolean
}

export type CreateSharePayload = {
  email: string
  permission: SharePermission
}

export type UpdateSharePayload = {
  permission: SharePermission
}

/** Owner-side view of the current public link for a resource. */
export type PublicLink = {
  token: string
  /** Fully-qualified URL the owner copies + shares. */
  url: string
  createdAt: string
  expiresAt: string | null
}

/** Public read-only view of a note (Phase D). Returned by
 *  `GET /api/public/notes/:id?token=...` to anonymous callers. */
export type PublicNoteView = {
  id: number
  title: string | null
  body: string
  createdBy: { userId: number; name: string; pictureUrl: string | null }
  createdAt: string
  updatedAt: string
}
