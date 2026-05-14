import { NotebookText, Pin } from 'lucide-react'
import SidebarSection from './SidebarSection'
import styles from './Sidebar.module.css'

export type SidebarFilter = 'all' | 'pinned'

type Props = {
  filter: SidebarFilter
  onFilterChange: (f: SidebarFilter) => void
  counts: { all: number; pinned: number }
}

export default function Sidebar({ filter, onFilterChange, counts }: Props) {
  return (
    <aside className={styles.root} aria-label="메모 보관함">
      <div className={styles.brand}>메모</div>
      <nav className={styles.nav}>
        <SidebarSection
          Icon={NotebookText}
          label="모든 메모"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => onFilterChange('all')}
        />
        <SidebarSection
          Icon={Pin}
          label="고정됨"
          count={counts.pinned}
          active={filter === 'pinned'}
          onClick={() => onFilterChange('pinned')}
        />
      </nav>
    </aside>
  )
}
