import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === 'undefined') return () => {}
      const m = window.matchMedia(query)
      m.addEventListener('change', notify)
      return () => m.removeEventListener('change', notify)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  }, [query])

  const getServerSnapshot = () => false

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 768px)')
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 767px)')
/** True on touch-primary devices (iPhone, iPad in touch mode, etc.). */
export const useIsTouch = (): boolean => useMediaQuery('(hover: none) and (pointer: coarse)')
