import { useEffect, useMemo, useState } from 'react'
import { Link as LinkIcon, LayoutGrid, List, Search, X } from 'lucide-react'
import {
  Page,
  PageHeader,
  PageTitle,
  BackLink,
  Fab,
  Button,
  Skeleton,
} from '../../components/ui'
import {
  useUsefulLinks,
  useUsefulLinkCategories,
  useDeleteUsefulLink,
  useRefreshLinkMeta,
  useUpdateUsefulLink,
  type UsefulLink,
} from './api'
import LinkCard from './LinkCard'
import LinkRow from './LinkRow'
import LinkAddModal from './LinkAddModal'
import LinkEditModal from './LinkEditModal'
import './links.css'

type ViewMode = 'card' | 'list'
const VIEW_KEY = 'shared-docs:links:layout:v1'

function readViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'card'
  const raw = window.localStorage.getItem(VIEW_KEY)
  return raw === 'list' ? 'list' : 'card'
}

const ALL = '전체'

export default function LinkList() {
  const { data, isLoading, isError, error, refetch } = useUsefulLinks()
  const { data: categories } = useUsefulLinkCategories()
  const del = useDeleteUsefulLink()
  const refresh = useRefreshLinkMeta()
  const update = useUpdateUsefulLink()

  const [view, setView] = useState<ViewMode>(readViewMode)
  const [category, setCategory] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<UsefulLink | null>(null)

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view)
  }, [view])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.filter((l) => {
      if (category !== ALL && l.category !== category) return false
      if (!q) return true
      return (
        (l.title ?? '').toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q) ||
        (l.note ?? '').toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.siteName ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, category, query])

  const handleDelete = (l: UsefulLink) => {
    if (confirm(`"${l.title ?? l.url}" 링크를 삭제할까요?`)) del.mutate(l.id)
  }

  const handleTogglePin = (l: UsefulLink) => {
    update.mutate({ id: l.id, payload: { pinned: !l.pinned } })
  }

  return (
    <Page>
      <PageHeader>
        <BackLink to="/data" mobileOnly>데이터</BackLink>
        <PageTitle icon={<LinkIcon size={22} strokeWidth={2} />}>유용한 링크</PageTitle>
      </PageHeader>

      <div className="links__toolbar">
        <div className="links__search">
          <Search size={14} strokeWidth={2} className="links__search-icon" aria-hidden="true" />
          <input
            type="search"
            className="links__search-input"
            placeholder="제목 · 설명 · 메모 · URL"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="링크 검색"
          />
          {query && (
            <button
              type="button"
              className="links__search-clear"
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="links__view" role="group" aria-label="레이아웃 전환">
          <button
            type="button"
            className={`links__view-btn${view === 'card' ? ' links__view-btn--active' : ''}`}
            onClick={() => setView('card')}
            aria-pressed={view === 'card'}
            aria-label="카드 레이아웃"
            title="카드"
          >
            <LayoutGrid size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`links__view-btn${view === 'list' ? ' links__view-btn--active' : ''}`}
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            aria-label="리스트 레이아웃"
            title="리스트"
          >
            <List size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <nav className="links__chips" aria-label="카테고리">
        <button
          type="button"
          className={`links__chip${category === ALL ? ' links__chip--active' : ''}`}
          onClick={() => setCategory(ALL)}
        >
          전체
          <span className="links__chip-count">{data?.length ?? 0}</span>
        </button>
        {categories?.map((c) => {
          const count = data?.filter((l) => l.category === c.name).length ?? 0
          return (
            <button
              key={c.id}
              type="button"
              className={`links__chip${category === c.name ? ' links__chip--active' : ''}`}
              onClick={() => setCategory(c.name)}
            >
              {c.name}
              <span className="links__chip-count">{count}</span>
            </button>
          )
        })}
      </nav>

      {isLoading && (
        view === 'card' ? (
          <ul className="links__grid links__grid--skeleton" aria-busy="true" aria-label="링크 불러오는 중">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="links__skeleton-card">
                <Skeleton width="100%" height={140} radius={0} />
                <div className="links__skeleton-card-body">
                  <Skeleton width={72} height={10} />
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="60%" height={11} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="links__rows" aria-busy="true" aria-label="링크 불러오는 중">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="links__skeleton-row">
                <Skeleton width={24} height={24} radius={4} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <Skeleton width="55%" height={13} />
                  <Skeleton width="35%" height={10} />
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      {isError && (
        <p className="links__status links__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
        </p>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="links__empty">
          <span className="links__empty-icon" aria-hidden="true">
            <LinkIcon size={24} strokeWidth={1.5} />
          </span>
          <p className="links__empty-title">아직 저장한 링크가 없어요</p>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            첫 링크 추가하기
          </Button>
        </div>
      )}

      {data && filtered.length === 0 && data.length > 0 && (
        <p className="links__empty-filter">조건에 맞는 링크가 없어요.</p>
      )}

      {filtered.length > 0 && (
        view === 'card' ? (
          <ul className="links__grid">
            {filtered.map((l) => (
              <li key={l.id}>
                <LinkCard
                  link={l}
                  onEdit={() => setEditing(l)}
                  onRefreshMeta={() => refresh.mutate(l.id)}
                  onTogglePin={() => handleTogglePin(l)}
                  onDelete={() => handleDelete(l)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="links__rows">
            {filtered.map((l) => (
              <li key={l.id}>
                <LinkRow
                  link={l}
                  onEdit={() => setEditing(l)}
                  onRefreshMeta={() => refresh.mutate(l.id)}
                  onTogglePin={() => handleTogglePin(l)}
                  onDelete={() => handleDelete(l)}
                />
              </li>
            ))}
          </ul>
        )
      )}

      <Fab label="링크 추가" onClick={() => setAddOpen(true)} />

      <LinkAddModal open={addOpen} onClose={() => setAddOpen(false)} />
      <LinkEditModal
        link={editing}
        onClose={() => setEditing(null)}
      />
    </Page>
  )
}
