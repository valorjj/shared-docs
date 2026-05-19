import { Skeleton } from '../../../components/ui'
import type { Note } from '../types'
import NoteListEmpty from './NoteListEmpty'
import NoteListHeader from './NoteListHeader'
import NoteListItem from './NoteListItem'
import styles from './NoteList.module.css'

type Props = {
  notes: Note[]
  activeId: number | null
  loading: boolean
  filterLabel: string
  onSelect: (id: number) => void
  onCreate: () => void
  onOpenFilters: () => void
  onContextMenu?: (e: React.MouseEvent, note: Note) => void
}

export default function NoteList({
  notes,
  activeId,
  loading,
  filterLabel,
  onSelect,
  onCreate,
  onOpenFilters,
  onContextMenu,
}: Props) {
  return (
    <div className={styles.root}>
      <NoteListHeader
        count={notes.length}
        filterLabel={filterLabel}
        onCreate={onCreate}
        onOpenFilters={onOpenFilters}
      />
      <div className={styles.scroll}>
        {loading && notes.length === 0 ? (
          <ul className={styles.list} aria-busy="true" aria-label="메모 불러오는 중">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonTitleRow}>
                  <Skeleton width="55%" height={14} />
                </div>
                <Skeleton width="85%" height={11} />
                <Skeleton width="30%" height={10} />
              </li>
            ))}
          </ul>
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
                onContextMenu={onContextMenu}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
