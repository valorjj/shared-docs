import { useNodes, useViewport } from '@xyflow/react'
import type { Peer } from './collab/usePlanPresence'
import styles from './PresenceHalos.module.css'

const INSET = 3   // px per stacked focuser

/** pointer-events:none overlay of peer attention. Solid ring + avatar on a peer's
 *  focused node (panel open); faint ring on a hovered node. Rects come from live
 *  measured nodes; positioned via the viewport transform (screen = flow*zoom + pan)
 *  so rings stay pinned to the graph through this viewer's pan/zoom and follow peer
 *  node-drags. A focus/hover target that isn't a rendered node (deleted, or a
 *  resolved pin hidden by the toggle) renders nothing. */
export default function PresenceHalos({ peers }: { peers: Peer[] }) {
  const nodes = useNodes()
  const { x: vx, y: vy, zoom } = useViewport()
  const rect = new Map(
    nodes.map((n) => [n.id, {
      x: n.position.x, y: n.position.y,
      w: n.measured?.width ?? 0, h: n.measured?.height ?? 0,
    }]),
  )

  // focusers grouped per node so multiple people on one node stack visibly
  const focusByNode = new Map<string, Peer[]>()
  peers.forEach((p) => {
    if (p.focus && rect.has(p.focus)) {
      const arr = focusByNode.get(p.focus) ?? []
      arr.push(p)
      focusByNode.set(p.focus, arr)
    }
  })

  return (
    <div className={styles.layer} aria-hidden="true">
      {/* faint hover rings (skip when this peer already focuses the same node) */}
      {peers.map((p) => {
        if (!p.hover || p.hover === p.focus) return null
        const r = rect.get(p.hover)
        if (!r || r.w === 0) return null
        return (
          <div
            key={`h-${p.clientId}`}
            className={styles.hoverRing}
            style={{
              transform: `translate(${r.x * zoom + vx}px, ${r.y * zoom + vy}px)`,
              width: r.w * zoom, height: r.h * zoom, borderColor: p.color,
            }}
          />
        )
      })}
      {/* solid focus rings + avatar badges, stacked per node */}
      {[...focusByNode.entries()].flatMap(([nodeId, arr]) => {
        const r = rect.get(nodeId)!
        if (r.w === 0) return []
        return arr.map((p, i) => (
          <div
            key={`f-${p.clientId}`}
            className={styles.focusRing}
            style={{
              transform: `translate(${r.x * zoom + vx - i * INSET}px, ${r.y * zoom + vy - i * INSET}px)`,
              width: r.w * zoom + i * INSET * 2, height: r.h * zoom + i * INSET * 2,
              borderColor: p.color,
            }}
          >
            <span className={styles.badge} style={{ background: p.color, right: i * 14 }}>
              {p.name.slice(0, 1)}
            </span>
          </div>
        ))
      })}
    </div>
  )
}
