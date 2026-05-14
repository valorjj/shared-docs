import { Plus } from 'lucide-react'
import styles from './SheetListHeader.module.css'

type Props = {
  count: number
  onCreate: () => void
}

export default function SheetListHeader({ count, onCreate }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.title}>
        <span>시트</span>
        <span className={styles.count}>{count}</span>
      </div>
      <button
        type="button"
        className={styles.add}
        onClick={onCreate}
        aria-label="새 시트"
        title="새 시트"
      >
        <Plus size={18} strokeWidth={2} />
      </button>
    </div>
  )
}
