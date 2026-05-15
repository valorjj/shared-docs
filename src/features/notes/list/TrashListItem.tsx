import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { formatRelativeTime } from '../shared/formatRelativeTime'
import { noteDisplayTitle, notePreview } from '../shared/notePreview'
import type { Note } from '../types'
import styles from './TrashListItem.module.css'

type Props = {
  note: Note
  onRestore: () => void
  onDeleteForever: () => void
}

export default function TrashListItem({ note, onRestore, onDeleteForever }: Props) {
  const [confirming, setConfirming] = useState(false)
  const title = noteDisplayTitle(note.title, note.body)
  const preview = notePreview(note.body, 90) || '내용 없음'
  const deletedAt = note.deletedAt ? formatRelativeTime(note.deletedAt) : '—'

  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
      </div>
      <p className={styles.preview}>{preview}</p>
      <div className={styles.foot}>
        <span className={styles.time}>{deletedAt}에 삭제</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={onRestore}
            title="복원"
            aria-label="복원"
          >
            <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
            복원
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.destructive}`}
            onClick={() => setConfirming(true)}
            title="영구 삭제"
            aria-label="영구 삭제"
          >
            <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
            영구 삭제
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="영구 삭제할까요?"
        description="메모와 첨부 파일이 완전히 사라집니다. 되돌릴 수 없어요."
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        destructive
        onConfirm={onDeleteForever}
      />
    </li>
  )
}
