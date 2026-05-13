import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import TopNav from './TopNav'
import './MobileShell.css'

const NO_PAD_PREFIXES = ['/login', '/auth', '/doc']

export default function MobileShell() {
  const location = useLocation()
  const hasBottomNav = !NO_PAD_PREFIXES.some((p) => location.pathname.startsWith(p))

  return (
    <div className={`mobile-shell${hasBottomNav ? ' mobile-shell--has-nav' : ''}`}>
      <TopNav />
      <Outlet />
      <BottomNav />
    </div>
  )
}
