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
import { useAuth } from '../../../auth/useAuth'
import type { Note } from '../types'
import styles from './NoteWorkspace.module.css'

function describeFilter(f: SidebarFilter, partnerLabel: string): string {
  switch (f.kind) {
    case 'all':           return '모든 메모'
    case 'pinned':        return '고정됨'
    case 'shared':        return '함께'
    case 'mine-private':  return '내 비공개'
    case 'partner':       return `${partnerLabel}의 메모`
    case 'trash':         return '휴지통'
    case 'tag':           return f.value
  }
}

// Two-person app — the partner's display name is derived from the *other*
// allowlisted account's note authorship. If no notes from the partner exist
// yet, we fall back to "상대" so the sidebar item still labels itself.
function partnerLabelFromNotes(notes: Note[], myUserId: number | undefined): string {
  if (!myUserId) return '상대'
  const partner = notes.find((n) => n.createdBy.userId !== myUserId)
  return partner?.createdBy.name ?? '상대'
}

export default function NoteWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const notesQuery = useNotes()
  const createNote = useCreateNote()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [filter, setFilter] = useState<SidebarFilter>({ kind: 'all' })
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)
  const [rowMenu, setRowMenu] = useState<NoteListContextMenuState>(null)

  const noteParam = searchParams.get('note')
  const activeId = noteParam ? Number(noteParam) : null

  const allNotes = useMemo(() => notesQuery.data ?? [], [notesQuery.data])
  const tags = useMemo(() => buildTagCounts(allNotes), [allNotes])
  const pinnedCount = useMemo(() => allNotes.filter((n) => n.pinned).length, [allNotes])
  const partnerLabel = useMemo(
    () => partnerLabelFromNotes(allNotes, user?.userId),
    [allNotes, user?.userId],
  )

  // Trash list feeds both the sidebar count and the TrashList pane.
  const trashQuery = useTrashNotes()
  const trashNotes = useMemo(() => trashQuery.data ?? [], [trashQuery.data])
  const restoreNote = useRestoreNote()
  const deleteForever = useDeleteForever()

  const counts = useMemo(() => {
    const minePrivate = allNotes.filter(
      (n) => n.visibility === 'PRIVATE' && n.createdBy.userId === user?.userId,
    ).length
    const shared = allNotes.filter((n) => n.visibility === 'WORKSPACE').length
    const partner = allNotes.filter(
      (n) => n.visibility === 'WORKSPACE' && n.createdBy.userId !== user?.userId,
    ).length
    return {
      all: allNotes.length,
      pinned: pinnedCount,
      minePrivate,
      shared,
      partner,
      trash: trashNotes.length,
    }
  }, [allNotes, pinnedCount, trashNotes.length, user?.userId])

  const filtered = useMemo(() => {
    switch (filter.kind) {
      case 'all':
        return allNotes
      case 'pinned':
        return allNotes.filter((n) => n.pinned)
      case 'mine-private':
        return allNotes.filter(
          (n) => n.visibility === 'PRIVATE' && n.createdBy.userId === user?.userId,
        )
      case 'shared':
        return allNotes.filter((n) => n.visibility === 'WORKSPACE')
      case 'partner':
        return allNotes.filter(
          (n) => n.visibility === 'WORKSPACE' && n.createdBy.userId !== user?.userId,
        )
      case 'trash':
        return [] // Trash is rendered through TrashList, not NoteList — guard.
      case 'tag':
        return allNotes.filter((n) => noteHasTag(n, filter.value))
    }
  }, [allNotes, filter, user?.userId])

  const activeNote = activeId !== null
    ? allNotes.find((n) => n.id === activeId) ?? null
    : null

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
    // New notes default to PRIVATE (current user only) — explicit "send to
    // both of us" is the toggle in the editor meta strip. Picking PRIVATE
    // here avoids accidentally pushing every scratch note to the partner.
    createNote.mutate(
      { title: null, body: '', visibility: 'PRIVATE' },
      { onSuccess: (n) => selectNote(n.id) },
    )
  }

  const isTrash = filter.kind === 'trash'
  const showEditor = isTrash ? !isMobile : isMobile ? activeNote !== null : true
  const showList = isTrash ? true : isMobile ? activeNote === null : true

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
          partnerLabel={partnerLabel}
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
              filterLabel={describeFilter(filter, partnerLabel)}
              onSelect={selectNote}
              onCreate={handleCreate}
              onOpenFilters={() => setFiltersSheetOpen(true)}
              // The partner-only view can't accept new memos — they would
              // land in the caller's PRIVATE bucket and immediately vanish
              // from the visible list — disable to keep the affordance honest.
              createDisabled={filter.kind === 'partner'}
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
          partnerLabel={partnerLabel}
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
