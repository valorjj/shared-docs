import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useWorkspaces, type Workspace } from '../api/workspaces'
import { useAuth } from './useAuth'
import { clearActiveWorkspaceId, getActiveWorkspaceId, setActiveWorkspaceId } from './workspaceStorage'
import { ActiveWorkspaceContext } from './workspaceContext'

/**
 * Owns "which workspace am I looking at". Mounted above the app (inside
 * AuthProvider + QueryClientProvider). When signed out it's a transparent
 * passthrough (ready=true, no gating). When signed in it loads the user's
 * workspaces and resolves the active one as: explicit intent → last stored →
 * first workspace.
 *
 * The selected id is React state (`intentId`) so switching is reactive — a
 * switch re-renders the provider and recomputes `active` from the already-loaded
 * list, with no refetch needed for the switch itself. The resolved id is also
 * written to localStorage *synchronously during render* (not in an effect)
 * because the axios interceptor reads it outside React on the resource requests
 * this provider unblocks, so it must be in storage before those fire. The write
 * is idempotent and derived from query data, so it's StrictMode-safe and never
 * loops.
 */
export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data: workspaces = [], isLoading } = useWorkspaces(!!user)

  // The user's selection intent. Seeded from storage; updated by setActiveId.
  const [intentId, setIntentId] = useState<number | null>(() => getActiveWorkspaceId())

  let active: Workspace | null = null
  let ready = true

  if (user) {
    if (isLoading) {
      ready = false
    } else {
      active =
        workspaces.find((w) => w.id === intentId) ??
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
      setActiveWorkspaceId(id) // persist for the interceptor + next reload
      // Reactive switch: re-render recomputes `active` AND re-scopes every
      // resource query key to the new workspace (keys now include the workspace
      // id), so React Query mounts the new workspace's queries and fetches them
      // automatically — while serving cached data instantly on switch-back. No
      // manual cache reset needed.
      setIntentId(id)
    },
    [setIntentId],
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
