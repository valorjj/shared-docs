import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// Mirrors the backend WorkspaceResponse (workspace/WorkspaceDto.kt).
export type Workspace = {
  id: number
  name: string
  slug: string
  createdByUserId: number
  createdAt: string
}

export type CreateWorkspacePayload = {
  name: string
  // Optional — the server generates one when omitted (slug isn't user-facing).
  slug?: string
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data } = await apiClient.get<Workspace[]>('/api/workspaces')
  return data
}

async function createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace> {
  const { data } = await apiClient.post<Workspace>('/api/workspaces', payload)
  return data
}

/** The workspaces the signed-in user belongs to. Enabled only when authed so it
 *  doesn't fire on the login screen. */
export function useWorkspaces(enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: fetchWorkspaces,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  })
}
