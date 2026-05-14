import { Filter, Plus } from 'lucide-react'
import styles from './NoteListHeader.module.css'

type Props = {
  count: number
  filterLabel: string
  onCreate: () => void
  onOpenFilters: () => void
}

export default function NoteListHeader({ count, filterLabel, onCreate, onOpenFilters }: Props) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.filter}
        onClick={onOpenFilters}
        aria-label="필터 열기"
      >
        <Filter size={14} strokeWidth={1.75} />
        <span className={styles.filterLabel}>{filterLabel}</span>
      </button>
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
