import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './ContextMenu.module.css'

type ContextMenuProps = {
  open: boolean
  /** Anchor point in viewport coords (usually the right-click cursor). */
  position: { x: number; y: number } | null
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}

/**
 * Controlled, portaled, custom right-click menu. The caller owns open state
 * and the anchor point — wire up `onContextMenu` on whatever trigger element
 * you want, preventDefault, then set position + open.
 *
 * Handles for you: viewport clamping, outside click, scroll dismiss, Escape,
 * and suppressing the native menu on the menu itself.
 */
export function ContextMenu({
  open,
  position,
  onClose,
  children,
  ariaLabel,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, onClose])

  // Clamp to viewport once the menu has measured itself.
  useLayoutEffect(() => {
    if (!open || !position) return
    const el = menuRef.current
    if (!el) return
    const PAD = 8
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.min(position.x, window.innerWidth - w - PAD)
    const top = Math.min(position.y, window.innerHeight - h - PAD)
    el.style.left = `${Math.max(PAD, left)}px`
    el.style.top = `${Math.max(PAD, top)}px`
    el.style.visibility = 'visible'
  }, [open, position])

  if (!open || !position) return null

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      aria-label={ariaLabel}
      style={{ visibility: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}

type ContextMenuItemProps = {
  onSelect: () => void
  icon?: ReactNode
  children: ReactNode
  destructive?: boolean
  disabled?: boolean
}

export function ContextMenuItem({
  onSelect,
  icon,
  children,
  destructive = false,
  disabled = false,
}: ContextMenuItemProps) {
  const handle = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      // Don't steal focus from the underlying editor / list.
      e.preventDefault()
      onSelect()
    },
    [disabled, onSelect],
  )
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`${styles.item}${destructive ? ` ${styles.destructive}` : ''}`}
      onMouseDown={handle}
    >
      {icon && (
        <span className={styles.itemIcon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.itemLabel}>{children}</span>
    </button>
  )
}

export function ContextMenuSeparator() {
  return <div className={styles.separator} role="separator" aria-hidden="true" />
}
