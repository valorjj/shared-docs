import { Plus, Columns3, Rows3 } from 'lucide-react'
import styles from './SheetEditorToolbar.module.css'

type Props = {
  onAddRow: () => void
  onAddColumn: () => void
}

export default function SheetEditorToolbar({ onAddRow, onAddColumn }: Props) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="시트 도구">
      <button type="button" className={styles.btn} onClick={onAddRow} title="행 추가">
        <Rows3 size={14} strokeWidth={1.75} />
        <Plus size={12} strokeWidth={2.25} className={styles.plus} />
        <span>행</span>
      </button>
      <button type="button" className={styles.btn} onClick={onAddColumn} title="열 추가">
        <Columns3 size={14} strokeWidth={1.75} />
        <Plus size={12} strokeWidth={2.25} className={styles.plus} />
        <span>열</span>
      </button>
      <span className={styles.hint}>열 이름 더블클릭 · 셀 더블클릭 편집</span>
    </div>
  )
}
