import { Hash, NotebookText, Pin } from 'lucide-react'
import SidebarSection from './SidebarSection'
import type { TagWithCount } from '../shared/extractTags'
import styles from './Sidebar.module.css'

export type SidebarFilter =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'tag'; value: string }

type Props = {
  filter: SidebarFilter
  onFilterChange: (f: SidebarFilter) => void
  counts: { all: number; pinned: number }
  tags: TagWithCount[]
}

export default function Sidebar({ filter, onFilterChange, counts, tags }: Props) {
  return (
    <aside className={styles.root} aria-label="메모 보관함">
      <div className={styles.brand}>메모</div>
      <nav className={styles.nav}>
        <SidebarSection
          Icon={NotebookText}
          label="모든 메모"
          count={counts.all}
          active={filter.kind === 'all'}
          onClick={() => onFilterChange({ kind: 'all' })}
        />
        <SidebarSection
          Icon={Pin}
          label="고정됨"
          count={counts.pinned}
          active={filter.kind === 'pinned'}
          onClick={() => onFilterChange({ kind: 'pinned' })}
        />
      </nav>

      {tags.length > 0 && (
        <>
          <div className={styles.sectionLabel}>태그</div>
          <nav className={styles.nav} aria-label="태그">
            {tags.map((t) => (
              <SidebarSection
                key={t.tag}
                Icon={Hash}
                label={t.tag.replace(/^#/, '')}
                count={t.count}
                active={filter.kind === 'tag' && filter.value === t.tag}
                onClick={() => onFilterChange({ kind: 'tag', value: t.tag })}
              />
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}
