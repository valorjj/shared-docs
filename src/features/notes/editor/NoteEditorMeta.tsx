import { useState } from 'react'
import { Eye, MoreHorizontal, Pin, PinOff, Share2, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import ShareDialog from '../../share/ShareDialog'
import { formatRelativeTime } from '../shared/formatRelativeTime'
import type { Note } from '../types'
import styles from './NoteEditorMeta.module.css'

type Props = {
  note: Note
  saving: boolean
  /** Hides every mutation affordance (kebab actions + pin glyph row)
   *  and surfaces a read-only indicator instead. */
  canEdit?: boolean
  onTogglePin: () => void
  onDelete: () => void
}

export default function NoteEditorMeta({ note, saving, canEdit = true, onTogglePin, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [sharing, setSharing] = useState(false)

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
        {!canEdit && (
          <>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.viewOnly} title="공유받은 메모는 보기만 가능합니다">
              <Eye size={12} strokeWidth={1.75} aria-hidden="true" />
              보기만
            </span>
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
              onSelect={() => setSharing(true)}
              icon={<Share2 size={14} strokeWidth={1.75} />}
            >
              공유
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

      <ShareDialog
        kind="notes"
        resourceId={note.id}
        open={sharing}
        onClose={() => setSharing(false)}
      />
    </div>
  )
}
