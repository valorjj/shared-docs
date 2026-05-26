import { Fragment, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseSignature, type FunctionMeta } from '../shared/formula'
import styles from './SheetArgumentHint.module.css'

type Props = {
  /** The cell editor's <input>, used to anchor the tooltip's position. */
  anchor: HTMLElement | null
  meta: FunctionMeta
  argIndex: number
}

/**
 * Floating signature tooltip under the active cell editor. Reads its
 * position from the anchor's bounding rect; re-runs on scroll + resize
 * so the tooltip tracks the cell while the grid moves underneath it.
 *
 * The tooltip is a pointer-events: none portal child so it never steals
 * mouse interaction from the cell or the autocomplete popup. Visually
 * it's mutually exclusive with SheetFunctionAutocomplete — the editor
 * only renders one or the other.
 */
export default function SheetArgumentHint({ anchor, meta, argIndex }: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    // Bail without touching state — the render guard below handles the
    // "no anchor" case from the pos === null path. (Calling setPos in
    // the effect body trips react-hooks/set-state-in-effect.)
    if (!anchor) return
    const update = () => {
      const r = anchor.getBoundingClientRect()
      setPos({ left: r.left, top: r.bottom + 4 })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor])

  if (!anchor || !pos) return null

  const parsed = parseSignature(meta)
  // Treat the variadic `…` tail as one extra "slot" so a caret past the
  // last named arg still highlights *something* (the continuation).
  const slots: { label: string; optional?: boolean }[] = parsed.variadic
    ? [...parsed.args, { label: '…' }]
    : parsed.args
  const activeIdx = slots.length === 0 ? -1 : Math.min(argIndex, slots.length - 1)

  return createPortal(
    <div
      className={styles.hint}
      style={{ left: pos.left, top: pos.top }}
      role="tooltip"
    >
      <span className={styles.signature}>
        <span className={styles.fn}>{meta.name}</span>
        <span>(</span>
        {slots.map((slot, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={styles.sep}>,&nbsp;</span>}
            <span className={i === activeIdx ? styles.activeArg : styles.arg}>
              {slot.optional ? `[${slot.label}]` : slot.label}
            </span>
          </Fragment>
        ))}
        <span>)</span>
      </span>
      <span className={styles.description}>{meta.description}</span>
    </div>,
    document.body,
  )
}
