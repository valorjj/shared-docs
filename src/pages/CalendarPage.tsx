import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker, type DayButtonProps } from 'react-day-picker'
import { ko } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import {
  Calendar as CalendarIcon,
  Cake,
  CheckSquare,
  ShoppingBag,
  ArrowLeftRight,
} from 'lucide-react'
import {
  Page,
  PageHeader,
  PageTitle,
  Card,
  Section,
  Badge,
  Button,
  Row,
} from '../components/ui'
import { formatMoney } from '../lib/format'
import {
  isoOf,
  monthRange,
  useCalendarEvents,
  type CalendarEvent,
  type CalendarEventType,
} from '../features/calendar/api'
import './CalendarPage.css'

const EVENT_TYPES: CalendarEventType[] = ['anniversary', 'todo', 'purchase', 'settlement']

const EVENT_META: Record<CalendarEventType, { label: string; color: string }> = {
  anniversary: { label: '기념일', color: '#d97706' },
  todo:        { label: '할 일',  color: '#1b3a5c' },
  purchase:    { label: '구매',   color: '#16a34a' },
  settlement:  { label: '정산',   color: '#9333ea' },
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState<Date>(new Date())
  const [selected, setSelected] = useState<Date | undefined>(new Date())

  const range = useMemo(
    () => monthRange(month.getFullYear(), month.getMonth()),
    [month],
  )

  const { data: events } = useCalendarEvents(range.from, range.to)

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events ?? []) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [events])

  const selectedEvents = selected ? eventsByDate.get(isoOf(selected)) ?? [] : []
  const selectedIso = selected ? isoOf(selected) : ''
  const selectedYearMonth = selected
    ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}`
    : ''

  const goToday = () => {
    const today = new Date()
    setMonth(today)
    setSelected(today)
  }

  const handleEventClick = (e: CalendarEvent) => {
    const ym = e.date.slice(0, 7)
    switch (e.type) {
      case 'anniversary':
        navigate('/data/anniversaries')
        break
      case 'todo':
        navigate('/data/todos')
        break
      case 'purchase':
        navigate(`/data/purchases?month=${ym}&row=${e.refId}`)
        break
      case 'settlement':
        navigate(`/data/purchases?month=${ym}`)
        break
    }
  }

  return (
    <Page>
      <PageHeader>
        <Row gap={3} justify="between" wrap>
          <PageTitle icon={<CalendarIcon size={22} strokeWidth={2} />}>캘린더</PageTitle>
          <Button variant="outline" size="sm" onClick={goToday}>
            오늘
          </Button>
        </Row>
        <p className="cal-page__sub">기념일 · 마감일 · 구매 · 정산이 한눈에</p>
      </PageHeader>

      <Card className="cal-page__grid-card" padding="sm">
        <DayPicker
          mode="single"
          locale={ko}
          selected={selected}
          onSelect={setSelected}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          components={{
            DayButton: (props: DayButtonProps) => (
              <CalendarDayButton
                {...props}
                events={eventsByDate.get(isoOf(props.day.date)) ?? []}
              />
            ),
          }}
        />
        <Legend />
      </Card>

      <Section
        title={
          selected
            ? `${selected.getFullYear()}.${String(selected.getMonth() + 1).padStart(2, '0')}.${String(selected.getDate()).padStart(2, '0')} (${koreanWeekday(selected)})`
            : '날짜를 선택하세요'
        }
      >
        <Card padding="md">
          {selected && selectedEvents.length === 0 && (
            <p className="cal-page__empty">이 날의 일정이 없습니다.</p>
          )}
          {selectedEvents.length > 0 && (
            <ul className="cal-page__list">
              {selectedEvents.map((e) => (
                <EventRow
                  key={`${e.type}-${e.refId}-${e.date}`}
                  event={e}
                  onClick={() => handleEventClick(e)}
                />
              ))}
            </ul>
          )}
          {selected && (
            <div className="cal-page__actions">
              <span className="cal-page__actions-label">이 날에 추가:</span>
              <Row gap={2} wrap>
                <Button
                  variant="soft"
                  size="sm"
                  leading={<ShoppingBag size={14} strokeWidth={2} />}
                  onClick={() => navigate(`/data/purchases?date=${selectedIso}&month=${selectedYearMonth}`)}
                >
                  구매
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  leading={<CheckSquare size={14} strokeWidth={2} />}
                  onClick={() => navigate(`/data/todos?date=${selectedIso}`)}
                >
                  할 일
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  leading={<Cake size={14} strokeWidth={2} />}
                  onClick={() => navigate(`/data/anniversaries?date=${selectedIso}`)}
                >
                  기념일
                </Button>
              </Row>
            </div>
          )}
        </Card>
      </Section>
    </Page>
  )
}

function CalendarDayButton({
  events,
  ...rest
}: DayButtonProps & { events: CalendarEvent[] }) {
  const dotTypes = new Set<CalendarEventType>()
  for (const e of events) dotTypes.add(e.type)
  return (
    <button {...rest} className={`${rest.className ?? ''} cal-day`}>
      <span className="cal-day__num">{rest.day.date.getDate()}</span>
      {dotTypes.size > 0 && (
        <span className="cal-day__dots" aria-hidden="true">
          {EVENT_TYPES.filter((t) => dotTypes.has(t)).map((t) => (
            <span
              key={t}
              className="cal-day__dot"
              style={{ background: EVENT_META[t].color }}
            />
          ))}
        </span>
      )}
    </button>
  )
}

function Legend() {
  return (
    <div className="cal-page__legend">
      {EVENT_TYPES.map((t) => (
        <span key={t} className="cal-page__legend-item">
          <span className="cal-page__legend-dot" style={{ background: EVENT_META[t].color }} />
          <span>{EVENT_META[t].label}</span>
        </span>
      ))}
    </div>
  )
}

function EventRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const Icon =
    event.type === 'anniversary' ? Cake :
    event.type === 'todo' ? CheckSquare :
    event.type === 'purchase' ? ShoppingBag :
    ArrowLeftRight
  const color = EVENT_META[event.type].color

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="cal-page__event"
        style={{ borderLeftColor: color }}
      >
        <span className="cal-page__event-icon" style={{ color }} aria-hidden="true">
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="cal-page__event-body">
          <div className="cal-page__event-title">{event.title}</div>
          <div className="cal-page__event-meta">
            {event.category && <Badge>{event.category}</Badge>}
            {event.amount != null && event.currency && (
              <span className="cal-page__event-amount">
                {formatMoney(event.amount, event.currency)}
              </span>
            )}
            {event.recurring && <span className="cal-page__event-tag">매년</span>}
            {event.type === 'todo' && <span className="cal-page__event-tag">마감일</span>}
            {event.type === 'settlement' && <span className="cal-page__event-tag">정산</span>}
          </div>
        </div>
      </button>
    </li>
  )
}

function koreanWeekday(d: Date): string {
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
}
