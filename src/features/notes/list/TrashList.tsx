import { Trash2 } from 'lucide-react'
import type { Note } from '../types'
import NoteListHeader from './NoteListHeader'
import TrashListItem from './TrashListItem'
import styles from './NoteList.module.css'
import emptyStyles from './NoteListEmpty.module.css'

type Props = {
  notes: Note[]
  loading: boolean
  onOpenFilters: () => void
  onRestore: (id: number) => void
  onDeleteForever: (id: number) => void
}

/**
 * Read-only counterpart to {@link NoteList} for the 휴지통 filter.
 * Rows expose 복원 + 영구 삭제 instead of selection — clicking does not
 * open the editor. Restoring puts a note back into the active list and
 * re-runs the body indexer on the backend so outbound link rows return.
 */
export default function TrashList({
  notes,
  loading,
  onOpenFilters,
  onRestore,
  onDeleteForever,
}: Props) {
  return (
    <div className={styles.root}>
      <NoteListHeader
        count={notes.length}
        filterLabel="휴지통"
        onCreate={() => {}}
        onOpenFilters={onOpenFilters}
        createDisabled
      />
      <div className={styles.scroll}>
        {loading && notes.length === 0 ? (
          <div className={styles.loading}>불러오는 중…</div>
        ) : notes.length === 0 ? (
          <div className={emptyStyles.root}>
            <span className={emptyStyles.icon} aria-hidden="true">
              <Trash2 size={24} strokeWidth={1.5} />
            </span>
            <p className={emptyStyles.title}>휴지통이 비어 있어요</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {notes.map((n) => (
              <TrashListItem
                key={n.id}
                note={n}
                onRestore={() => onRestore(n.id)}
                onDeleteForever={() => onDeleteForever(n.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
