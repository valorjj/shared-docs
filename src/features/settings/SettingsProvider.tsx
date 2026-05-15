import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SettingsCtx } from './settingsContext'
import SettingsDialog from './SettingsDialog'
import {
  DEFAULT_SETTINGS,
  FONTS,
  LINE_HEIGHTS,
  THEMES,
  type FontKey,
  type LineHeightKey,
  type Theme,
} from './types'

const STORAGE_KEY = 'shared-docs:settings:v1'

function readStored(): typeof DEFAULT_SETTINGS {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_SETTINGS>
    return {
      theme: (THEMES as readonly string[]).includes(parsed.theme ?? '') ? (parsed.theme as Theme) : DEFAULT_SETTINGS.theme,
      font: (FONTS as readonly string[]).includes(parsed.font ?? '') ? (parsed.font as FontKey) : DEFAULT_SETTINGS.font,
      lineHeight: (LINE_HEIGHTS as readonly string[]).includes(parsed.lineHeight ?? '')
        ? (parsed.lineHeight as LineHeightKey)
        : DEFAULT_SETTINGS.lineHeight,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function applyToDocument(settings: typeof DEFAULT_SETTINGS) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', settings.theme)
  root.setAttribute('data-font', settings.font)
  root.setAttribute('data-line-height', settings.lineHeight)
}

/**
 * Persists theme / font / line-height and reflects each onto `<html>` as a
 * `data-*` attribute. Token blocks in `tokens.css` and `themes.css` match
 * the attribute values, so a change is a one-attribute mutation.
 *
 * State is lazy-initialized from localStorage. We don't read storage during
 * render and we don't run a useEffect to apply the attributes — instead the
 * provider applies them synchronously in the lazy initializer's commit
 * phase (via a ref-style guard) so the first paint is already themed.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => {
    const initial = readStored()
    applyToDocument(initial)
    return initial
  })
  const [dialogOpen, setDialogOpen] = useState(false)

  const persist = useCallback((next: typeof DEFAULT_SETTINGS) => {
    setSettings(next)
    applyToDocument(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage quota / private mode — ignore; in-memory state still works.
    }
  }, [])

  const setTheme = useCallback((theme: Theme) => persist({ ...settings, theme }), [persist, settings])
  const setFont = useCallback((font: FontKey) => persist({ ...settings, font }), [persist, settings])
  const setLineHeight = useCallback(
    (lineHeight: LineHeightKey) => persist({ ...settings, lineHeight }),
    [persist, settings],
  )

  // Cross-tab sync: when another tab changes settings, mirror them locally.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      const next = readStored()
      setSettings(next)
      applyToDocument(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({
      ...settings,
      setTheme,
      setFont,
      setLineHeight,
      dialogOpen,
      setDialogOpen,
    }),
    [settings, setTheme, setFont, setLineHeight, dialogOpen],
  )

  return (
    <SettingsCtx.Provider value={value}>
      {children}
      <SettingsDialog />
    </SettingsCtx.Provider>
  )
}
