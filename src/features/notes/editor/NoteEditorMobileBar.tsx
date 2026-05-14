import { ChevronLeft } from 'lucide-react'
import styles from './NoteEditorMobileBar.module.css'

type Props = {
  onBack: () => void
}

/**
 * Mobile-only bar at the top of the editor with a chevron-left back
 * button. On desktop, the list pane is always visible so this hides.
 */
export default function NoteEditorMobileBar({ onBack }: Props) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.back}
        onClick={onBack}
        aria-label="목록으로"
      >
        <ChevronLeft size={20} strokeWidth={2} />
        <span>메모</span>
      </button>
    </div>
  )
}
