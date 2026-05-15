import { createContext, useContext } from 'react'
import type { AppSettings, FontKey, LineHeightKey, Theme } from './types'

export type SettingsCtxValue = AppSettings & {
  setTheme: (t: Theme) => void
  setFont: (f: FontKey) => void
  setLineHeight: (l: LineHeightKey) => void
  /** Settings dialog open/close (shared by TopNav + BottomNav triggers). */
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}

export const SettingsCtx = createContext<SettingsCtxValue | null>(null)

export function useSettings(): SettingsCtxValue {
  const v = useContext(SettingsCtx)
  if (!v) throw new Error('useSettings must be used inside <SettingsProvider>')
  return v
}
