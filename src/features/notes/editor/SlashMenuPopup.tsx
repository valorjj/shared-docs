import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SlashItem, SlashKeyHandler, SlashState } from './extensions/SlashCommand'
import styles from './SlashMenuPopup.module.css'

type Props = {
  state: SlashState
  keyHandlerRef: { current: SlashKeyHandler | null }
}

export default function SlashMenuPopup({ state, keyHandlerRef }: Props) {
  const [selected, setSelected] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<SlashItem[]>(state.items)
  const selectedRef = useRef(selected)

  // Mirror current items/selected/state into refs so the keyHandler can
  // read fresh values without re-binding on every keystroke.
  useEffect(() => { itemsRef.current = state.items }, [state.items])
  useEffect(() => { selectedRef.current = selected }, [selected])
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Clamp selected to a valid index during render — no syncing effect.
  const safeSelected =
    state.items.length === 0 ? 0 : Math.min(selected, state.items.length - 1)

  // Position the popup, clamping into the viewport on all sides so it
  // doesn't clip on narrow phones. Apply via direct DOM style so we
  // don't take a render trip per move.
  useLayoutEffect(() => {
    const el = containerRef.current
    const rect = state.clientRect?.()
    if (!el || !rect) return
    const PAD = 8
    const popupHeight = el.offsetHeight || 200
    const popupWidth = el.offsetWidth || 240
    const placeAbove = rect.bottom + popupHeight + PAD > window.innerHeight
    const top = placeAbove ? rect.top - popupHeight - 6 : rect.bottom + 6
    const maxLeft = window.innerWidth - popupWidth - PAD
    const left = Math.max(PAD, Math.min(rect.left, maxLeft))
    el.style.top = `${Math.max(PAD, top)}px`
    el.style.left = `${left}px`
    el.style.visibility = 'visible'
  }, [state, safeSelected])

  // Install the keyboard handler once. Reading via refs avoids
  // re-installing on every keystroke — the previous pattern had a
  // cleanup→reinstall window per render that, under React 19, could
  // race ProseMirror's keydown read and leave the ref briefly null.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[slash popup] effect install', { mounted: true })
    const handler: SlashKeyHandler = (event) => {
      const items = itemsRef.current
      if (items.length === 0) return false
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const idx = Math.min(selectedRef.current, items.length - 1)
        stateRef.current.command(items[idx] ?? items[0])
        return true
      }
      if (event.key === 'Escape') {
        return true
      }
      return false
    }
    keyHandlerRef.current = handler
    return () => {
      // eslint-disable-next-line no-console
      console.log('[slash popup] effect cleanup', { wasOurs: keyHandlerRef.current === handler })
      if (keyHandlerRef.current === handler) keyHandlerRef.current = null
    }
  }, [keyHandlerRef])

  if (state.items.length === 0) return null

  return createPortal(
    <div ref={containerRef} className={styles.popup} role="listbox">
      {state.items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={i === safeSelected}
          className={`${styles.item}${i === safeSelected ? ` ${styles.active}` : ''}`}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => {
            e.preventDefault()
            state.command(item)
          }}
        >
          <span className={styles.icon} aria-hidden="true">
            <item.Icon size={15} strokeWidth={1.75} />
          </span>
          <span className={styles.label}>{item.title}</span>
          {item.hint && <span className={styles.hint}>{item.hint}</span>}
        </button>
      ))}
    </div>,
    document.body,
  )
}
