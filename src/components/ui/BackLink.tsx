import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import s from './BackLink.module.css'

type Props = {
  to: string
  children: ReactNode
  /** Hide on viewports ≥901px. Use on pages whose desktop layout already
   * exposes navigation (e.g. a sidebar) and the BackLink is only useful
   * on mobile / narrow screens. */
  mobileOnly?: boolean
}

export function BackLink({ to, children, mobileOnly = false }: Props) {
  return (
    <Link to={to} className={`${s.back}${mobileOnly ? ` ${s.mobileOnly}` : ''}`}>
      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  )
}
