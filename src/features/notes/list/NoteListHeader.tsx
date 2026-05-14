import { Plus } from 'lucide-react'
import styles from './NoteListHeader.module.css'

type Props = {
  count: number
  onCreate: () => void
}

export default function NoteListHeader({ count, onCreate }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.title}>
        <span>메모</span>
        <span className={styles.count}>{count}</span>
      </div>
      <button
        type="button"
        className={styles.add}
        onClick={onCreate}
        aria-label="새 메모"
        title="새 메모"
      >
        <Plus size={18} strokeWidth={2} />
      </button>
    </div>
  )
}
