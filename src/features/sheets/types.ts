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

export type SheetColumn = {
  key: string
  name: string
  width?: number
}

export type SheetRow = Record<string, string>

export type SheetData = {
  columns: SheetColumn[]
  rows: SheetRow[]
}
