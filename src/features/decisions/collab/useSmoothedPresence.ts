import { useEffect, useRef, useState } from 'react'
import type { Peer } from './usePlanPresence'

const ALPHA = 0.25          // ease factor per frame — higher = snappier/less lag, lower = smoother/more lag
const EPSILON = 0.5         // px: within this of target, snap and stop animating that value

type Vec = { x: number; y: number }
type Rendered = { cursor: Vec | null; drag: { nodeId: string; x: number; y: number } | null }

function ease(rendered: number, target: number): number {
  const next = rendered + (target - rendered) * ALPHA
  return Math.abs(target - next) < EPSILON ? target : next
}

/** Decouples render rate from packet rate. Every animation frame, each peer's
 *  rendered cursor/drag position eases toward its latest received target, so the
 *  overlay glides at 60fps regardless of jittery ~20/sec awareness packets. The
 *  rAF loop self-parks when nothing is moving and restarts when a target changes. */
export function useSmoothedPresence(peers: Peer[]): Peer[] {
  const peersRef = useRef<Peer[]>(peers)
  const renderedRef = useRef(new Map<number, Rendered>())
  const rafRef = useRef<number | null>(null)
  const [smoothed, setSmoothed] = useState<Peer[]>(peers)

  // Keep the ref current without writing to it during render (the rAF loop below
  // reads it asynchronously, never during render, so a post-render effect is safe).
  useEffect(() => {
    peersRef.current = peers
  })

  useEffect(() => {
    const tick = () => {
      const rendered = renderedRef.current
      const current = peersRef.current
      const liveIds = new Set(current.map((p) => p.clientId))
      for (const id of rendered.keys()) if (!liveIds.has(id)) rendered.delete(id)

      let moving = false
      const out = current.map((p) => {
        const prev = rendered.get(p.clientId) ?? { cursor: null, drag: null }

        // cursor
        let cursor: Vec | null
        if (!p.cursor) { cursor = null }
        else if (!prev.cursor) { cursor = { x: p.cursor.x, y: p.cursor.y } }   // new: snap to first target
        else {
          cursor = { x: ease(prev.cursor.x, p.cursor.x), y: ease(prev.cursor.y, p.cursor.y) }
          if (cursor.x !== p.cursor.x || cursor.y !== p.cursor.y) moving = true
        }

        // drag
        let drag: Rendered['drag']
        if (!p.drag) { drag = null }
        else if (!prev.drag || prev.drag.nodeId !== p.drag.nodeId) {
          drag = { nodeId: p.drag.nodeId, x: p.drag.x, y: p.drag.y }           // new node: snap
        } else {
          drag = { nodeId: p.drag.nodeId, x: ease(prev.drag.x, p.drag.x), y: ease(prev.drag.y, p.drag.y) }
          if (drag.x !== p.drag.x || drag.y !== p.drag.y) moving = true
        }

        rendered.set(p.clientId, { cursor, drag })
        return { ...p, cursor, drag }
      })

      setSmoothed(out)
      rafRef.current = moving ? requestAnimationFrame(tick) : null
    }

    // (Re)start the loop whenever peers change (a new target may need animating).
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [peers])

  return smoothed
}
