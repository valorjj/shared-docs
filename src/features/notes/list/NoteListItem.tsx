import { Pin } from 'lucide-react'
import { formatRelativeTime } from '../shared/formatRelativeTime'
import { noteDisplayTitle, notePreview } from '../shared/notePreview'
import type { Note } from '../types'
import styles from './NoteListItem.module.css'

type Props = {
  note: Note
  active: boolean
  onClick: () => void
}

export default function NoteListItem({ note, active, onClick }: Props) {
  const title = noteDisplayTitle(note.title, note.body)
  const preview = notePreview(note.body, 90) || '내용 없음'

  return (
    <li>
      <button
        type="button"
        className={`${styles.row}${active ? ` ${styles.active}` : ''}`}
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
      >
        <div className={styles.head}>
          <span className={styles.title}>{title}</span>
          {note.pinned && (
            <span className={styles.pin} aria-label="고정됨" title="고정됨">
              <Pin size={12} strokeWidth={2.25} />
            </span>
          )}
        </div>
        <p className={styles.preview}>{preview}</p>
        <span className={styles.time}>{formatRelativeTime(note.updatedAt)}</span>
      </button>
    </li>
  )
}
