import { Trash2 } from 'lucide-react'
import PinButton from '../../notes/shared/PinButton'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import type { SheetFull } from '../types'
import styles from './SheetEditorMeta.module.css'

type Props = {
  sheet: SheetFull
  saving: boolean
  onTogglePin: () => void
  onDelete: () => void
}

export default function SheetEditorMeta({ sheet, saving, onTogglePin, onDelete }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.author}>{sheet.createdBy.name}</span>
        <span className={styles.sep} aria-hidden="true">·</span>
        <span className={styles.time}>{formatRelativeTime(sheet.updatedAt)}</span>
        {saving && (
          <>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.saving}>저장 중…</span>
          </>
        )}
      </div>
      <div className={styles.right}>
        <PinButton pinned={sheet.pinned} onToggle={onTogglePin} />
        <button
          type="button"
          className={styles.delete}
          onClick={() => {
            if (window.confirm('이 시트를 삭제할까요?')) onDelete()
          }}
          aria-label="시트 삭제"
          title="시트 삭제"
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
