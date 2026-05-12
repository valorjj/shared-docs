import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const m = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    m.addEventListener('change', handler)
    setMatches(m.matches)
    return () => m.removeEventListener('change', handler)
  }, [query])

  return matches
}

export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 768px)')
export const useIsMobile  = (): boolean => useMediaQuery('(max-width: 767px)')
