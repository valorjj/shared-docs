import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
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

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Anniversary | null>(null)

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
  const later    = useMemo(() => enriched.filter((e) => e.days > 30 || e.days < 0), [enriched])

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
    <div className="anniv">
      <header className="anniv__header">
        <Link to="/data" className="anniv__back">← 데이터</Link>
        <h1 className="anniv__title">🎉 기념일</h1>
      </header>

      {isLoading && <p className="anniv__status">불러오는 중…</p>}
      {isError && (
        <p className="anniv__status anniv__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <button type="button" onClick={() => refetch()}>다시 시도</button>
        </p>
      )}

      {data && data.length === 0 && (
        <p className="anniv__empty">아직 등록된 기념일이 없어요. + 버튼으로 추가하세요.</p>
      )}

      {upcoming.length > 0 && (
        <section className="anniv__section">
          <h2 className="anniv__section-title">다가오는 30일</h2>
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
        </section>
      )}

      {later.length > 0 && (
        <section className="anniv__section">
          <h2 className="anniv__section-title">나머지</h2>
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
        </section>
      )}

      <button
        type="button"
        className="anniv__fab"
        aria-label="기념일 추가"
        onClick={() => { setEditing(null); setFormOpen(true) }}
      >
        +
      </button>

      <AnniversaryForm
        open={formOpen}
        initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />
    </div>
  )
}

function Row({
  a, occ, days, category, onEdit, onDelete, canDelete, highlight,
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

  const catStyle = category?.color
    ? { background: hexAlpha(category.color, 0.15), color: category.color }
    : undefined

  return (
    <li className={`anniv__row${highlight ? ' anniv__row--highlight' : ''}`}>
      <div className="anniv__row-main" onClick={onEdit}>
        <div className="anniv__row-top">
          <span className="anniv__name">{a.name}</span>
          {yrs !== null && yrs > 0 && (
            <span className="anniv__years">{yrs}주년</span>
          )}
        </div>
        <div className="anniv__row-meta">
          {category && (
            <span className="anniv__cat-badge" style={catStyle}>
              {category.icon && <span>{category.icon}</span>}
              <span>{category.name}</span>
            </span>
          )}
          <span className="anniv__date">{dateLabel}</span>
          <span className={`anniv__days${days <= 7 ? ' anniv__days--soon' : ''}${days === 0 ? ' anniv__days--today' : ''}`}>
            {dayLabel}
          </span>
        </div>
        {a.gift && <div className="anniv__gift">🎁 {a.gift}</div>}
      </div>
      {canDelete && (
        <button
          type="button"
          className="anniv__del-btn"
          onClick={onDelete}
          aria-label="삭제"
        >
          🗑
        </button>
      )}
    </li>
  )
}

function koreanDay(d: Date): string {
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
}

function hexAlpha(hex: string, a: number): string {
  const m = hex.match(/^#?([\da-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${a})`
}
