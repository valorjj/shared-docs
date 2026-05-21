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
const SNAPSHOT_DEBOUNCE_MS = 500
const MAX_HISTORY = 50

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

  // Cmd+Z / Cmd+Shift+Z / Cmd+Y keyboard shortcuts. Scoped to the
  // editor's root via the wrapper ref — so undo elsewhere on the page
  // doesn't roll back the sheet. Skips when focus is inside a text
  // input so the cell editor / title field keep their own native
  // undo stacks. (Listener attaches after `undo`/`redo` are declared
  // below — JS reads top-to-bottom in component bodies.)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Undo / redo. Snapshots are debounced — a burst of keystrokes
  // within `SNAPSHOT_DEBOUNCE_MS` collapses into a single undo step,
  // so Cmd+Z doesn't roll back letter-by-letter. The redo stack
  // clears on any fresh edit (standard text-editor behavior).
  const historyRef = useRef<SheetData[]>([])
  const redoRef = useRef<SheetData[]>([])
  const lastSnapshotRef = useRef<SheetData>(localData)
  const snapshotTimer = useRef<number | null>(null)

  const scheduleSnapshot = useCallback((newData: SheetData) => {
    if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current)
    snapshotTimer.current = window.setTimeout(() => {
      if (isEqualData(lastSnapshotRef.current, newData)) return
      historyRef.current.push(lastSnapshotRef.current)
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
      lastSnapshotRef.current = newData
      // New edit invalidates any pending redos.
      redoRef.current = []
    }, SNAPSHOT_DEBOUNCE_MS)
  }, [])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return
    // Flush any pending snapshot first so the undo target is current.
    if (snapshotTimer.current) {
      window.clearTimeout(snapshotTimer.current)
      snapshotTimer.current = null
    }
    const prev = historyRef.current.pop()!
    redoRef.current.push(lastSnapshotRef.current)
    lastSnapshotRef.current = prev
    setLocalData(prev)
    scheduleSave()
  }, [scheduleSave])

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return
    const next = redoRef.current.pop()!
    historyRef.current.push(lastSnapshotRef.current)
    lastSnapshotRef.current = next
    setLocalData(next)
    scheduleSave()
  }, [scheduleSave])

  const handleDataChange = (next: SheetData) => {
    if (isEqualData(next, localData)) return
    setLocalData(next)
    scheduleSnapshot(next)
    scheduleSave()
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
    <div className={styles.root} ref={rootRef} tabIndex={-1}>
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
