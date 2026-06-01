import { createContext } from 'react'
import type { Workspace } from '../api/workspaces'

export type ActiveWorkspaceValue = {
  // The user's workspaces (empty until loaded / when signed out).
  workspaces: Workspace[]
  // The currently-active workspace, or null while loading.
  active: Workspace | null
  activeId: number | null
  // Switch workspace: persists the id, drops cached scoped data, re-renders.
  setActiveId: (id: number) => void
  // True once we know which workspace is active (or there's no user). The authed
  // app waits on this before rendering resource pages, so no resource request
  // ever fires without an X-Workspace-Id header.
  ready: boolean
}

export const ActiveWorkspaceContext = createContext<ActiveWorkspaceValue | null>(null)
