import { usePlanPresence } from './usePlanPresence'
import styles from './DecisionPresenceStack.module.css'

/** Avatar stack of the other members currently on this plan. Reads the shared
 *  awareness connection from PlanPresenceProvider (no longer owns a socket). */
export default function DecisionPresenceStack() {
  const { peers } = usePlanPresence()
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
