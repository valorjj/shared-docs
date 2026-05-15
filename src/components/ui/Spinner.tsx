import { Loader2 } from 'lucide-react'
import styles from './Spinner.module.css'

/**
 * Compact spinner for inline mutation / in-flight feedback. Use when a
 * skeleton would be wrong (the surface is already populated and we just
 * want to signal "something is happening") — autosave hints, button
 * loading states, "갱신 중…" pills.
 *
 * For initial-fetch loading states on lists, prefer {@link Skeleton}.
 */
export function Spinner({
  size = 14,
  label,
  className,
}: {
  size?: number
  /** Optional Korean label rendered to the right of the spinner. */
  label?: string
  className?: string
}) {
  return (
    <span
      className={`${styles.wrap}${className ? ` ${className}` : ''}`}
      role={label ? 'status' : undefined}
      aria-live={label ? 'polite' : undefined}
    >
      <Loader2
        size={size}
        strokeWidth={2}
        className={styles.spin}
        aria-hidden={label ? 'true' : undefined}
        aria-label={label ? undefined : '로딩 중'}
      />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  )
}
