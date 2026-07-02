import { useEffect, useState } from 'react'
import type { WebsocketProvider } from 'y-websocket'
import styles from './CollabAvatarStack.module.css'

type PeerUser = { name: string; color: string }

export default function CollabAvatarStack({ provider }: { provider: WebsocketProvider }) {
  const [peers, setPeers] = useState<PeerUser[]>([])

  useEffect(() => {
    const update = () => {
      const states = Array.from(provider.awareness.getStates().values()) as Array<{ user?: PeerUser }>
      setPeers(states.map((s) => s.user).filter((u): u is PeerUser => !!u))
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
      {peers.map((peer, i) => (
        <span key={i} className={styles.avatar} style={{ borderColor: peer.color }} title={peer.name}>
          {peer.name.charAt(0)}
        </span>
      ))}
    </div>
  )
}
