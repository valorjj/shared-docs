import { useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu'
import CreateWorkspaceModal from './CreateWorkspaceModal'
import styles from './WorkspaceSwitcher.module.css'

/**
 * Compact workspace switcher for the top nav. Read + switch + create (Phase B);
 * rename/settings are still deferred. Kept Bear-minimal: a quiet pill showing
 * the active workspace, opening a plain list with a check on the current one and
 * a "+ 새 워크스페이스" action at the bottom.
 */
export default function WorkspaceSwitcher() {
  const { workspaces, active, setActiveId } = useActiveWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  if (!active) return null

  return (
    <>
      <Menu
        align="start"
        trigger={
          <button type="button" className={styles.trigger} aria-label="워크스페이스 전환" title={active.name}>
            <span className={styles.name}>{active.name}</span>
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        }
      >
        {workspaces.map((ws) => (
          <MenuItem
            key={ws.id}
            onSelect={() => {
              if (ws.id !== active.id) setActiveId(ws.id)
            }}
            icon={
              ws.id === active.id ? (
                <Check size={14} strokeWidth={2} />
              ) : (
                <span className={styles.checkSpacer} aria-hidden="true" />
              )
            }
          >
            {ws.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => setCreateOpen(true)} icon={<Plus size={14} strokeWidth={2} />}>
          새 워크스페이스
        </MenuItem>
      </Menu>
      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
