import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
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
  const [confirming, setConfirming] = useState(false)

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
          onClick={() => setConfirming(true)}
          aria-label="시트 삭제"
          title="시트 삭제"
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="시트를 삭제할까요?"
        description="이 시트의 모든 행과 열이 영구히 사라집니다. 되돌릴 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={onDelete}
      />
    </div>
  )
}
