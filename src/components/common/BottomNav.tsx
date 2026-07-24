import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { useIsMobile } from '../../lib/useMediaQuery'
import { useAuth } from '../../auth/useAuth'
import { NAV_ITEMS, isSecondaryActive } from './navItems'
import MoreSheet from './MoreSheet'
import './BottomNav.css'

const HIDDEN_PREFIXES = ['/login', '/auth', '/doc']

export default function BottomNav() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!isMobile) return null
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null

  const primary = NAV_ITEMS.filter((it) => it.primary)
  const moreActive = isSecondaryActive(location.pathname, user?.role === 'ADMIN')

  return (
    <>
      <nav className="bottom-nav" aria-label="주 탐색">
        {primary.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
            }
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              <it.Icon size={22} strokeWidth={2} />
            </span>
            <span className="bottom-nav__label">{it.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav__item bottom-nav__item--button${moreActive ? ' bottom-nav__item--active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-label="더보기"
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            <MoreHorizontal size={22} strokeWidth={2} />
          </span>
          <span className="bottom-nav__label">더보기</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
