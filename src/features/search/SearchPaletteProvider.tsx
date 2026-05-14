import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SearchPaletteCtx } from './searchContext'
import SearchPalette from './SearchPalette'

/**
 * Mounts the search palette dialog and registers a global ⌘K / Ctrl+K
 * shortcut. Triggers (TopNav button, BottomNav 검색 item) consume the
 * context via `useSearchPalette()` to open / close.
 */
export function SearchPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle])

  return (
    <SearchPaletteCtx.Provider value={value}>
      {children}
      <SearchPalette open={open} onOpenChange={setOpen} />
    </SearchPaletteCtx.Provider>
  )
}
