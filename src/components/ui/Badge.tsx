import type { CSSProperties, ReactNode } from 'react'
import { hexWithAlpha } from '../../lib/color'
import s from './Badge.module.css'

export function Badge({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: string | null
  className?: string
}) {
  const style: CSSProperties | undefined = color
    ? { background: hexWithAlpha(color, 0.15), color }
    : undefined
  return (
    <span className={[s.badge, className].filter(Boolean).join(' ')} style={style}>
      <span>{children}</span>
    </span>
  )
}
