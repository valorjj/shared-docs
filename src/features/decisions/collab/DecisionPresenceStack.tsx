import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getToken } from '../../../auth/tokenStorage'
import { useAuth } from '../../../auth/useAuth'
import { collabColorForUser } from '../../notes/collab/collabColor'
import { WS_BASE } from './wsBase'
import styles from './DecisionPresenceStack.module.css'

type PeerUser = { name: string; color: string }
type Peer = PeerUser & { clientId: number }

/** Avatar stack of the other members currently viewing this plan. Awareness-only
 *  Yjs channel (empty Y.Doc) — the same machinery notes uses, so live cursors /
 *  canvas-drag can later be added as extra awareness fields on this connection. */
export default function DecisionPresenceStack({ planId }: { planId: number }) {
  const { user } = useAuth()
  const [peers, setPeers] = useState<Peer[]>([])

  useEffect(() => {
    const token = getToken()
    if (!token || !user) return

    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(`${WS_BASE}/ws/plans`, String(planId), yDoc, { params: { token } })
    provider.awareness.setLocalStateField('user', { name: user.name, color: collabColorForUser(user.userId) })

    const update = () => {
      const localId = provider.awareness.clientID
      const entries = Array.from(provider.awareness.getStates().entries()) as Array<[number, { user?: PeerUser }]>
      setPeers(
        entries
          .filter(([clientId]) => clientId !== localId)
          .flatMap(([clientId, state]) => (state.user ? [{ ...state.user, clientId }] : [])),
      )
    }
    provider.awareness.on('change', update)
    update()

    return () => {
      provider.awareness.off('change', update)
      provider.destroy()
      yDoc.destroy()
      setPeers([])
    }
  }, [planId, user])

  if (peers.length === 0) return null

  return (
    <div className={styles.stack} aria-label="지금 이 계획을 함께 보고 있는 사람">
      {peers.map((peer) => (
        <span key={peer.clientId} className={styles.avatar} style={{ borderColor: peer.color }} title={peer.name}>
          {peer.name.charAt(0)}
        </span>
      ))}
    </div>
  )
}
