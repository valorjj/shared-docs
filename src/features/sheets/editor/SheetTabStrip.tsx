import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../../../components/ui'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import type { SheetWorkbook } from '../types'
import styles from './SheetTabStrip.module.css'

type Props = {
  workbook: SheetWorkbook
  onSwitch: (tabId: string) => void
  /** Undefined for VIEW recipients — hides the +/rename/delete UI. */
  onAdd?: () => void
  onRename?: (tabId: string, name: string) => void
  onDelete?: (tabId: string) => void
}

/**
 * Horizontal tab strip pinned to the bottom of the sheet editor.
 * Active tab gets the accent underline; right-click opens a small
 * menu for rename / delete (delete is hidden when only one tab
 * remains — sheets always have ≥1 tab).
 *
 * Rename is inline: double-click a tab → editable input → blur or
 * Enter commits. Escape reverts. Bear-quiet on purpose; spreadsheet
 * tab strips are functional, not decorative.
 */
export default function SheetTabStrip({
  workbook,
  onSwitch,
  onAdd,
  onRename,
  onDelete,
}: Props) {
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const menuTab = menu ? workbook.tabs.find((t) => t.id === menu.tabId) : null
  const deleteTab = confirmDeleteId
    ? workbook.tabs.find((t) => t.id === confirmDeleteId) ?? null
    : null
  const canDelete = workbook.tabs.length > 1 && onDelete != null
  const canMutate = onAdd != null && onRename != null

  return (
    <div className={styles.strip} role="tablist" aria-label="시트 탭">
      {workbook.tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          active={tab.id === workbook.activeTabId}
          editing={editingId === tab.id}
          canMutate={canMutate}
          onSwitch={() => onSwitch(tab.id)}
          onStartRename={() => setEditingId(tab.id)}
          onCommitRename={(name) => {
            if (onRename) onRename(tab.id, name)
            setEditingId(null)
          }}
          onCancelRename={() => setEditingId(null)}
          onContextMenu={(x, y) => setMenu({ tabId: tab.id, x, y })}
        />
      ))}
      {onAdd && (
        <button
          type="button"
          className={styles.add}
          onClick={onAdd}
          aria-label="탭 추가"
          title="탭 추가"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      )}
      {menuTab && menu && canMutate && (
        <ContextMenu
          open
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          ariaLabel={`${menuTab.name} 탭 메뉴`}
        >
          <ContextMenuItem
            icon={<Pencil size={14} strokeWidth={1.75} />}
            onSelect={() => setEditingId(menuTab.id)}
          >
            이름 변경
          </ContextMenuItem>
          {canDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                icon={<Trash2 size={14} strokeWidth={1.75} />}
                onSelect={() => setConfirmDeleteId(menuTab.id)}
                destructive
              >
                삭제
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}
      {deleteTab && onDelete && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirmDeleteId(null)}
          title={`${deleteTab.name} 탭을 삭제할까요?`}
          description="이 탭의 모든 데이터가 함께 사라집니다. 되돌리려면 Cmd+Z."
          confirmLabel="삭제"
          destructive
          onConfirm={() => {
            onDelete(deleteTab.id)
            setConfirmDeleteId(null)
          }}
        />
      )}
    </div>
  )
}

function TabButton({
  tab,
  active,
  editing,
  canMutate,
  onSwitch,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
}: {
  tab: { id: string; name: string }
  active: boolean
  editing: boolean
  canMutate: boolean
  onSwitch: () => void
  onStartRename: () => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
  onContextMenu: (x: number, y: number) => void
}) {
  // Keyed inner so the input mounts fresh per rename session — no
  // sync-prop-into-state pattern.
  if (editing && canMutate) return <TabRenameInput key={tab.id} initial={tab.name} onCommit={onCommitRename} onCancel={onCancelRename} />
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.tab}${active ? ` ${styles.activeTab}` : ''}`}
      onClick={onSwitch}
      onDoubleClick={(e) => {
        if (!canMutate) return
        e.stopPropagation()
        onStartRename()
      }}
      onContextMenu={(e) => {
        if (!canMutate) return
        e.preventDefault()
        e.stopPropagation()
        onContextMenu(e.clientX, e.clientY)
      }}
      title={tab.name}
    >
      {tab.name}
    </button>
  )
}

function TabRenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <input
      autoFocus
      type="text"
      className={styles.renameInput}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim()
        if (trimmed && trimmed !== initial) onCommit(trimmed)
        else onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      maxLength={40}
    />
  )
}
