import { useViewport } from '@xyflow/react'
import { MousePointer2 } from 'lucide-react'
import type { Peer } from './collab/usePlanPresence'
import styles from './PresenceCursors.module.css'

/** pointer-events:none overlay of peer cursors. Positions each peer's smoothed
 *  flow-coordinate cursor via the live viewport transform (screen = flow*zoom + pan),
 *  so cursors stay pinned to the graph through this viewer's own pan/zoom. */
export default function PresenceCursors({ peers }: { peers: Peer[] }) {
  const { x, y, zoom } = useViewport()
  return (
    <div className={styles.layer} aria-hidden="true">
      {peers.map((p) =>
        p.cursor ? (
          <div
            key={p.clientId}
            className={styles.cursor}
            style={{ transform: `translate(${p.cursor.x * zoom + x}px, ${p.cursor.y * zoom + y}px)` }}
          >
            <MousePointer2 size={18} className={styles.pointer} style={{ color: p.color, fill: p.color }} />
            <span className={styles.label} style={{ background: p.color }}>{p.name}</span>
          </div>
        ) : null,
      )}
    </div>
  )
}
