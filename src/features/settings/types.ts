export const THEMES = ['light', 'dark', 'dracula', 'monokai'] as const
export type Theme = (typeof THEMES)[number]

export const FONTS = ['sans', 'serif', 'mono'] as const
export type FontKey = (typeof FONTS)[number]

export const LINE_HEIGHTS = ['compact', 'normal', 'relaxed'] as const
export type LineHeightKey = (typeof LINE_HEIGHTS)[number]

export type AppSettings = {
  theme: Theme
  font: FontKey
  lineHeight: LineHeightKey
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dracula',
  font: 'sans',
  lineHeight: 'normal',
}

export const THEME_LABELS: Record<Theme, string> = {
  light: '라이트',
  dark: '다크',
  dracula: 'Dracula',
  monokai: 'Monokai',
}

export const FONT_LABELS: Record<FontKey, string> = {
  sans: '본문 (산세리프)',
  serif: '읽기 (세리프)',
  mono: '고정폭',
}

export const LINE_HEIGHT_LABELS: Record<LineHeightKey, string> = {
  compact: '조밀하게',
  normal: '보통',
  relaxed: '여유롭게',
}
