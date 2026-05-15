import { Hash, NotebookText, Pin, Trash2 } from 'lucide-react'
import {
  AppSidebarItem,
  AppSidebarSection,
} from '../../../components/common/AppSidebar'
import type { TagWithCount } from '../shared/extractTags'

/** Filter discriminated-union — the source of truth for which subset
 *  of the user's notes the workspace is currently showing. */
export type SidebarFilter =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'trash' }
  | { kind: 'tag'; value: string }

type Props = {
  filter: SidebarFilter
  onFilterChange: (f: SidebarFilter) => void
  counts: { all: number; pinned: number; trash: number }
  tags: TagWithCount[]
}

/**
 * Shared content for memo's left-rail sidebar. Used by AppSidebar on
 * desktop and AppSidebarSheet on mobile so both surfaces stay in lock
 * step — adding a new filter only touches this file.
 */
export default function NoteSidebarBody({
  filter,
  onFilterChange,
  counts,
  tags,
}: Props) {
  return (
    <>
      <AppSidebarSection>
        <AppSidebarItem
          Icon={NotebookText}
          label="모든 메모"
          count={counts.all}
          active={filter.kind === 'all'}
          onClick={() => onFilterChange({ kind: 'all' })}
        />
        <AppSidebarItem
          Icon={Pin}
          label="고정됨"
          count={counts.pinned}
          active={filter.kind === 'pinned'}
          onClick={() => onFilterChange({ kind: 'pinned' })}
        />
        <AppSidebarItem
          Icon={Trash2}
          label="휴지통"
          count={counts.trash}
          active={filter.kind === 'trash'}
          onClick={() => onFilterChange({ kind: 'trash' })}
        />
      </AppSidebarSection>

      {tags.length > 0 && (
        <AppSidebarSection label="태그" ariaLabel="태그">
          {tags.map((t) => (
            <AppSidebarItem
              key={t.tag}
              Icon={Hash}
              label={t.tag.replace(/^#/, '')}
              count={t.count}
              active={filter.kind === 'tag' && filter.value === t.tag}
              onClick={() => onFilterChange({ kind: 'tag', value: t.tag })}
            />
          ))}
        </AppSidebarSection>
      )}
    </>
  )
}
