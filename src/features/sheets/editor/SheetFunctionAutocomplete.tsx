import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FunctionMeta } from '../shared/formula'
import styles from './SheetFunctionAutocomplete.module.css'

type Props = {
  /** The DOM node whose bounding rect anchors the popup (the cell's
   *  edit-mode `<input>`). The popup sits directly below it. */
  anchor: HTMLElement | null
  matches: FunctionMeta[]
  /** Caller-controlled active index so keyboard handlers in the editor
   *  can advance it without round-tripping through React state here. */
  activeIndex: number
  onHover: (index: number) => void
  onPick: (fn: FunctionMeta) => void
}

/**
 * Floats a Bear-quiet popup under the active cell editor with the
 * matching function list. The editor owns activeIndex + keyboard nav;
 * this component just renders.
 */
export default function SheetFunctionAutocomplete({
  anchor,
  matches,
  activeIndex,
  onHover,
  onPick,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)

  useLayoutEffect(() => {
    // Bail without touching state — the render guard below handles
    // anchor === null via the pos === null path. (Calling setPos here
    // trips react-hooks/set-state-in-effect.)
    if (!anchor) return
    const update = () => {
      const r = anchor.getBoundingClientRect()
      setPos({ left: r.left, top: r.bottom + 4, width: r.width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor, matches.length])

  // Keep the active item visible as the user navigates.
  useEffect(() => {
    const list = ref.current
    if (!list) return
    const el = list.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!anchor || !pos || matches.length === 0) return null
  const safeActive = Math.min(Math.max(activeIndex, 0), matches.length - 1)

  return createPortal(
    <div
      className={styles.popup}
      style={{ left: pos.left, top: pos.top, minWidth: pos.width }}
      role="listbox"
      ref={ref}
    >
      {matches.map((fn, i) => (
        <button
          key={fn.name}
          type="button"
          role="option"
          aria-selected={i === safeActive}
          className={`${styles.item}${i === safeActive ? ` ${styles.active}` : ''}`}
          // `onMouseDown` instead of `onClick` so the input doesn't blur
          // and commit the edit before we get to handle the pick.
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(fn)
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className={styles.name}>{fn.name}</span>
          <span className={styles.signature}>{fn.signature}</span>
          <span className={styles.description}>{fn.description}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
