import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import s from './BackLink.module.css'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={s.back}>
      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  )
}
