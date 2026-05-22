import type { SheetColumn, SheetColumnKind, SheetData, SheetRow, SheetTab, SheetWorkbook } from '../types'

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

export function toExcelLabel(index: number): string {
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

// ─── Multi-tab workbook ────────────────────────────────────────────────

/** Parse a workbook from the backend's opaque JSON blob. Accepts both
 *  the new shape `{ tabs: [...], activeTabId }` and the legacy single-
 *  tab shape `{ columns, rows }` — legacy data is wrapped into a single
 *  `Sheet1` tab on the fly. Save always writes the new shape, so the
 *  next autosave migrates each legacy sheet permanently. */
export function parseSheetWorkbook(json: string | undefined | null): SheetWorkbook {
  if (!json) return defaultSheetWorkbook()
  try {
    const parsed = JSON.parse(json) as
      | Partial<SheetWorkbook>
      | Partial<SheetData>
      | null
    if (!parsed || typeof parsed !== 'object') return defaultSheetWorkbook()
    // New shape: has `tabs` array.
    if ('tabs' in parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
      const tabs: SheetTab[] = parsed.tabs
        .filter((t): t is SheetTab => !!t && typeof t === 'object')
        .map((t, i) => ({
          id: typeof t.id === 'string' && t.id ? t.id : `t${i + 1}`,
          name: typeof t.name === 'string' && t.name ? t.name : `Sheet${i + 1}`,
          columns: Array.isArray(t.columns) ? t.columns : [],
          rows: Array.isArray(t.rows) ? t.rows : [],
        }))
      if (tabs.length === 0) return defaultSheetWorkbook()
      const activeTabId =
        typeof (parsed as SheetWorkbook).activeTabId === 'string' &&
        tabs.some((t) => t.id === (parsed as SheetWorkbook).activeTabId)
          ? (parsed as SheetWorkbook).activeTabId
          : tabs[0].id
      return { tabs, activeTabId }
    }
    // Legacy shape: `{ columns, rows }` — wrap as a single Sheet1.
    const cols = Array.isArray((parsed as SheetData).columns) ? (parsed as SheetData).columns : []
    const rows = Array.isArray((parsed as SheetData).rows) ? (parsed as SheetData).rows : []
    return {
      tabs: [{ id: 't1', name: 'Sheet1', columns: cols, rows: rows }],
      activeTabId: 't1',
    }
  } catch {
    return defaultSheetWorkbook()
  }
}

export function stringifySheetWorkbook(wb: SheetWorkbook): string {
  return JSON.stringify(wb)
}

export function defaultSheetWorkbook(): SheetWorkbook {
  const sheet1: SheetTab = { id: 't1', name: 'Sheet1', ...defaultSheetData() }
  return { tabs: [sheet1], activeTabId: 't1' }
}

export function getActiveTab(wb: SheetWorkbook): SheetTab {
  return wb.tabs.find((t) => t.id === wb.activeTabId) ?? wb.tabs[0]
}

export function tabAsData(t: SheetTab): SheetData {
  return { columns: t.columns, rows: t.rows }
}

/** Apply a `SheetData` patch to the active tab, leaving every other
 *  tab untouched. Used by every grid edit. */
export function withActiveTab(wb: SheetWorkbook, patch: SheetData): SheetWorkbook {
  return {
    ...wb,
    tabs: wb.tabs.map((t) =>
      t.id === wb.activeTabId
        ? { ...t, columns: patch.columns, rows: patch.rows }
        : t,
    ),
  }
}

/** Generate the next free tab id ("t1", "t2", …). */
export function nextTabId(wb: SheetWorkbook): string {
  const used = new Set(wb.tabs.map((t) => t.id))
  for (let i = 1; i < 1_000_000; i++) {
    const c = `t${i}`
    if (!used.has(c)) return c
  }
  return `t${Date.now()}`
}

/** Generate the next "Sheet N" name avoiding existing tabs. */
export function nextTabName(wb: SheetWorkbook): string {
  const used = new Set(wb.tabs.map((t) => t.name))
  for (let i = 1; i < 1_000_000; i++) {
    const c = `Sheet${i}`
    if (!used.has(c)) return c
  }
  return `Sheet`
}

export function isEqualWorkbook(a: SheetWorkbook, b: SheetWorkbook): boolean {
  if (a.activeTabId !== b.activeTabId) return false
  if (a.tabs.length !== b.tabs.length) return false
  for (let i = 0; i < a.tabs.length; i++) {
    const x = a.tabs[i]
    const y = b.tabs[i]
    if (x.id !== y.id || x.name !== y.name) return false
    if (!isEqualData({ columns: x.columns, rows: x.rows }, { columns: y.columns, rows: y.rows })) return false
  }
  return true
}

/** Parse a cell string into a number, tolerating comma thousand
 *  separators and a leading currency symbol (₩, $, etc.).
 *  Returns null if the cell isn't numerically meaningful. */
export function parseCellNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null
  const cleaned = s.replace(/[₩$€£¥,\s]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const KRW_FMT = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

/** Render a cell value for display. Edit mode always sees the raw
 *  string (react-data-grid's renderEditCell). Number/currency cells
 *  with a parseable value render with thousand separators; check cells
 *  collapse truthy/falsy strings into ☑ / ☐ glyphs; everything else
 *  passes through. */
export function formatCellDisplay(raw: string, kind: SheetColumnKind | undefined): string {
  if (raw === '' || raw == null) {
    return kind === 'check' ? '☐' : ''
  }
  switch (kind) {
    case 'number': {
      const n = parseCellNumber(raw)
      return n == null ? raw : KRW_FMT.format(n)
    }
    case 'currency': {
      const n = parseCellNumber(raw)
      return n == null ? raw : `₩${KRW_FMT.format(n)}`
    }
    case 'check':
      return isTruthyCellValue(raw) ? '☑' : '☐'
    case 'date':
    case 'text':
    case undefined:
    default:
      return raw
  }
}

/** Loose truthy parsing for checkbox columns. `true`, `1`, `yes`, `y`,
 *  `o`, `✓`, `o`, Korean `예`/`참` all count as checked. Anything else
 *  (including empty string) reads as unchecked. */
export function isTruthyCellValue(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y'
    || s === 'o' || s === '✓' || s === '✔'
    || s === '예' || s === '참' || s === 'on'
}

/** True if a kind right-aligns its rendered value. Numeric & currency
 *  align right so columns of figures line up cleanly. */
export function isRightAligned(kind: SheetColumnKind | undefined): boolean {
  return kind === 'number' || kind === 'currency'
}

/** True if a kind participates in status-bar aggregation. */
export function isNumericKind(kind: SheetColumnKind | undefined): boolean {
  return kind === 'number' || kind === 'currency'
}
