import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCreateNote, useNotes } from '../api'
import NoteEditor from '../editor/NoteEditor'
import NoteEditorEmpty from '../editor/NoteEditorEmpty'
import NoteList from '../list/NoteList'
import Sidebar, { type SidebarFilter } from '../sidebar/Sidebar'
import { buildTagCounts, noteHasTag } from '../shared/extractTags'
import { useIsMobile } from '../../../lib/useMediaQuery'
import styles from './NoteWorkspace.module.css'

export default function NoteWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const notesQuery = useNotes()
  const createNote = useCreateNote()
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<SidebarFilter>({ kind: 'all' })

  const noteParam = searchParams.get('note')
  const activeId = noteParam ? Number(noteParam) : null

  const allNotes = useMemo(() => notesQuery.data ?? [], [notesQuery.data])
  const tags = useMemo(() => buildTagCounts(allNotes), [allNotes])
  const pinnedCount = useMemo(() => allNotes.filter((n) => n.pinned).length, [allNotes])

  const filtered = useMemo(() => {
    switch (filter.kind) {
      case 'all':
        return allNotes
      case 'pinned':
        return allNotes.filter((n) => n.pinned)
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

  const showEditor = isMobile ? activeNote !== null : true
  const showList = isMobile ? activeNote === null : true

  return (
    <div className={styles.root}>
      <Sidebar
        filter={filter}
        onFilterChange={setFilter}
        counts={{ all: allNotes.length, pinned: pinnedCount }}
        tags={tags}
      />
      {showList && (
        <div className={styles.list}>
          <NoteList
            notes={filtered}
            activeId={activeId}
            loading={notesQuery.isLoading}
            onSelect={selectNote}
            onCreate={handleCreate}
          />
        </div>
      )}
      {showEditor && (
        <div className={styles.editor}>
          {activeNote ? (
            <NoteEditor note={activeNote} onDeleted={clearNote} />
          ) : (
            <NoteEditorEmpty />
          )}
        </div>
      )}
    </div>
  )
}
