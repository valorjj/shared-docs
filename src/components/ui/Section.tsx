import type { ReactNode } from 'react'
import s from './Section.module.css'

export function Section({
  title,
  children,
  className,
}: {
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={[s.section, className].filter(Boolean).join(' ')}>
      {title && <h2 className={s.title}>{title}</h2>}
      {children}
    </section>
  )
}
