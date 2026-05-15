import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Cake, Trash2, Gift } from 'lucide-react'
import {
  Page,
  PageHeader,
  PageTitle,
  BackLink,
  Section,
  Badge,
  Fab,
  IconButton,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import {
  daysFromToday,
  nextOccurrence,
  useAnniversaries,
  useAnniversaryCategories,
  useDeleteAnniversary,
  yearsSince,
  type Anniversary,
} from './api'
import AnniversaryForm from './AnniversaryForm'
import './anniversaries.css'

export default function AnniversaryList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [searchParams, setSearchParams] = useSearchParams()

  const dateParam = searchParams.get('date')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Anniversary | null>(null)

  const clearOpenIntent = useCallback(() => {
    if (!dateParam) return
    const next = new URLSearchParams(searchParams)
    next.delete('date')
    setSearchParams(next, { replace: true })
  }, [dateParam, searchParams, setSearchParams])

  const formIsOpen = formOpen || !!dateParam

  const { data, isLoading, isError, error, refetch } = useAnniversaries()
  const { data: categories } = useAnniversaryCategories()
  const del = useDeleteAnniversary()

  const enriched = useMemo(() => {
    if (!data) return []
    const now = new Date()
    return data
      .map((a) => {
        const occ = nextOccurrence(a, now)
        return { a, occ, days: daysFromToday(occ, now) }
      })
      .sort((x, y) => x.days - y.days)
  }, [data])

  const upcoming = useMemo(() => enriched.filter((e) => e.days >= 0 && e.days <= 30), [enriched])
  const later = useMemo(() => enriched.filter((e) => e.days > 30 || e.days < 0), [enriched])

  const findCategory = (name: string) => categories?.find((c) => c.name === name)

  const handleEdit = (a: Anniversary) => {
    setEditing(a)
    setFormOpen(true)
  }

  const handleDelete = (a: Anniversary) => {
    const canDelete = a.createdBy.userId === user?.userId || isAdmin
    if (!canDelete) return
    if (confirm(`"${a.name}" 기념일을 삭제할까요?`)) {
      del.mutate(a.id)
    }
  }

  return (
    <Page>
      <PageHeader>
        <BackLink to="/data" mobileOnly>데이터</BackLink>
        <PageTitle icon={<Cake size={22} strokeWidth={2} />}>기념일</PageTitle>
      </PageHeader>

      {isLoading && (
        <ul className="anniv__list anniv__list--skeleton" aria-busy="true" aria-label="기념일 불러오는 중">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="anniv__row anniv__row--skeleton">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <Skeleton width="45%" height={16} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton width={48} height={18} radius="pill" />
                  <Skeleton width={92} height={11} />
                  <Skeleton width={48} height={11} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<Cake size={24} strokeWidth={1.5} />}
          title="아직 등록된 기념일이 없어요"
          description="+ 버튼으로 결혼기념일이나 생일을 추가해 보세요."
        />
      )}

      {upcoming.length > 0 && (
        <Section title="다가오는 30일">
          <ul className="anniv__list">
            {upcoming.map(({ a, occ, days }) => (
              <Row
                key={a.id}
                a={a}
                occ={occ}
                days={days}
                category={findCategory(a.category)}
                onEdit={() => handleEdit(a)}
                onDelete={() => handleDelete(a)}
                canDelete={a.createdBy.userId === user?.userId || isAdmin}
                highlight
              />
            ))}
          </ul>
        </Section>
      )}

      {later.length > 0 && (
        <Section title="나머지">
          <ul className="anniv__list">
            {later.map(({ a, occ, days }) => (
              <Row
                key={a.id}
                a={a}
                occ={occ}
                days={days}
                category={findCategory(a.category)}
                onEdit={() => handleEdit(a)}
                onDelete={() => handleDelete(a)}
                canDelete={a.createdBy.userId === user?.userId || isAdmin}
              />
            ))}
          </ul>
        </Section>
      )}

      <Fab
        label="기념일 추가"
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
      />

      <AnniversaryForm
        open={formIsOpen}
        initial={editing}
        initialDate={dateParam ?? undefined}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
          clearOpenIntent()
        }}
      />
    </Page>
  )
}

function Row({
  a,
  occ,
  days,
  category,
  onEdit,
  onDelete,
  canDelete,
  highlight,
}: {
  a: Anniversary
  occ: Date
  days: number
  category?: { name: string; icon: string | null; color: string | null }
  onEdit: () => void
  onDelete: () => void
  canDelete: boolean
  highlight?: boolean
}) {
  const dayLabel =
    days < 0 ? `${-days}일 전` :
    days === 0 ? '오늘' :
    days === 1 ? '내일' :
    `${days}일 후`

  const dateLabel = `${occ.getFullYear()}.${String(occ.getMonth() + 1).padStart(2, '0')}.${String(occ.getDate()).padStart(2, '0')} (${koreanDay(occ)})`

  const yrs = a.recurring ? yearsSince(a.date, occ) : null

  return (
    <li className={`anniv__row${highlight ? ' anniv__row--highlight' : ''}`}>
      <div className="anniv__row-main" onClick={onEdit}>
        <div className="anniv__row-top">
          <span className="anniv__name">{a.name}</span>
          {yrs !== null && yrs > 0 && <span className="anniv__years">{yrs}주년</span>}
        </div>
        <div className="anniv__row-meta">
          {category && (
            <Badge color={category.color ?? undefined}>{category.name}</Badge>
          )}
          <span className="anniv__date">{dateLabel}</span>
          <span
            className={`anniv__days${days <= 7 ? ' anniv__days--soon' : ''}${days === 0 ? ' anniv__days--today' : ''}`}
          >
            {dayLabel}
          </span>
        </div>
        {a.gift && (
          <div className="anniv__gift">
            <Gift size={14} strokeWidth={2} aria-hidden="true" />
            <span>{a.gift}</span>
          </div>
        )}
      </div>
      {canDelete && (
        <IconButton label="삭제" variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} strokeWidth={2} />
        </IconButton>
      )}
    </li>
  )
}

function koreanDay(d: Date): string {
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
}
