import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

/**
 * Gray-block placeholder for content that's still loading. Subtle shimmer
 * animation runs across the surface to signal "this is loading" without
 * the chrome of a spinner.
 *
 * Compose Skeletons to mimic the shape of the content they replace —
 * a note list row uses two stacked Skeletons (title + preview line)
 * rather than a single big block, so the layout stays stable when real
 * data arrives.
 *
 * `width` and `height` accept any CSS length; numbers are treated as px.
 */
export function Skeleton({
  width,
  height = 12,
  radius,
  className,
  ariaHidden = true,
}: {
  width?: number | string
  height?: number | string
  /** Override the default 4px radius — use `pill` for round chips, etc. */
  radius?: number | string | 'pill'
  className?: string
  /** Skeletons are decorative by default. Pass false for cases where the
   *  loading region itself should announce (rare). */
  ariaHidden?: boolean
}) {
  const style: CSSProperties = {
    width: width ?? '100%',
    height,
    borderRadius: radius === 'pill' ? 999 : radius,
  }
  return (
    <span
      aria-hidden={ariaHidden}
      className={`${styles.skeleton}${className ? ` ${className}` : ''}`}
      style={style}
    />
  )
}
