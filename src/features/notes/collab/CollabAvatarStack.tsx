import { useEffect, useState } from 'react'
import type { WebsocketProvider } from 'y-websocket'
import styles from './CollabAvatarStack.module.css'

type PeerUser = { name: string; color: string }
type Peer = PeerUser & { clientId: number }

export default function CollabAvatarStack({ provider }: { provider: WebsocketProvider }) {
  const [peers, setPeers] = useState<Peer[]>([])

  useEffect(() => {
    const update = () => {
      const localClientId = provider.awareness.clientID
      const entries = Array.from(provider.awareness.getStates().entries()) as Array<
        [number, { user?: PeerUser }]
      >
      setPeers(
        entries
          // Exclude the local client's own state — getStates() includes it
          // alongside peers, and we only want to show *other* participants.
          .filter(([clientId]) => clientId !== localClientId)
          .flatMap(([clientId, state]) => (state.user ? [{ ...state.user, clientId }] : [])),
      )
    }
    provider.awareness.on('change', update)
    update()
    return () => {
      provider.awareness.off('change', update)
    }
  }, [provider])

  if (peers.length === 0) return null

  return (
    <div className={styles.stack} aria-label="지금 함께 보고 있는 사람">
      {peers.map((peer) => (
        <span
          key={peer.clientId}
          className={styles.avatar}
          style={{ borderColor: peer.color }}
          title={peer.name}
        >
          {peer.name.charAt(0)}
        </span>
      ))}
    </div>
  )
}
