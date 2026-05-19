import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useCreateNote,
  useDeleteForever,
  useNotes,
  useRestoreNote,
  useTrashNotes,
} from '../api'
import { AppSidebar } from '../../../components/common/AppSidebar'
import { AppSidebarSheet } from '../../../components/common/AppSidebarSheet'
import NoteEditor from '../editor/NoteEditor'
import NoteEditorEmpty from '../editor/NoteEditorEmpty'
import NoteList from '../list/NoteList'
import NoteListContextMenu, {
  type NoteListContextMenuState,
} from '../list/NoteListContextMenu'
import TrashList from '../list/TrashList'
import NoteSidebarBody, { type SidebarFilter } from '../sidebar/NoteSidebarBody'
import { buildTagCounts, noteHasTag } from '../shared/extractTags'
import { useIsMobile } from '../../../lib/useMediaQuery'
import styles from './NoteWorkspace.module.css'

function describeFilter(f: SidebarFilter): string {
  switch (f.kind) {
    case 'all':    return '모든 메모'
    case 'pinned': return '고정됨'
    case 'trash':  return '휴지통'
    case 'tag':    return f.value
  }
}

export default function NoteWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const notesQuery = useNotes()
  const createNote = useCreateNote()
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<SidebarFilter>({ kind: 'all' })
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)
  const [rowMenu, setRowMenu] = useState<NoteListContextMenuState>(null)

  const noteParam = searchParams.get('note')
  const activeId = noteParam ? Number(noteParam) : null

  const allNotes = useMemo(() => notesQuery.data ?? [], [notesQuery.data])
  const tags = useMemo(() => buildTagCounts(allNotes), [allNotes])
  const pinnedCount = useMemo(() => allNotes.filter((n) => n.pinned).length, [allNotes])

  // Trash is fetched lazily — only after the user opens that filter for the
  // first time. The count badge on the sidebar item also keys off this
  // query, so it stays at 0 until activation. Fine for a 2-person app.
  const trashQuery = useTrashNotes(filter.kind === 'trash')
  const trashNotes = useMemo(() => trashQuery.data ?? [], [trashQuery.data])
  const restoreNote = useRestoreNote()
  const deleteForever = useDeleteForever()

  const filtered = useMemo(() => {
    switch (filter.kind) {
      case 'all':
        return allNotes
      case 'pinned':
        return allNotes.filter((n) => n.pinned)
      case 'trash':
        return [] // Trash is rendered through TrashList, not NoteList — guard.
      case 'tag':
        return allNotes.filter((n) => noteHasTag(n, filter.value))
    }
  }, [allNotes, filter])

  const activeNote = activeId !== null ? allNotes.find((n) => n.id === activeId) ?? null : null

  const selectNote = (id: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('note', String(id))
    setSearchParams(next)
  }

  const clearNote = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('note')
    setSearchParams(next)
  }

  const handleCreate = () => {
    createNote.mutate(
      { title: null, body: '' },
      { onSuccess: (n) => selectNote(n.id) },
    )
  }

  const isTrash = filter.kind === 'trash'
  // In trash mode the right pane is always empty (action-only list). On
  // mobile we still want the list visible by default so the user can act.
  const showEditor = isTrash ? !isMobile : isMobile ? activeNote !== null : true
  const showList = isTrash ? true : isMobile ? activeNote === null : true

  const counts = {
    all: allNotes.length,
    pinned: pinnedCount,
    trash: trashNotes.length,
  }

  // Mobile sheet closes the picker after a filter is picked — the
  // workspace's filter state is what drives the list, so we wrap
  // setFilter to also dismiss the sheet.
  const setFilterFromSheet = (f: SidebarFilter) => {
    setFilter(f)
    setFiltersSheetOpen(false)
  }

  return (
    <div className={styles.root}>
      <AppSidebar brand="메모" label="메모 보관함">
        <NoteSidebarBody
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          tags={tags}
        />
      </AppSidebar>
      {showList && (
        <div className={styles.list}>
          {isTrash ? (
            <TrashList
              notes={trashNotes}
              loading={trashQuery.isLoading}
              onOpenFilters={() => setFiltersSheetOpen(true)}
              onRestore={(id) => restoreNote.mutate(id)}
              onDeleteForever={(id) => deleteForever.mutate(id)}
            />
          ) : (
            <NoteList
              notes={filtered}
              activeId={activeId}
              loading={notesQuery.isLoading}
              filterLabel={describeFilter(filter)}
              onSelect={selectNote}
              onCreate={handleCreate}
              onOpenFilters={() => setFiltersSheetOpen(true)}
              onContextMenu={(e, note) => {
                e.preventDefault()
                setRowMenu({ note, x: e.clientX, y: e.clientY })
              }}
            />
          )}
        </div>
      )}
      {showEditor && (
        <div className={styles.editor}>
          {isTrash ? (
            <NoteEditorEmpty />
          ) : activeNote ? (
            <NoteEditor note={activeNote} onDeleted={clearNote} onBack={clearNote} />
          ) : (
            <NoteEditorEmpty />
          )}
        </div>
      )}

      <AppSidebarSheet
        open={filtersSheetOpen}
        onOpenChange={setFiltersSheetOpen}
        title="필터"
      >
        <NoteSidebarBody
          filter={filter}
          onFilterChange={setFilterFromSheet}
          counts={counts}
          tags={tags}
        />
      </AppSidebarSheet>

      <NoteListContextMenu
        state={rowMenu}
        onClose={() => setRowMenu(null)}
        onAfterDuplicate={selectNote}
        onAfterDelete={(id) => {
          if (activeId === id) clearNote()
        }}
      />
    </div>
  )
}
