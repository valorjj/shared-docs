import { useState } from 'react'
import { MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import type { SheetFull } from '../types'
import styles from './SheetEditorMeta.module.css'

type Props = {
  sheet: SheetFull
  saving: boolean
  /** Legacy prop — sheets are household-shared after the 2026-05-28 reset
   *  and always editable. Kept for compatibility with existing callers. */
  canEdit?: boolean
  onTogglePin: () => void
  onDelete: () => void
}

export default function SheetEditorMeta({
  sheet,
  saving,
  canEdit = true,
  onTogglePin,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.author}>{sheet.createdBy.name}</span>
        <span className={styles.sep} aria-hidden="true">·</span>
        <span className={styles.time}>{formatRelativeTime(sheet.updatedAt)}</span>
        {saving && canEdit && (
          <>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.saving}>저장 중…</span>
          </>
        )}
      </div>
      <div className={styles.right}>
        {sheet.pinned && canEdit && (
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
                aria-label="시트 옵션"
                title="옵션"
              >
                <MoreHorizontal size={16} strokeWidth={1.75} />
              </button>
            }
          >
            <MenuItem
              onSelect={onTogglePin}
              icon={sheet.pinned ? <PinOff size={14} strokeWidth={1.75} /> : <Pin size={14} strokeWidth={1.75} />}
            >
              {sheet.pinned ? '고정 해제' : '시트 고정'}
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
