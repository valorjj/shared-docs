import type { LucideIcon, LucideProps } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './AppSidebar.module.css'

type AppSidebarProps = {
  brand: ReactNode
  /** Accessibility label for the <aside>. */
  label?: string
  children: ReactNode
}

/**
 * Bear-style left sidebar shell. Workspaces compose their own content
 * out of `AppSidebarSection` + `AppSidebarItem`. Hidden on viewports
 * narrower than 901px — those use a slide-up sheet instead.
 */
export function AppSidebar({ brand, label, children }: AppSidebarProps) {
  return (
    <aside className={styles.root} aria-label={label}>
      <div className={styles.brand}>{brand}</div>
      {children}
    </aside>
  )
}

type AppSidebarSectionProps = {
  label?: string
  ariaLabel?: string
  children: ReactNode
}

export function AppSidebarSection({ label, ariaLabel, children }: AppSidebarSectionProps) {
  return (
    <>
      {label && <div className={styles.sectionLabel}>{label}</div>}
      <nav className={styles.nav} aria-label={ariaLabel}>
        {children}
      </nav>
    </>
  )
}

type AppSidebarItemProps = {
  Icon: LucideIcon
  label: string
  count?: number | null
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  /** Pass an optional badge slot (e.g. "준비 중" pill, colored dot). */
  trailing?: ReactNode
  /** Override icon props (color, fill) — useful for calendar source dots. */
  iconProps?: Omit<LucideProps, 'size' | 'strokeWidth'>
}

export function AppSidebarItem({
  Icon,
  label,
  count,
  active = false,
  disabled = false,
  onClick,
  trailing,
  iconProps,
}: AppSidebarItemProps) {
  return (
    <button
      type="button"
      className={`${styles.item}${active ? ` ${styles.itemActive}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.itemIcon} aria-hidden="true">
        <Icon size={15} strokeWidth={1.75} {...iconProps} />
      </span>
      <span className={styles.itemLabel}>{label}</span>
      {trailing}
      {typeof count === 'number' && <span className={styles.itemCount}>{count}</span>}
    </button>
  )
}
