import type { SheetColumn, SheetData, SheetRow } from '../types'

const EMPTY_DATA: SheetData = { columns: [], rows: [] }

export function parseSheetData(json: string | undefined | null): SheetData {
  if (!json) return defaultSheetData()
  try {
    const parsed = JSON.parse(json) as Partial<SheetData> | null
    if (!parsed || typeof parsed !== 'object') return defaultSheetData()
    const columns = Array.isArray(parsed.columns) ? parsed.columns : []
    const rows = Array.isArray(parsed.rows) ? parsed.rows : []
    return { columns, rows }
  } catch {
    return defaultSheetData()
  }
}

export function stringifySheetData(data: SheetData): string {
  return JSON.stringify(data)
}

export function defaultSheetData(): SheetData {
  return {
    columns: [
      { key: 'c1', name: 'A', width: 160 },
      { key: 'c2', name: 'B', width: 160 },
      { key: 'c3', name: 'C', width: 160 },
    ],
    rows: Array.from({ length: 5 }, () => ({ c1: '', c2: '', c3: '' })),
  }
}

export function nextColumnKey(existing: SheetColumn[]): string {
  const used = new Set(existing.map((c) => c.key))
  for (let i = 1; i < 1_000_000; i++) {
    const candidate = `c${i}`
    if (!used.has(candidate)) return candidate
  }
  return `c${Date.now()}`
}

const A = 'A'.charCodeAt(0)
/** Excel-style column label: A, B, ..., Z, AA, AB, ... */
export function nextColumnLabel(existing: SheetColumn[]): string {
  const used = new Set(existing.map((c) => c.name.trim().toUpperCase()))
  let n = 0
  while (n < 1_000_000) {
    const label = toExcelLabel(n)
    if (!used.has(label)) return label
    n++
  }
  return ''
}

function toExcelLabel(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(A + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function makeEmptyRow(columns: SheetColumn[]): SheetRow {
  const r: SheetRow = {}
  for (const c of columns) r[c.key] = ''
  return r
}

export function isEqualData(a: SheetData, b: SheetData): boolean {
  if (a.columns.length !== b.columns.length) return false
  if (a.rows.length !== b.rows.length) return false
  for (let i = 0; i < a.columns.length; i++) {
    const x = a.columns[i]
    const y = b.columns[i]
    if (x.key !== y.key || x.name !== y.name || (x.width ?? 0) !== (y.width ?? 0)) return false
  }
  for (let i = 0; i < a.rows.length; i++) {
    const x = a.rows[i]
    const y = b.rows[i]
    const keys = new Set<string>([...Object.keys(x), ...Object.keys(y)])
    for (const k of keys) {
      if ((x[k] ?? '') !== (y[k] ?? '')) return false
    }
  }
  return true
}

export const EMPTY_SHEET_DATA = EMPTY_DATA
