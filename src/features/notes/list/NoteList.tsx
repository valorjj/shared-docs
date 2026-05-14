import type { Note } from '../types'
import NoteListEmpty from './NoteListEmpty'
import NoteListHeader from './NoteListHeader'
import NoteListItem from './NoteListItem'
import styles from './NoteList.module.css'

type Props = {
  notes: Note[]
  activeId: number | null
  loading: boolean
  onSelect: (id: number) => void
  onCreate: () => void
}

export default function NoteList({ notes, activeId, loading, onSelect, onCreate }: Props) {
  return (
    <div className={styles.root}>
      <NoteListHeader count={notes.length} onCreate={onCreate} />
      <div className={styles.scroll}>
        {loading && notes.length === 0 ? (
          <div className={styles.loading}>불러오는 중…</div>
        ) : notes.length === 0 ? (
          <NoteListEmpty onCreate={onCreate} />
        ) : (
          <ul className={styles.list}>
            {notes.map((n) => (
              <NoteListItem
                key={n.id}
                note={n}
                active={n.id === activeId}
                onClick={() => onSelect(n.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
