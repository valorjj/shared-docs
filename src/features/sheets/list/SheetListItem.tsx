import { Pin } from 'lucide-react'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import type { SheetSummary } from '../types'
import styles from './SheetListItem.module.css'

type Props = {
  sheet: SheetSummary
  active: boolean
  onClick: () => void
}

export default function SheetListItem({ sheet, active, onClick }: Props) {
  const title = sheet.title?.trim() || '제목 없는 시트'
  return (
    <li>
      <button
        type="button"
        className={`${styles.row}${active ? ` ${styles.active}` : ''}`}
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
      >
        <div className={styles.head}>
          <span className={styles.title}>{title}</span>
          {sheet.pinned && (
            <span className={styles.pin} aria-label="고정됨" title="고정됨">
              <Pin size={12} strokeWidth={2.25} />
            </span>
          )}
        </div>
        <span className={styles.time}>{formatRelativeTime(sheet.updatedAt)}</span>
      </button>
    </li>
  )
}
