import { useState } from 'react'
import { Eye, MoreHorizontal, Pin, PinOff, Share2, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import ShareDialog from '../../share/ShareDialog'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import type { SheetFull } from '../types'
import styles from './SheetEditorMeta.module.css'

type Props = {
  sheet: SheetFull
  saving: boolean
  /** Hides every mutation affordance (kebab + pinned glyph) and shows
   *  a "보기만" indicator for VIEW recipients. */
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
  const [sharing, setSharing] = useState(false)

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
        {!canEdit && (
          <>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.viewOnly} title="공유받은 시트는 보기만 가능합니다">
              <Eye size={12} strokeWidth={1.75} aria-hidden="true" />
              보기만
            </span>
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
              onSelect={() => setSharing(true)}
              icon={<Share2 size={14} strokeWidth={1.75} />}
            >
              공유
            </MenuItem>
            <MenuSeparator />
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

      <ShareDialog
        kind="sheets"
        resourceId={sheet.id}
        open={sharing}
        onClose={() => setSharing(false)}
      />
    </div>
  )
}
