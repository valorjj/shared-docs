import { Plus, Columns3, Rows3, Settings2 } from 'lucide-react'
import styles from './SheetEditorToolbar.module.css'

type Props = {
  onAddRow: () => void
  onAddColumn: () => void
  onOpenColumnSheet: () => void
}

export default function SheetEditorToolbar({ onAddRow, onAddColumn, onOpenColumnSheet }: Props) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="시트 도구">
      <button type="button" className={`${styles.btn} ${styles.desktopOnly}`} onClick={onAddRow} title="행 추가">
        <Rows3 size={14} strokeWidth={1.75} />
        <Plus size={12} strokeWidth={2.25} className={styles.plus} />
        <span>행</span>
      </button>
      <button type="button" className={`${styles.btn} ${styles.desktopOnly}`} onClick={onAddColumn} title="열 추가">
        <Columns3 size={14} strokeWidth={1.75} />
        <Plus size={12} strokeWidth={2.25} className={styles.plus} />
        <span>열</span>
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.mobileOnly}`}
        onClick={onOpenColumnSheet}
        title="열 관리"
      >
        <Settings2 size={14} strokeWidth={1.75} />
        <span>열 관리</span>
      </button>
      <span className={styles.hint}>열 이름 더블클릭 · 셀 더블클릭 편집</span>
    </div>
  )
}
