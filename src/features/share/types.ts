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
