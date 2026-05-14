import type { LucideIcon } from 'lucide-react'
import styles from './Sidebar.module.css'

type Props = {
  Icon: LucideIcon
  label: string
  count?: number | null
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}

export default function SidebarSection({
  Icon,
  label,
  count,
  active = false,
  onClick,
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      className={`${styles.section}${active ? ` ${styles.sectionActive}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.sectionIcon} aria-hidden="true">
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className={styles.sectionLabel}>{label}</span>
      {typeof count === 'number' && (
        <span className={styles.sectionCount}>{count}</span>
      )}
    </button>
  )
}
