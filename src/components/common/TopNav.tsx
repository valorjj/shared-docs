import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Calculator,
  Calendar,
  Database,
  LogOut,
  Search,
  Settings,
  Settings2,
  Share2,
  Table2,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { useIsMobile } from '../../lib/useMediaQuery'
import { useAuth } from '../../auth/useAuth'
import { useSearchPalette } from '../../features/search/searchContext'
import { useSettings } from '../../features/settings/settingsContext'
import WorkspaceSwitcher from '../../features/workspaces/WorkspaceSwitcher'
import { Kbd } from '../ui'
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu'
import './TopNav.css'

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
  { to: '/decisions', Icon: Vote,      label: '결정' },
  { to: '/shared',   Icon: Share2,     label: '공유' },
  { to: '/admin',    Icon: Settings,   label: '관리', adminOnly: true },
]

const HIDDEN_PREFIXES = ['/login', '/auth']

export default function TopNav() {
  const isMobile = useIsMobile()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const search = useSearchPalette()
  const settings = useSettings()

  if (isMobile) return null
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null

  const items = ITEMS.filter((it) => !it.adminOnly || user?.role === 'ADMIN')
  const cmdLabel = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="top-nav" aria-label="주 탐색">
      <div className="top-nav__inner">
        <Link to="/" className="top-nav__brand" aria-label="홈으로">
          <span className="top-nav__brand-mark" aria-hidden="true">
            <BookOpen size={18} strokeWidth={2} />
          </span>
          <span className="top-nav__brand-text">우리의 가이드북</span>
        </Link>

        <WorkspaceSwitcher />

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

        <button
          type="button"
          className="top-nav__search"
          onClick={() => search.setOpen(true)}
          aria-label="검색"
          title="검색"
        >
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <span className="top-nav__search-label">검색</span>
          <span className="top-nav__search-kbd" aria-hidden="true">
            <Kbd>{cmdLabel}</Kbd><Kbd>K</Kbd>
          </span>
        </button>

        <button
          type="button"
          className="top-nav__iconbtn"
          onClick={() => settings.setDialogOpen(true)}
          aria-label="설정"
          title="설정"
        >
          <Settings2 size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>

        {user && (
          <Menu
            trigger={
              <button type="button" className="top-nav__user" title={user.name} aria-label="계정 메뉴">
                {user.pictureUrl ? (
                  <img className="top-nav__avatar" src={user.pictureUrl} alt="" />
                ) : (
                  <span className="top-nav__avatar top-nav__avatar--initial" aria-hidden="true">
                    {user.name?.[0] ?? '·'}
                  </span>
                )}
                <span className="top-nav__user-name">{user.name}</span>
              </button>
            }
          >
            <div className="top-nav__user-meta">
              <div className="top-nav__user-meta-name">{user.name}</div>
              <div className="top-nav__user-meta-email">{user.email}</div>
            </div>
            <MenuSeparator />
            <MenuItem
              onSelect={handleLogout}
              icon={<LogOut size={14} strokeWidth={1.75} />}
              destructive
            >
              로그아웃
            </MenuItem>
          </Menu>
        )}
      </div>
    </header>
  )
}
