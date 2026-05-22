import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../../lib/useMediaQuery'
import { useDeleteSheet, useUpdateSheet } from '../api'
import {
  defaultSheetData,
  getActiveTab,
  isEqualWorkbook,
  makeEmptyRow,
  nextColumnKey,
  nextColumnLabel,
  nextTabId,
  nextTabName,
  parseSheetWorkbook,
  stringifySheetWorkbook,
  tabAsData,
  withActiveTab,
} from '../shared/sheetData'
import type { SheetData, SheetFull, SheetTab, SheetWorkbook } from '../types'
import SheetColumnSheet from './SheetColumnSheet'
import SheetEditorCardList from './SheetEditorCardList'
import SheetEditorGrid from './SheetEditorGrid'
import SheetEditorMeta from './SheetEditorMeta'
import SheetEditorMobileBar from './SheetEditorMobileBar'
import SheetEditorTitle from './SheetEditorTitle'
import SheetEditorToolbar from './SheetEditorToolbar'
import SheetTabStrip from './SheetTabStrip'
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
 *
 * State lives at the workbook level (multi-tab). Each grid edit goes
 * through `withActiveTab` so only the currently-active tab is mutated;
 * undo/redo snapshots cover the whole workbook, so renaming/adding/
 * deleting tabs is undoable too.
 */
export default function SheetEditor({ sheet, onDeleted, onBack }: Props) {
  const updateSheet = useUpdateSheet()
  const deleteSheet = useDeleteSheet()
  const isMobile = useIsMobile()

  const [workbook, setWorkbook] = useState<SheetWorkbook>(() => parseSheetWorkbook(sheet.data))
  const dirty = useRef(false)
  const autosaveTimer = useRef<number | null>(null)
  const [savingHint, setSavingHint] = useState(false)
  const [columnSheetOpen, setColumnSheetOpen] = useState(false)

  const activeTab = getActiveTab(workbook)
  const activeData: SheetData = tabAsData(activeTab)

  const flush = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    setSavingHint(false)
    updateSheet.mutate({ id: sheet.id, payload: { data: stringifySheetWorkbook(workbook) } })
  }, [sheet.id, workbook, updateSheet])

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

  const rootRef = useRef<HTMLDivElement | null>(null)

  // Undo / redo at the workbook level. Snapshots are debounced — a
  // burst of keystrokes within `SNAPSHOT_DEBOUNCE_MS` collapses into a
  // single undo step. Tab adds / renames / deletes are also snapshotted
  // so the same Cmd+Z rolls them back.
  const historyRef = useRef<SheetWorkbook[]>([])
  const redoRef = useRef<SheetWorkbook[]>([])
  const lastSnapshotRef = useRef<SheetWorkbook>(workbook)
  const snapshotTimer = useRef<number | null>(null)

  const scheduleSnapshot = useCallback((next: SheetWorkbook) => {
    if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current)
    snapshotTimer.current = window.setTimeout(() => {
      if (isEqualWorkbook(lastSnapshotRef.current, next)) return
      historyRef.current.push(lastSnapshotRef.current)
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
      lastSnapshotRef.current = next
      redoRef.current = []
    }, SNAPSHOT_DEBOUNCE_MS)
  }, [])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return
    if (snapshotTimer.current) {
      window.clearTimeout(snapshotTimer.current)
      snapshotTimer.current = null
    }
    const prev = historyRef.current.pop()!
    redoRef.current.push(lastSnapshotRef.current)
    lastSnapshotRef.current = prev
    setWorkbook(prev)
    scheduleSave()
  }, [scheduleSave])

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return
    const next = redoRef.current.pop()!
    historyRef.current.push(lastSnapshotRef.current)
    lastSnapshotRef.current = next
    setWorkbook(next)
    scheduleSave()
  }, [scheduleSave])

  /** Replace the workbook entirely. Used by tab actions (add/rename/
   *  delete/switch). Schedules autosave + a history snapshot. */
  const applyWorkbook = useCallback((next: SheetWorkbook) => {
    if (isEqualWorkbook(workbook, next)) return
    setWorkbook(next)
    scheduleSnapshot(next)
    scheduleSave()
  }, [workbook, scheduleSnapshot, scheduleSave])

  /** The grid's onChange only touches the active tab. */
  const handleActiveTabChange = (nextData: SheetData) => {
    applyWorkbook(withActiveTab(workbook, nextData))
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
    handleActiveTabChange({
      columns: activeData.columns,
      rows: [...activeData.rows, makeEmptyRow(activeData.columns)],
    })
  }

  const handleAddColumn = () => {
    const key = nextColumnKey(activeData.columns)
    const name = nextColumnLabel(activeData.columns)
    const nextCols = [...activeData.columns, { key, name, width: 160 }]
    const nextRows = activeData.rows.map((r) => ({ ...r, [key]: '' }))
    handleActiveTabChange({ columns: nextCols, rows: nextRows })
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

  // ─── Tab actions ────────────────────────────────────────────────────

  const handleTabSwitch = (id: string) => {
    if (id === workbook.activeTabId) return
    // Tab switch is its own snapshot so Cmd+Z restores the previous tab.
    applyWorkbook({ ...workbook, activeTabId: id })
  }

  const handleTabAdd = () => {
    const newTab: SheetTab = {
      id: nextTabId(workbook),
      name: nextTabName(workbook),
      ...defaultSheetData(),
    }
    applyWorkbook({
      tabs: [...workbook.tabs, newTab],
      activeTabId: newTab.id,
    })
  }

  const handleTabRename = (id: string, name: string) => {
    applyWorkbook({
      ...workbook,
      tabs: workbook.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
    })
  }

  const handleTabDelete = (id: string) => {
    if (workbook.tabs.length <= 1) return
    const idx = workbook.tabs.findIndex((t) => t.id === id)
    const tabs = workbook.tabs.filter((t) => t.id !== id)
    const activeTabId =
      workbook.activeTabId === id
        ? tabs[Math.min(idx, tabs.length - 1)].id
        : workbook.activeTabId
    applyWorkbook({ tabs, activeTabId })
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
        <SheetEditorCardList
          key={activeTab.id}
          data={activeData}
          onChange={handleActiveTabChange}
        />
      ) : (
        <SheetEditorGrid
          key={activeTab.id}
          data={activeData}
          onChange={handleActiveTabChange}
        />
      )}
      <SheetTabStrip
        workbook={workbook}
        onSwitch={handleTabSwitch}
        onAdd={handleTabAdd}
        onRename={handleTabRename}
        onDelete={handleTabDelete}
      />
      <SheetColumnSheet
        open={columnSheetOpen}
        onOpenChange={setColumnSheetOpen}
        data={activeData}
        onChange={handleActiveTabChange}
      />
    </div>
  )
}
