import { NavLink, useLocation } from 'react-router-dom'
import { useIsMobile } from '../../lib/useMediaQuery'
import { useAuth } from '../../auth/AuthContext'
import './BottomNav.css'

type NavItem = {
  to: string
  icon: string
  label: string
  adminOnly?: boolean
}

const ITEMS: NavItem[] = [
  { to: '/',         icon: '📚', label: '가이드' },
  { to: '/data',     icon: '📊', label: '데이터' },
  { to: '/calendar', icon: '📅', label: '캘린더' },
  { to: '/admin',    icon: '⚙️', label: '관리', adminOnly: true },
]

const HIDDEN_PREFIXES = ['/login', '/auth', '/doc']

export default function BottomNav() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const location = useLocation()

  if (!isMobile) return null
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null

  const items = ITEMS.filter((it) => !it.adminOnly || user?.role === 'ADMIN')

  return (
    <nav className="bottom-nav" aria-label="주 탐색">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={({ isActive }) =>
            `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
          }
        >
          <span className="bottom-nav__icon" aria-hidden="true">{it.icon}</span>
          <span className="bottom-nav__label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
