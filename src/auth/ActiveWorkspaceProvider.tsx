import { useCallback, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspaces, type Workspace } from '../api/workspaces'
import { useAuth } from './useAuth'
import { clearActiveWorkspaceId, getActiveWorkspaceId, setActiveWorkspaceId } from './workspaceStorage'
import { ActiveWorkspaceContext } from './workspaceContext'

/**
 * Owns "which workspace am I looking at". Mounted above the app (inside
 * AuthProvider + QueryClientProvider). When signed out it's a transparent
 * passthrough (ready=true, no gating). When signed in it loads the user's
 * workspaces and resolves the active one as: explicit switch → last stored →
 * first workspace.
 *
 * The resolved id is written to localStorage *synchronously during render*
 * (not in an effect): the axios interceptor reads it outside React on the very
 * resource requests this provider is about to unblock, so the value must be in
 * storage before those requests fire. The write is idempotent and fully
 * derived from query data, so it's safe under StrictMode's double-render and
 * never triggers a re-render loop.
 */
export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: workspaces = [], isLoading } = useWorkspaces(!!user)

  let active: Workspace | null = null
  let ready = true

  if (user) {
    if (isLoading) {
      ready = false
    } else {
      const stored = getActiveWorkspaceId()
      active =
        workspaces.find((w) => w.id === stored) ??
        workspaces[0] ??
        null
      ready = true
      if (active) {
        // Keep storage in sync with the resolved workspace (also overwrites a
        // stale stored id that pointed at a workspace no longer in the list).
        if (getActiveWorkspaceId() !== active.id) setActiveWorkspaceId(active.id)
      } else if (getActiveWorkspaceId() != null) {
        // No resolvable workspace, but a stale id is still stored — drop it so
        // the axios interceptor stops attaching a now-invalid X-Workspace-Id
        // (which the backend 403s) to resource requests.
        clearActiveWorkspaceId()
      }
    }
  }

  const setActiveId = useCallback(
    (id: number) => {
      setActiveWorkspaceId(id)
      // Query keys aren't workspace-scoped, so the previous workspace's cached
      // data would otherwise leak in until each query refetched. Dropping the
      // cache forces a clean refetch under the new X-Workspace-Id header.
      queryClient.clear()
    },
    [queryClient],
  )

  const value = useMemo(
    () => ({
      workspaces,
      active,
      activeId: active?.id ?? null,
      setActiveId,
      ready,
    }),
    [workspaces, active, setActiveId, ready],
  )

  return <ActiveWorkspaceContext.Provider value={value}>{children}</ActiveWorkspaceContext.Provider>
}
