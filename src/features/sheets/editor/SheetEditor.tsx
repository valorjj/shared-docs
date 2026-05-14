import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../../lib/useMediaQuery'
import { useDeleteSheet, useUpdateSheet } from '../api'
import {
  isEqualData,
  makeEmptyRow,
  nextColumnKey,
  nextColumnLabel,
  parseSheetData,
  stringifySheetData,
} from '../shared/sheetData'
import type { SheetData, SheetFull } from '../types'
import SheetColumnSheet from './SheetColumnSheet'
import SheetEditorCardList from './SheetEditorCardList'
import SheetEditorGrid from './SheetEditorGrid'
import SheetEditorMeta from './SheetEditorMeta'
import SheetEditorMobileBar from './SheetEditorMobileBar'
import SheetEditorTitle from './SheetEditorTitle'
import SheetEditorToolbar from './SheetEditorToolbar'
import styles from './SheetEditor.module.css'

type Props = {
  sheet: SheetFull
  onDeleted: () => void
  onBack: () => void
}

const AUTOSAVE_MS = 800

/**
 * Parent re-keys this component on sheet change, so lazy `useState` reads
 * the initial data once. No syncing effect needed.
 */
export default function SheetEditor({ sheet, onDeleted, onBack }: Props) {
  const updateSheet = useUpdateSheet()
  const deleteSheet = useDeleteSheet()
  const isMobile = useIsMobile()

  const [localData, setLocalData] = useState<SheetData>(() => parseSheetData(sheet.data))
  const dirty = useRef(false)
  const autosaveTimer = useRef<number | null>(null)
  const [savingHint, setSavingHint] = useState(false)
  const [columnSheetOpen, setColumnSheetOpen] = useState(false)

  const flush = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    setSavingHint(false)
    updateSheet.mutate({ id: sheet.id, payload: { data: stringifySheetData(localData) } })
  }, [sheet.id, localData, updateSheet])

  const scheduleSave = useCallback(() => {
    dirty.current = true
    setSavingHint(true)
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(flush, AUTOSAVE_MS)
  }, [flush])

  // Flush pending changes on unmount / sheet switch.
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current)
        autosaveTimer.current = null
      }
      flush()
    }
  }, [sheet.id, flush])

  const handleDataChange = (next: SheetData) => {
    if (isEqualData(next, localData)) return
    setLocalData(next)
    scheduleSave()
  }

  const handleAddRow = () => {
    handleDataChange({
      columns: localData.columns,
      rows: [...localData.rows, makeEmptyRow(localData.columns)],
    })
  }

  const handleAddColumn = () => {
    const key = nextColumnKey(localData.columns)
    const name = nextColumnLabel(localData.columns)
    const nextCols = [...localData.columns, { key, name, width: 160 }]
    const nextRows = localData.rows.map((r) => ({ ...r, [key]: '' }))
    handleDataChange({ columns: nextCols, rows: nextRows })
  }

  const handleTitleCommit = (title: string | null) => {
    if (title === sheet.title) return
    updateSheet.mutate({ id: sheet.id, payload: { title } })
  }

  const handleTogglePin = () => {
    updateSheet.mutate({ id: sheet.id, payload: { pinned: !sheet.pinned } })
  }

  const handleDelete = () => {
    deleteSheet.mutate(sheet.id, { onSuccess: onDeleted })
  }

  return (
    <div className={styles.root}>
      <SheetEditorMobileBar onBack={onBack} />
      <div className={styles.headerArea}>
        <SheetEditorTitle key={sheet.id} initialValue={sheet.title} onCommit={handleTitleCommit} />
        <SheetEditorMeta
          sheet={sheet}
          saving={savingHint || updateSheet.isPending}
          onTogglePin={handleTogglePin}
          onDelete={handleDelete}
        />
        <SheetEditorToolbar
          onAddRow={handleAddRow}
          onAddColumn={handleAddColumn}
          onOpenColumnSheet={() => setColumnSheetOpen(true)}
        />
      </div>
      {isMobile ? (
        <SheetEditorCardList data={localData} onChange={handleDataChange} />
      ) : (
        <SheetEditorGrid data={localData} onChange={handleDataChange} />
      )}
      <SheetColumnSheet
        open={columnSheetOpen}
        onOpenChange={setColumnSheetOpen}
        data={localData}
        onChange={handleDataChange}
      />
    </div>
  )
}
