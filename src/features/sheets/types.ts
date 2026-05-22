export type SheetUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

/** Light list item — no data payload. */
export type SheetSummary = {
  id: number
  title: string | null
  pinned: boolean
  createdBy: SheetUserRef
  createdAt: string
  updatedAt: string
}

export type SheetPermission = 'OWNER' | 'EDIT' | 'VIEW'

/** Full sheet, including the JSON grid payload. `myPermission` is
 *  set server-side from AccessControl and drives the grid's
 *  read-only switch — VIEW recipients see the cells but every edit
 *  affordance is hidden. */
export type SheetFull = SheetSummary & {
  data: string
  myPermission: SheetPermission
}

export type CreateSheetPayload = {
  title?: string | null
  data?: string
  pinned?: boolean
}

export type UpdateSheetPayload = {
  title?: string | null
  data?: string
  pinned?: boolean
}

/** Column rendering hints. Omitted = `text`. The kind only changes how
 *  the cell renders + aligns — it does not validate input, so a user
 *  can still type a stray letter into a `number` column without losing
 *  the value (it just won't aggregate in the status bar). */
export type SheetColumnKind = 'text' | 'number' | 'currency' | 'date' | 'check'

export type SheetColumn = {
  key: string
  name: string
  width?: number
  kind?: SheetColumnKind
}

export type SheetRow = Record<string, string>

export type SheetData = {
  columns: SheetColumn[]
  rows: SheetRow[]
}

/** One tab inside a multi-tab sheet. The grid still operates on a
 *  single tab's `SheetData`; this just bundles `id` + display name. */
export type SheetTab = {
  id: string
  name: string
  columns: SheetColumn[]
  rows: SheetRow[]
}

/** Multi-tab workbook. Legacy sheets stored as `{ columns, rows }`
 *  auto-wrap into a single "Sheet1" tab on parse — see
 *  `parseSheetWorkbook` in shared/sheetData.ts. */
export type SheetWorkbook = {
  tabs: SheetTab[]
  activeTabId: string
}
