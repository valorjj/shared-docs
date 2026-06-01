import { Outlet, useLocation } from 'react-router-dom'
import { SearchPaletteProvider } from '../../features/search/SearchPaletteProvider'
import { SettingsProvider } from '../../features/settings/SettingsProvider'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { Spinner } from '../ui'
import BottomNav from './BottomNav'
import TopNav from './TopNav'
import './MobileShell.css'

const NO_PAD_PREFIXES = ['/login', '/auth', '/doc']

export default function MobileShell() {
  const location = useLocation()
  const { ready } = useActiveWorkspace()
  const hasBottomNav = !NO_PAD_PREFIXES.some((p) => location.pathname.startsWith(p))

  // Hold the authed app until the active workspace is resolved. Resource pages
  // mount only after this, so no request fires without an X-Workspace-Id header
  // (and switching workspaces shows this same brief loading state).
  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-sans)',
        }}
        aria-busy="true"
      >
        <Spinner label="워크스페이스 불러오는 중…" />
      </div>
    )
  }

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
