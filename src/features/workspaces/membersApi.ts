import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { workspaceKeys, type Workspace } from '../../api/workspaces'

// Mirrors backend workspace/WorkspaceDto.kt + invitation/InvitationDto.kt.
export type WorkspaceRole = 'OWNER' | 'MEMBER'

export type WorkspaceMember = {
  userId: number
  name: string
  email: string
  pictureUrl: string | null
  role: WorkspaceRole
  joinedAt: string
}

export type Invitation = {
  id: number
  email: string
  token: string
  inviteUrl: string
  expiresAt: string
  createdAt: string
}

export type InvitationStatus = 'OK' | 'EXPIRED' | 'CLAIMED'

export type InvitationPreview = {
  workspaceName: string
  inviterName: string
  email: string
  status: InvitationStatus
}

/**
 * sessionStorage key holding an invite token across the Google OAuth round-trip.
 * Set by the `/invite/:token` page when an unauthenticated visitor must sign in
 * first; read by AuthCallback to route them back to the claim screen.
 */
export const PENDING_INVITE_KEY = 'shared-docs.pendingInviteToken'

export const memberKeys = {
  members: (wsId: number | null) => ['ws-members', wsId] as const,
  invitations: (wsId: number | null) => ['ws-invitations', wsId] as const,
  invitePreview: (token: string) => ['invite-preview', token] as const,
}

// ── Members ────────────────────────────────────────────────────────────────

export function useMembers(workspaceId: number | null) {
  return useQuery({
    queryKey: memberKeys.members(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`)
      return data
    },
    enabled: workspaceId != null,
  })
}

export function useRemoveMember(workspaceId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: number) => {
      await apiClient.delete(`/api/workspaces/${workspaceId}/members/${userId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.members(workspaceId) }),
  })
}

export function useLeaveWorkspace(workspaceId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.post(`/api/workspaces/${workspaceId}/leave`)
    },
    // Membership changed — refresh the workspace list (the switcher + provider
    // resolve the active workspace from it).
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  })
}

// ── Invitations (owner) ──────────────────────────────────────────────────────

export function useInvitations(workspaceId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: memberKeys.invitations(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get<Invitation[]>(`/api/workspaces/${workspaceId}/invitations`)
      return data
    },
    enabled: workspaceId != null && enabled,
  })
}

export function useCreateInvitation(workspaceId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post<Invitation>(`/api/workspaces/${workspaceId}/invitations`, { email })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.invitations(workspaceId) }),
  })
}

export function useRevokeInvitation(workspaceId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: number) => {
      await apiClient.delete(`/api/workspaces/${workspaceId}/invitations/${invitationId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.invitations(workspaceId) }),
  })
}

// ── Claim (invitee) ──────────────────────────────────────────────────────────

export function useInvitePreview(token: string, enabled: boolean) {
  return useQuery({
    queryKey: memberKeys.invitePreview(token),
    queryFn: async () => {
      const { data } = await apiClient.get<InvitationPreview>(`/api/invitations/${token}`)
      return data
    },
    // Gated on auth as well — an unauthenticated visitor is mid-redirect to
    // Google, so firing this would just 401 and bounce them to /login.
    enabled: !!token && enabled,
    retry: false, // a 404/expired shouldn't be retried — show the state immediately
  })
}

export function useClaimInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiClient.post<Workspace>(`/api/invitations/${token}/claim`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  })
}
