import { useContext } from 'react'
import { ActiveWorkspaceContext, type ActiveWorkspaceValue } from './workspaceContext'

export function useActiveWorkspace(): ActiveWorkspaceValue {
  const ctx = useContext(ActiveWorkspaceContext)
  if (!ctx) throw new Error('useActiveWorkspace must be used inside <ActiveWorkspaceProvider>')
  return ctx
}
