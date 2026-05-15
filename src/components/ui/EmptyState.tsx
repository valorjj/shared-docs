import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

/**
 * Bear-style empty placeholder. Use across feature list pages whenever
 * the user has *no* rows — pairs an icon (optional), title, and an
 * optional call-to-action button.
 *
 * The icon slot accepts any ReactNode but the project convention is to
 * pass a Lucide icon element (32px, strokeWidth 1.5). Background tile is
 * a hairline-bordered circle to match the existing memo/sheet/link
 * empty states that were ad-hoc'd before this primitive existed.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'block',
}: {
  /** Pass `<LucideIcon size={24} strokeWidth={1.5} />`. */
  icon?: ReactNode
  title: string
  description?: string
  /** Pre-built `<Button>` (or any element). Renders below the description. */
  action?: ReactNode
  /**
   * `block` — full block with padding, used in main content areas.
   * `inline` — compact, used inside cards / panels (no extra padding,
   * smaller font sizes).
   */
  variant?: 'block' | 'inline'
}) {
  return (
    <div className={`${styles.root} ${variant === 'inline' ? styles.inline : ''}`}>
      {icon && <span className={styles.iconTile} aria-hidden="true">{icon}</span>}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
