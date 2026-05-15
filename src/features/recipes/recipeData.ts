import type { RecipeIngredient, RecipeStep } from './types'

/** Cheap unique id for client-side dnd-kit keys. Falls back to a
 *  timestamp + counter when `crypto.randomUUID` is unavailable
 *  (older Safari in private mode). */
let counter = 0
export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  counter += 1
  return `id-${Date.now()}-${counter}`
}

export function parseIngredients(raw: string): RecipeIngredient[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: typeof r.id === 'string' && r.id ? r.id : makeId(),
        name: typeof r.name === 'string' ? r.name : '',
        amount: typeof r.amount === 'number' ? r.amount : null,
        unit: typeof r.unit === 'string' ? r.unit : '',
      }
    })
  } catch {
    return []
  }
}

export function parseSteps(raw: string): RecipeStep[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: typeof r.id === 'string' && r.id ? r.id : makeId(),
        text: typeof r.text === 'string' ? r.text : '',
      }
    })
  } catch {
    return []
  }
}

export function serializeIngredients(items: RecipeIngredient[]): string {
  return JSON.stringify(
    items.map((i) => ({ id: i.id, name: i.name, amount: i.amount, unit: i.unit })),
  )
}

export function serializeSteps(items: RecipeStep[]): string {
  return JSON.stringify(items.map((s) => ({ id: s.id, text: s.text })))
}

/** Common Korean cooking units in display order. */
export const UNITS = [
  '',
  'g',
  'kg',
  'ml',
  'L',
  '개',
  '알',
  '컵',
  '큰술',
  '작은술',
  '꼬집',
  '쪽',
  '단',
  '봉',
  '약간',
] as const

/** Multiply an amount by `factor` and format it for display. Whole numbers
 *  stay whole; fractions show up to 1 decimal; "0.0" is hidden. */
export function scaleAmount(amount: number | null, factor: number): string {
  if (amount == null || !Number.isFinite(amount)) return ''
  const scaled = amount * factor
  if (scaled === 0) return ''
  if (Number.isInteger(scaled)) return String(scaled)
  return scaled.toFixed(1).replace(/\.0$/, '')
}
