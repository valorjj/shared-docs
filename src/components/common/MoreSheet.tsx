import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Search, Settings2 } from 'lucide-react'
import { AppSidebarSheet } from './AppSidebarSheet'
import { secondaryItems } from './navItems'
import WorkspaceSwitcher from '../../features/workspaces/WorkspaceSwitcher'
import { useAuth } from '../../auth/useAuth'
import { useSearchPalette } from '../../features/search/searchContext'
import { useSettings } from '../../features/settings/settingsContext'
import styles from './MoreSheet.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Mobile 더보기 sheet: the secondary destinations that don't earn a
 * bottom-bar slot, plus the utilities (검색/설정) and account controls, and
 * the workspace switcher — which otherwise has no home on mobile (it lives
 * only in the desktop TopNav).
 */
export default function MoreSheet({ open, onOpenChange }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const search = useSearchPalette()
  const settings = useSettings()

  const secondary = secondaryItems(user?.role === 'ADMIN')

  const close = () => onOpenChange(false)

  const handleLogout = () => {
    close()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <AppSidebarSheet open={open} onOpenChange={onOpenChange} title="더보기">
      <div className={styles.workspace}>
        <WorkspaceSwitcher />
      </div>

      <nav className={styles.group} aria-label="추가 메뉴">
        {secondary.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={close}
            className={({ isActive }) =>
              `${styles.row}${isActive ? ` ${styles.rowActive}` : ''}`
            }
          >
            <it.Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.group}>
        <button
          type="button"
          className={styles.row}
          onClick={() => {
            close()
            search.setOpen(true)
          }}
        >
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          <span>검색</span>
        </button>
        <button
          type="button"
          className={styles.row}
          onClick={() => {
            close()
            settings.setDialogOpen(true)
          }}
        >
          <Settings2 size={18} strokeWidth={2} aria-hidden="true" />
          <span>설정</span>
        </button>
      </div>

      {user && (
        <div className={styles.account}>
          <div className={styles.accountInfo}>
            <div className={styles.accountName}>{user.name}</div>
            <div className={styles.accountEmail}>{user.email}</div>
          </div>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      )}
    </AppSidebarSheet>
  )
}
