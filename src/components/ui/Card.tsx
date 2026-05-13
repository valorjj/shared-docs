import type { ReactNode } from 'react'
import s from './Card.module.css'

type Padding = 'sm' | 'md' | 'lg' | 'none'

export function Card({
  padding = 'md',
  children,
  className,
}: {
  padding?: Padding
  children: ReactNode
  className?: string
}) {
  const padCls = padding === 'none' ? s.flush : s[`pad-${padding}`]
  return <div className={[s.card, padCls, className].filter(Boolean).join(' ')}>{children}</div>
}
