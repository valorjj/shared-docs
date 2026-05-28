import { Hash, Lock, NotebookText, Pin, Trash2, User, Users } from 'lucide-react'
import {
  AppSidebarItem,
  AppSidebarSection,
} from '../../../components/common/AppSidebar'
import type { TagWithCount } from '../shared/extractTags'

/** Filter discriminated-union — the source of truth for which subset
 *  of the visible notes the workspace is currently showing. */
export type SidebarFilter =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'mine-private' }
  | { kind: 'shared' }
  | { kind: 'partner' }
  | { kind: 'trash' }
  | { kind: 'tag'; value: string }

type Props = {
  filter: SidebarFilter
  onFilterChange: (f: SidebarFilter) => void
  counts: {
    all: number
    pinned: number
    minePrivate: number
    shared: number
    partner: number
    trash: number
  }
  /** Label for the "partner's notes" item — derived from the auth state.
   *  When the partner's name isn't known yet, callers pass "상대" as a fallback. */
  partnerLabel: string
  tags: TagWithCount[]
}

/**
 * Memo's left rail. After the 2026-05-28 reset the rail splits the
 * world into 함께 (SHARED) / 내 비공개 (PRIVATE owned by me) / 상대 메모
 * (SHARED authored by the other partner). The legacy "공유받음" item is
 * gone — sharing is no longer a per-note ACL.
 */
export default function NoteSidebarBody({
  filter,
  onFilterChange,
  counts,
  partnerLabel,
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
      </AppSidebarSection>

      <AppSidebarSection label="시야">
        <AppSidebarItem
          Icon={Users}
          label="함께"
          count={counts.shared}
          active={filter.kind === 'shared'}
          onClick={() => onFilterChange({ kind: 'shared' })}
        />
        <AppSidebarItem
          Icon={Lock}
          label="내 비공개"
          count={counts.minePrivate}
          active={filter.kind === 'mine-private'}
          onClick={() => onFilterChange({ kind: 'mine-private' })}
        />
        <AppSidebarItem
          Icon={User}
          label={`${partnerLabel}의 메모`}
          count={counts.partner}
          active={filter.kind === 'partner'}
          onClick={() => onFilterChange({ kind: 'partner' })}
        />
      </AppSidebarSection>

      <AppSidebarSection>
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
