import { NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Calculator, Database, Calendar, Search, Settings, Settings2, Table2, type LucideIcon } from 'lucide-react'
import { useIsMobile } from '../../lib/useMediaQuery'
import { useAuth } from '../../auth/useAuth'
import { useSearchPalette } from '../../features/search/searchContext'
import { useSettings } from '../../features/settings/settingsContext'
import './BottomNav.css'

type NavItem = {
  to: string
  Icon: LucideIcon
  label: string
  adminOnly?: boolean
}

const ITEMS: NavItem[] = [
  { to: '/',         Icon: BookOpen,   label: '메모' },
  { to: '/sheets',   Icon: Table2,     label: '시트' },
  { to: '/data',     Icon: Database,   label: '데이터' },
  { to: '/calc',     Icon: Calculator, label: '계산' },
  { to: '/calendar', Icon: Calendar,   label: '캘린더' },
  { to: '/admin',    Icon: Settings,   label: '관리', adminOnly: true },
]

const HIDDEN_PREFIXES = ['/login', '/auth', '/doc']

export default function BottomNav() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const location = useLocation()
  const search = useSearchPalette()
  const settings = useSettings()

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
          <span className="bottom-nav__icon" aria-hidden="true">
            <it.Icon size={22} strokeWidth={2} />
          </span>
          <span className="bottom-nav__label">{it.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className="bottom-nav__item bottom-nav__item--button"
        onClick={() => search.setOpen(true)}
        aria-label="검색 열기"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <Search size={22} strokeWidth={2} />
        </span>
        <span className="bottom-nav__label">검색</span>
      </button>
      <button
        type="button"
        className="bottom-nav__item bottom-nav__item--button"
        onClick={() => settings.setDialogOpen(true)}
        aria-label="설정 열기"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <Settings2 size={22} strokeWidth={2} />
        </span>
        <span className="bottom-nav__label">설정</span>
      </button>
    </nav>
  )
}
