import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getToken } from '../../../auth/tokenStorage'
import { useAuth } from '../../../auth/useAuth'
import { collabColorForUser } from '../../notes/collab/collabColor'
import { WS_BASE } from './wsBase'

export type PeerCursor = { x: number; y: number } | null
export type PeerDrag = { nodeId: string; x: number; y: number } | null
export type Peer = {
  clientId: number
  userId: number
  name: string
  color: string
  cursor: PeerCursor
  drag: PeerDrag
}
export type PlanPresence = {
  peers: Peer[]
  setCursor: (pos: { x: number; y: number } | null) => void
  setDrag: (d: PeerDrag) => void
}

type AwarenessUser = { userId: number; name: string; color: string }
type AwarenessState = { user?: AwarenessUser; cursor?: PeerCursor; drag?: PeerDrag }

const noop = () => {}
const Ctx = createContext<PlanPresence>({ peers: [], setCursor: noop, setDrag: noop })

/** Single shared awareness connection for a plan. Owns the WebsocketProvider
 *  (awareness-only, empty Y.Doc). Both the avatar stack and the canvas consume
 *  this ONE connection — a second connection would make each user appear twice. */
export function PlanPresenceProvider({ planId, children }: { planId: number; children: ReactNode }) {
  const { user } = useAuth()
  const [peers, setPeers] = useState<Peer[]>([])
  const providerRef = useRef<WebsocketProvider | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token || !user) return

    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(`${WS_BASE}/ws/plans`, String(planId), yDoc, { params: { token } })
    providerRef.current = provider
    provider.awareness.setLocalStateField('user', {
      userId: user.userId, name: user.name, color: collabColorForUser(user.userId),
    } satisfies AwarenessUser)

    const update = () => {
      const localId = provider.awareness.clientID
      const entries = Array.from(provider.awareness.getStates().entries()) as Array<[number, AwarenessState]>
      setPeers(
        entries
          .filter(([clientId]) => clientId !== localId)
          .flatMap(([clientId, state]) =>
            state.user
              ? [{
                  clientId,
                  userId: state.user.userId,
                  name: state.user.name,
                  color: state.user.color,
                  cursor: state.cursor ?? null,
                  drag: state.drag ?? null,
                }]
              : [],
          ),
      )
    }
    provider.awareness.on('change', update)
    update()

    return () => {
      provider.awareness.off('change', update)
      provider.destroy()
      yDoc.destroy()
      providerRef.current = null
      setPeers([])
    }
  }, [planId, user])

  const value = useMemo<PlanPresence>(() => ({
    peers,
    setCursor: (pos) => providerRef.current?.awareness.setLocalStateField('cursor', pos),
    setDrag: (d) => providerRef.current?.awareness.setLocalStateField('drag', d),
  }), [peers])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + provider + hook are colocated by design (see interface contract in the task brief); splitting would break the single-file import surface Tasks 2-3 rely on.
export function usePlanPresence(): PlanPresence {
  return useContext(Ctx)
}
