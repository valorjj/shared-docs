import { Trash2 } from 'lucide-react'
import { EmptyState, Skeleton } from '../../../components/ui'
import type { Note } from '../types'
import NoteListHeader from './NoteListHeader'
import TrashListItem from './TrashListItem'
import styles from './NoteList.module.css'

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
          <ul className={styles.list} aria-busy="true" aria-label="휴지통 불러오는 중">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonTitleRow}>
                  <Skeleton width="50%" height={14} />
                </div>
                <Skeleton width="80%" height={11} />
                <Skeleton width="40%" height={10} />
              </li>
            ))}
          </ul>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={<Trash2 size={24} strokeWidth={1.5} />}
            title="휴지통이 비어 있어요"
            description="삭제한 메모는 여기로 옵니다."
          />
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
