import { createContext, useContext } from 'react'

type Ctx = {
  open: boolean
  setOpen: (next: boolean) => void
  toggle: () => void
}

export const SearchPaletteCtx = createContext<Ctx | null>(null)

export function useSearchPalette(): Ctx {
  const v = useContext(SearchPaletteCtx)
  if (!v) {
    throw new Error('useSearchPalette must be used inside <SearchPaletteProvider>')
  }
  return v
}
