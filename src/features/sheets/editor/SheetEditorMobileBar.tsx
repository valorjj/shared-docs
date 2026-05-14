import { ChevronLeft } from 'lucide-react'
import styles from './SheetEditorMobileBar.module.css'

type Props = {
  onBack: () => void
}

export default function SheetEditorMobileBar({ onBack }: Props) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.back}
        onClick={onBack}
        aria-label="목록으로"
      >
        <ChevronLeft size={20} strokeWidth={2} />
        <span>시트</span>
      </button>
    </div>
  )
}
