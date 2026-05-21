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

/** Full sheet, including the JSON grid payload. */
export type SheetFull = SheetSummary & {
  data: string
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
