import { Link, NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Database, Calendar, Settings, type LucideIcon } from 'lucide-react'
import { useIsMobile } from '../../lib/useMediaQuery'
import { useAuth } from '../../auth/useAuth'
import './TopNav.css'

type NavItem = {
  to: string
  Icon: LucideIcon
  label: string
  adminOnly?: boolean
}

const ITEMS: NavItem[] = [
  { to: '/',         Icon: BookOpen, label: '가이드' },
  { to: '/data',     Icon: Database, label: '데이터' },
  { to: '/calendar', Icon: Calendar, label: '캘린더' },
  { to: '/admin',    Icon: Settings, label: '관리', adminOnly: true },
]

const HIDDEN_PREFIXES = ['/login', '/auth']

export default function TopNav() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const location = useLocation()

  if (isMobile) return null
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null

  const items = ITEMS.filter((it) => !it.adminOnly || user?.role === 'ADMIN')

  return (
    <header className="top-nav" aria-label="주 탐색">
      <div className="top-nav__inner">
        <Link to="/" className="top-nav__brand" aria-label="홈으로">
          <span className="top-nav__brand-mark">📘</span>
          <span className="top-nav__brand-text">우리의 가이드북</span>
        </Link>

        <nav className="top-nav__items">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                `top-nav__item${isActive ? ' top-nav__item--active' : ''}`
              }
            >
              <span className="top-nav__icon" aria-hidden="true">
                <it.Icon size={16} strokeWidth={2} />
              </span>
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="top-nav__user" title={user.name}>
            {user.pictureUrl ? (
              <img className="top-nav__avatar" src={user.pictureUrl} alt="" />
            ) : (
              <span className="top-nav__avatar top-nav__avatar--initial" aria-hidden="true">
                {user.name?.[0] ?? '·'}
              </span>
            )}
            <span className="top-nav__user-name">{user.name}</span>
          </div>
        )}
      </div>
    </header>
  )
}
