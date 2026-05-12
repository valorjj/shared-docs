import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ko } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { Calendar as CalendarIcon, Cake, CheckSquare } from 'lucide-react'
import {
  isoOf,
  monthRange,
  useCalendarEvents,
  type CalendarEvent,
} from '../features/calendar/api'
import './CalendarPage.css'

export default function CalendarPage() {
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

  const anniversaryDays = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.type === 'anniversary')
        .map((e) => parseDate(e.date)),
    [events],
  )
  const todoDays = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.type === 'todo')
        .map((e) => parseDate(e.date)),
    [events],
  )

  return (
    <div className="cal-page">
      <header className="cal-page__header">
        <h1 className="cal-page__title">
          <CalendarIcon size={22} strokeWidth={2} aria-hidden="true" />
          <span>캘린더</span>
        </h1>
        <p className="cal-page__sub">기념일 · 마감일이 한눈에</p>
      </header>

      <div className="cal-page__grid">
        <DayPicker
          mode="single"
          locale={ko}
          selected={selected}
          onSelect={setSelected}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          modifiers={{
            anniversary: anniversaryDays,
            todo: todoDays,
          }}
          modifiersClassNames={{
            anniversary: 'rdp-day--anniversary',
            todo: 'rdp-day--todo',
          }}
        />
      </div>

      <section className="cal-page__events">
        <h2 className="cal-page__events-title">
          {selected
            ? `${selected.getFullYear()}.${selected.getMonth() + 1}.${selected.getDate()} (${['일','월','화','수','목','금','토'][selected.getDay()]})`
            : '날짜를 선택하세요'}
        </h2>

        {selected && selectedEvents.length === 0 && (
          <p className="cal-page__empty">이 날의 일정이 없습니다.</p>
        )}

        <ul className="cal-page__list">
          {selectedEvents.map((e) => (
            <li
              key={`${e.type}-${e.refId}-${e.date}`}
              className={`cal-page__event cal-page__event--${e.type}`}
            >
              <span className="cal-page__event-icon" aria-hidden="true">
                {e.type === 'anniversary'
                  ? <Cake size={18} strokeWidth={2} />
                  : <CheckSquare size={18} strokeWidth={2} />}
              </span>
              <div className="cal-page__event-body">
                <div className="cal-page__event-title">{e.title}</div>
                {e.category && (
                  <div className="cal-page__event-meta">{e.category}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
