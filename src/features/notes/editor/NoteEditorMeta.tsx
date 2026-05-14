import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import PinButton from '../shared/PinButton'
import { formatRelativeTime } from '../shared/formatRelativeTime'
import type { Note } from '../types'
import styles from './NoteEditorMeta.module.css'

type Props = {
  note: Note
  saving: boolean
  onTogglePin: () => void
  onDelete: () => void
}

export default function NoteEditorMeta({ note, saving, onTogglePin, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.author}>{note.createdBy.name}</span>
        <span className={styles.sep} aria-hidden="true">·</span>
        <span className={styles.time}>{formatRelativeTime(note.updatedAt)}</span>
        {saving && (
          <>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.saving}>저장 중…</span>
          </>
        )}
      </div>
      <div className={styles.right}>
        <PinButton pinned={note.pinned} onToggle={onTogglePin} />
        <button
          type="button"
          className={styles.delete}
          onClick={() => setConfirming(true)}
          aria-label="메모 삭제"
          title="메모 삭제"
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="메모를 삭제할까요?"
        description="이 메모와 첨부 파일을 영구히 지웁니다. 되돌릴 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={onDelete}
      />
    </div>
  )
}
