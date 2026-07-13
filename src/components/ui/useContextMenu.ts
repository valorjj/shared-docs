import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type Pos = { x: number; y: number }

/**
 * Opens a context menu on right-click or a ~500ms touch long-press.
 * setState happens only in event handlers (right-click / long-press timer
 * callback), never in an effect — pair with `<ContextMenu>`, which owns
 * viewport clamping imperatively so it never needs to set state back.
 */
export function useContextMenu() {
  const [position, setPosition] = useState<Pos | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const clear = () => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current)
      timer.current = undefined
    }
  }

  const onContextMenu = (e: { preventDefault: () => void; clientX: number; clientY: number }) => {
    e.preventDefault()
    setPosition({ x: e.clientX, y: e.clientY })
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    const { clientX, clientY } = e
    clear()
    timer.current = window.setTimeout(() => setPosition({ x: clientX, y: clientY }), 500)
  }

  return {
    open: position != null,
    position,
    close: () => setPosition(null),
    triggerProps: {
      onContextMenu,
      onPointerDown,
      onPointerUp: clear,
      onPointerMove: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  }
}
