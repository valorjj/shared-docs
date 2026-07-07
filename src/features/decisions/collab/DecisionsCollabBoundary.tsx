import { Outlet } from 'react-router-dom'
import { useActiveWorkspace } from '../../../auth/useActiveWorkspace'
import { useDecisionsChangeFeed } from './useDecisionsChangeFeed'

/**
 * Route boundary that keeps one Decisions change-feed socket open for the whole
 * /decisions section (board + open plan), so both stay live and the socket
 * follows navigation between them without reconnecting.
 */
export default function DecisionsCollabBoundary() {
  const { activeId } = useActiveWorkspace()
  useDecisionsChangeFeed(activeId)
  return <Outlet />
}
