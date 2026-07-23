import { useCallback, useSyncExternalStore } from 'react'

// Below this many px we treat the viewport shrink as browser chrome / jitter
// rather than a real software keyboard — avoids the bar flickering in on scroll.
const KEYBOARD_MIN = 60

/**
 * Pure keyboard-height math, split out from the hook so it can be reasoned
 * about in isolation (this frontend has no test runner). The software
 * keyboard occupies the gap between the layout viewport (window.innerHeight)
 * and the visual viewport (its height + how far it's been pushed down).
 */
export function computeKeyboardInset(
  innerHeight: number,
  viewport: { height: number; offsetTop: number } | null,
): number {
  if (!viewport) return 0
  const inset = innerHeight - viewport.height - viewport.offsetTop
  return inset > KEYBOARD_MIN ? Math.round(inset) : 0
}

/**
 * Live bottom inset (px) the on-screen keyboard occupies. 0 when the keyboard
 * is closed or the browser lacks visualViewport (falls back to 0 → callers
 * render nothing / use their sticky fallback).
 */
export function useKeyboardInset(): number {
  const subscribe = useCallback((notify: () => void) => {
    const vv = window.visualViewport
    if (!vv) return () => {}
    vv.addEventListener('resize', notify)
    vv.addEventListener('scroll', notify)
    return () => {
      vv.removeEventListener('resize', notify)
      vv.removeEventListener('scroll', notify)
    }
  }, [])

  const getSnapshot = useCallback(() => {
    const vv = window.visualViewport
    return computeKeyboardInset(
      window.innerHeight,
      vv ? { height: vv.height, offsetTop: vv.offsetTop } : null,
    )
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
