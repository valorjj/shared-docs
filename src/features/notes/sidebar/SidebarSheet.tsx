import * as Dialog from '@radix-ui/react-dialog'
import { Hash, NotebookText, Pin, Trash2 } from 'lucide-react'
import SidebarSection from './SidebarSection'
import type { SidebarFilter } from './Sidebar'
import type { TagWithCount } from '../shared/extractTags'
import sheetStyles from './SidebarSheet.module.css'
import sidebarStyles from './Sidebar.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filter: SidebarFilter
  onFilterChange: (f: SidebarFilter) => void
  counts: { all: number; pinned: number; trash: number }
  tags: TagWithCount[]
}

/**
 * Mobile-only bottom sheet that mirrors the desktop sidebar's filter list.
 * Visibility is driven by the workspace; we still rely on CSS to gate
 * presence on small viewports.
 */
export default function SidebarSheet({
  open,
  onOpenChange,
  filter,
  onFilterChange,
  counts,
  tags,
}: Props) {
  const pick = (f: SidebarFilter) => {
    onFilterChange(f)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={sheetStyles.overlay} />
        <Dialog.Content className={sheetStyles.sheet} aria-describedby={undefined}>
          <Dialog.Title className={sheetStyles.title}>필터</Dialog.Title>
          <div className={sheetStyles.handle} aria-hidden="true" />
          <div className={sheetStyles.body}>
            <nav className={sidebarStyles.nav}>
              <SidebarSection
                Icon={NotebookText}
                label="모든 메모"
                count={counts.all}
                active={filter.kind === 'all'}
                onClick={() => pick({ kind: 'all' })}
              />
              <SidebarSection
                Icon={Pin}
                label="고정됨"
                count={counts.pinned}
                active={filter.kind === 'pinned'}
                onClick={() => pick({ kind: 'pinned' })}
              />
              <SidebarSection
                Icon={Trash2}
                label="휴지통"
                count={counts.trash}
                active={filter.kind === 'trash'}
                onClick={() => pick({ kind: 'trash' })}
              />
            </nav>
            {tags.length > 0 && (
              <>
                <div className={sidebarStyles.sectionLabel}>태그</div>
                <nav className={sidebarStyles.nav} aria-label="태그">
                  {tags.map((t) => (
                    <SidebarSection
                      key={t.tag}
                      Icon={Hash}
                      label={t.tag.replace(/^#/, '')}
                      count={t.count}
                      active={filter.kind === 'tag' && filter.value === t.tag}
                      onClick={() => pick({ kind: 'tag', value: t.tag })}
                    />
                  ))}
                </nav>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
