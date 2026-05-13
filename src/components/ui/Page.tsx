import type { ReactNode } from 'react'
import s from './Page.module.css'

export function Page({ children }: { children: ReactNode }) {
  return <div className={s.page}>{children}</div>
}

export function PageHeader({ children }: { children: ReactNode }) {
  return <header className={s.header}>{children}</header>
}

export function PageTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h1 className={s.title}>
      {icon && <span className={s.titleIcon} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </h1>
  )
}
