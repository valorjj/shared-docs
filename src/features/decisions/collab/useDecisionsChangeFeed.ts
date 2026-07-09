import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken } from '../../../auth/tokenStorage'
import { decisionKeys } from '../api'
import { commentKeys } from '../../../api/comments'
import { WS_BASE } from './wsBase'

/**
 * Subscribes to the workspace's Decisions change feed. On connect and on every
 * server frame, invalidates the whole decisions scope so React Query refetches —
 * the same invalidation local mutations already do, now triggered by peers'
 * writes too. Also invalidates the comments scope, since the backend fires this
 * same signal on plan-page comment writes. The socket is a hint, never a
 * guarantee: the invalidate-on-open (and on every reconnect) means a dropped
 * frame or a backend restart only leaves the client stale until its next
 * reconnect. No-op when no active workspace or no auth token.
 */
export function useDecisionsChangeFeed(workspaceId: number | null): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (workspaceId == null) return
    const token = getToken()
    if (!token) return

    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let closed = false

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: decisionKeys.scope(workspaceId) })
      // Plan-page 댓글 live under ['comments', wsId, 'plan:{id}'] — a separate
      // namespace from the decisions scope. The backend fires this same signal on
      // plan-page comment writes, so fan the invalidation out to comment queries too.
      qc.invalidateQueries({ queryKey: commentKeys.scope(workspaceId) })
    }

    const connect = () => {
      socket = new WebSocket(`${WS_BASE}/ws/decisions/${workspaceId}?token=${encodeURIComponent(token)}`)
      socket.onopen = () => {
        attempt = 0
        invalidate() // catch anything missed while disconnected
      }
      socket.onmessage = () => invalidate()
      socket.onclose = () => {
        if (closed) return
        const delay = Math.min(1000 * 2 ** attempt, 15000)
        attempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }
    }
    connect()

    return () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [workspaceId, qc])
}
