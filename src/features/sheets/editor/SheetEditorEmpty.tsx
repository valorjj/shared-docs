import { Table2 } from 'lucide-react'
import styles from './SheetEditorEmpty.module.css'

export default function SheetEditorEmpty() {
  return (
    <div className={styles.root}>
      <span className={styles.icon} aria-hidden="true">
        <Table2 size={28} strokeWidth={1.5} />
      </span>
      <p className={styles.title}>시트를 선택하세요</p>
      <p className={styles.sub}>왼쪽에서 시트를 고르거나 새 시트를 만들어 보세요.</p>
    </div>
  )
}
