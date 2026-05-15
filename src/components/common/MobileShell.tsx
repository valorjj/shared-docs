import { Outlet, useLocation } from 'react-router-dom'
import { SearchPaletteProvider } from '../../features/search/SearchPaletteProvider'
import { SettingsProvider } from '../../features/settings/SettingsProvider'
import BottomNav from './BottomNav'
import TopNav from './TopNav'
import './MobileShell.css'

const NO_PAD_PREFIXES = ['/login', '/auth', '/doc']

export default function MobileShell() {
  const location = useLocation()
  const hasBottomNav = !NO_PAD_PREFIXES.some((p) => location.pathname.startsWith(p))

  return (
    <SettingsProvider>
      <SearchPaletteProvider>
        <div className={`mobile-shell${hasBottomNav ? ' mobile-shell--has-nav' : ''}`}>
          <TopNav />
          <Outlet />
          <BottomNav />
        </div>
      </SearchPaletteProvider>
    </SettingsProvider>
  )
}
