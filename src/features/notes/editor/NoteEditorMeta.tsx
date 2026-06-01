import { useState } from 'react'
import { Lock, MoreHorizontal, Pin, PinOff, Trash2, Users } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import { useUpdateNote } from '../api'
import { formatRelativeTime } from '../shared/formatRelativeTime'
import type { Note } from '../types'
import styles from './NoteEditorMeta.module.css'

type Props = {
  note: Note
  saving: boolean
  /** Hides every mutation affordance — used when the viewer isn't the
   *  author of a PRIVATE note (defensive; the read query already filters). */
  canEdit?: boolean
  onTogglePin: () => void
  onDelete: () => void
}

export default function NoteEditorMeta({ note, saving, canEdit = true, onTogglePin, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const updateNote = useUpdateNote()

  const isPrivate = note.visibility === 'PRIVATE'
  const toggleVisibility = () => {
    updateNote.mutate({
      id: note.id,
      payload: { visibility: isPrivate ? 'WORKSPACE' : 'PRIVATE' },
    })
  }

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.author}>{note.createdBy.name}</span>
        <span className={styles.sep} aria-hidden="true">·</span>
        <span className={styles.time}>{formatRelativeTime(note.updatedAt)}</span>
        {saving && canEdit && (
          <>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.saving}>저장 중…</span>
          </>
        )}
      </div>
      <div className={styles.right}>
        {note.pinned && canEdit && (
          <span className={styles.pinned} title="고정됨" aria-label="고정됨">
            <Pin size={14} strokeWidth={2.25} />
          </span>
        )}
        {canEdit && (
          <Menu
            trigger={
              <button
                type="button"
                className={styles.kebab}
                aria-label="메모 옵션"
                title="옵션"
              >
                <MoreHorizontal size={16} strokeWidth={1.75} />
              </button>
            }
          >
            <MenuItem
              onSelect={toggleVisibility}
              icon={
                isPrivate
                  ? <Users size={14} strokeWidth={1.75} />
                  : <Lock size={14} strokeWidth={1.75} />
              }
            >
              {isPrivate ? '공유로 전환' : '비공개로 전환'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onSelect={onTogglePin}
              icon={note.pinned ? <PinOff size={14} strokeWidth={1.75} /> : <Pin size={14} strokeWidth={1.75} />}
            >
              {note.pinned ? '고정 해제' : '메모 고정'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              destructive
              onSelect={() => setConfirming(true)}
              icon={<Trash2 size={14} strokeWidth={1.75} />}
            >
              삭제
            </MenuItem>
          </Menu>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="메모를 삭제할까요?"
        description="목록에서 사라집니다. 이 메모를 참조하던 다른 메모의 링크는 '삭제됨' 상태로 표시돼요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={onDelete}
      />
    </div>
  )
}
