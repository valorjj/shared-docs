import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import type {
  MentionItem,
  MentionKeyHandler,
  MentionState,
} from './extensions/MentionCommand'
import { formatRelativeTime } from '../shared/formatRelativeTime'
import styles from './MentionMenuPopup.module.css'

type Props = {
  state: MentionState
  keyHandlerRef: { current: MentionKeyHandler | null }
}

export default function MentionMenuPopup({ state, keyHandlerRef }: Props) {
  const [selected, setSelected] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<MentionItem[]>(state.items)
  const selectedRef = useRef(selected)

  useEffect(() => { itemsRef.current = state.items }, [state.items])
  useEffect(() => { selectedRef.current = selected }, [selected])

  const safeSelected =
    state.items.length === 0 ? 0 : Math.min(selected, state.items.length - 1)

  useLayoutEffect(() => {
    const el = containerRef.current
    const rect = state.clientRect?.()
    if (!el || !rect) return
    const PAD = 8
    const popupHeight = el.offsetHeight || 220
    const popupWidth = el.offsetWidth || 260
    const placeAbove = rect.bottom + popupHeight + PAD > window.innerHeight
    const top = placeAbove ? rect.top - popupHeight - 6 : rect.bottom + 6
    const maxLeft = window.innerWidth - popupWidth - PAD
    const left = Math.max(PAD, Math.min(rect.left, maxLeft))
    el.style.top = `${Math.max(PAD, top)}px`
    el.style.left = `${left}px`
    el.style.visibility = 'visible'
  }, [state, safeSelected])

  useEffect(() => {
    const handler: MentionKeyHandler = (event) => {
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
        const picked = items[idx] ?? items[0]
        if (picked) state.command(picked)
        return true
      }
      if (event.key === 'Escape') return true
      return false
    }
    keyHandlerRef.current = handler
    return () => {
      if (keyHandlerRef.current === handler) keyHandlerRef.current = null
    }
  }, [state, keyHandlerRef])

  if (state.items.length === 0) {
    return createPortal(
      <div ref={containerRef} className={styles.popup} role="listbox">
        <div className={styles.empty}>일치하는 메모가 없어요</div>
      </div>,
      document.body,
    )
  }

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
            <FileText size={14} strokeWidth={1.75} />
          </span>
          <span className={styles.label}>{item.title ?? '제목 없음'}</span>
          <span className={styles.hint}>{formatRelativeTime(item.updatedAt)}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
