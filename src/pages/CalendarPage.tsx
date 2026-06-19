import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker, type DayButtonProps } from 'react-day-picker'
import { ko } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import {
  Cake,
  CheckSquare,
  ShoppingBag,
  ArrowLeftRight,
  Filter,
  Layers,
} from 'lucide-react'
import {
  AppSidebar,
  AppSidebarItem,
  AppSidebarSection,
} from '../components/common/AppSidebar'
import { AppSidebarSheet } from '../components/common/AppSidebarSheet'
import {
  Card,
  Section,
  Badge,
  Button,
  Row,
  Skeleton,
} from '../components/ui'
import { formatMoney } from '../lib/format'
import { useIsMobile } from '../lib/useMediaQuery'
import {
  isoOf,
  monthRange,
  useCalendarEvents,
  type CalendarEvent,
  type CalendarEventType,
} from '../features/calendar/api'
import styles from './CalendarPage.module.css'
import './CalendarPage.css'

const EVENT_TYPES: CalendarEventType[] = ['anniversary', 'todo', 'purchase', 'settlement']

type SourceMeta = {
  label: string
  color: string
  Icon: typeof Cake
}

const SOURCE_META: Record<CalendarEventType, SourceMeta> = {
  anniversary: { label: '기념일', color: '#d97706', Icon: Cake },
  todo:        { label: '할 일',  color: '#1b3a5c', Icon: CheckSquare },
  purchase:    { label: '구매',   color: '#16a34a', Icon: ShoppingBag },
  settlement:  { label: '정산',   color: '#9333ea', Icon: ArrowLeftRight },
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [month, setMonth] = useState<Date>(new Date())
  const [selected, setSelected] = useState<Date | undefined>(new Date())
  const [enabled, setEnabled] = useState<Set<CalendarEventType>>(() => new Set(EVENT_TYPES))
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)
  const [allWorkspaces, setAllWorkspaces] = useState(false)

  const range = useMemo(
    () => monthRange(month.getFullYear(), month.getMonth()),
    [month],
  )

  const { data: events, isLoading: eventsLoading } = useCalendarEvents(range.from, range.to, allWorkspaces)

  const sourceCounts = useMemo(() => {
    const counts: Record<CalendarEventType, number> = {
      anniversary: 0, todo: 0, purchase: 0, settlement: 0,
    }
    for (const e of events ?? []) counts[e.type]++
    return counts
  }, [events])

  const workspacesInView = useMemo(() => {
    const map = new Map<number, { name: string; count: number }>()
    for (const e of events ?? []) {
      const cur = map.get(e.workspaceId)
      if (cur) cur.count++
      else map.set(e.workspaceId, { name: e.workspaceName, count: 1 })
    }
    return Array.from(map, ([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [events])

  // Per-workspace toggle: store user overrides keyed by the sorted workspace-id fingerprint.
  // When the visible set changes (mode flip / month change) the fingerprint changes,
  // causing the overrides to reset so every present workspace defaults back to ON.
  const [wsOverrides, setWsOverrides] = useState<{ key: string; off: Set<number> }>({
    key: '',
    off: new Set(),
  })
  const wsKey = workspacesInView.map((w) => w.id).join(',')
  const wsOverridesRef = useRef(wsOverrides)
  wsOverridesRef.current = wsOverrides
  const activeOverrides = useMemo(
    () => wsKey === wsOverrides.key ? wsOverrides.off : new Set<number>(),
    [wsKey, wsOverrides.key, wsOverrides.off],
  )
  const enabledWorkspaces = useMemo(
    () => new Set(workspacesInView.map((w) => w.id).filter((id) => !activeOverrides.has(id))),
    [workspacesInView, activeOverrides],
  )

  const visibleEvents = useMemo(
    () =>
      (events ?? []).filter(
        (e) => enabled.has(e.type) && (!allWorkspaces || enabledWorkspaces.has(e.workspaceId)),
      ),
    [events, enabled, allWorkspaces, enabledWorkspaces],
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of visibleEvents) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [visibleEvents])

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

  const toggleSource = (t: CalendarEventType) => {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const toggleWorkspace = (id: number) => {
    const currentKey = wsOverridesRef.current.key === wsKey ? wsOverridesRef.current.key : wsKey
    const currentOff = wsOverridesRef.current.key === wsKey ? wsOverridesRef.current.off : new Set<number>()
    const nextOff = new Set(currentOff)
    if (nextOff.has(id)) nextOff.delete(id)
    else nextOff.add(id)
    setWsOverrides({ key: currentKey, off: nextOff })
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

  const filterCount = enabled.size
  const filterLabel = filterCount === EVENT_TYPES.length
    ? '모든 일정'
    : `${filterCount}개 종류`

  return (
    <div className={styles.root}>
      <AppSidebar brand="캘린더" label="캘린더 필터">
        <AppSidebarSection label="일정 종류">
          <SourceFilters
            enabled={enabled}
            counts={sourceCounts}
            onToggle={toggleSource}
          />
        </AppSidebarSection>
        {allWorkspaces && (
          <AppSidebarSection label="워크스페이스">
            <WorkspaceFilters
              workspaces={workspacesInView}
              enabled={enabledWorkspaces}
              onToggle={toggleWorkspace}
            />
          </AppSidebarSection>
        )}
      </AppSidebar>

      <main className={styles.main}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.mobileFilter}
            onClick={() => setFiltersSheetOpen(true)}
            aria-label="일정 필터"
          >
            <Filter size={14} strokeWidth={1.75} />
            <span>{filterLabel}</span>
          </button>
          <h1 className={styles.title}>캘린더</h1>
          <Button
            variant={allWorkspaces ? 'soft' : 'outline'}
            size="sm"
            onClick={() => setAllWorkspaces((v) => !v)}
            aria-pressed={allWorkspaces}
          >
            전체 워크스페이스
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>오늘</Button>
        </header>
        <p className={styles.sub}>기념일 · 마감일 · 구매 · 정산이 한눈에</p>

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
        </Card>

        <Section
          title={
            selected
              ? `${selected.getFullYear()}.${String(selected.getMonth() + 1).padStart(2, '0')}.${String(selected.getDate()).padStart(2, '0')} (${koreanWeekday(selected)})`
              : '날짜를 선택하세요'
          }
        >
          <Card padding="md">
            {eventsLoading && (
              <ul className="cal-page__list" aria-busy="true" aria-label="이 날의 일정 불러오는 중">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="cal-page__row cal-page__row--skeleton">
                    <Skeleton width={8} height={28} radius={2} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <Skeleton width={`${50 + (i * 10) % 30}%`} height={13} />
                      <Skeleton width="30%" height={10} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!eventsLoading && selected && selectedEvents.length === 0 && (
              <p className="cal-page__empty">이 날의 일정이 없습니다.</p>
            )}
            {!eventsLoading && selectedEvents.length > 0 && (
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
      </main>

      {isMobile && (
        <AppSidebarSheet
          open={filtersSheetOpen}
          onOpenChange={setFiltersSheetOpen}
          title="일정 필터"
        >
          <AppSidebarSection label="범위">
            <AppSidebarItem
              Icon={Filter}
              label="전체 워크스페이스"
              active={allWorkspaces}
              onClick={() => setAllWorkspaces((v) => !v)}
            />
          </AppSidebarSection>
          <AppSidebarSection label="일정 종류">
            <SourceFilters
              enabled={enabled}
              counts={sourceCounts}
              onToggle={toggleSource}
            />
          </AppSidebarSection>
          {allWorkspaces && (
            <AppSidebarSection label="워크스페이스">
              <WorkspaceFilters
                workspaces={workspacesInView}
                enabled={enabledWorkspaces}
                onToggle={toggleWorkspace}
              />
            </AppSidebarSection>
          )}
        </AppSidebarSheet>
      )}
    </div>
  )
}

function SourceFilters({
  enabled,
  counts,
  onToggle,
}: {
  enabled: Set<CalendarEventType>
  counts: Record<CalendarEventType, number>
  onToggle: (t: CalendarEventType) => void
}) {
  return (
    <>
      {EVENT_TYPES.map((t) => {
        const meta = SOURCE_META[t]
        const isOn = enabled.has(t)
        return (
          <AppSidebarItem
            key={t}
            Icon={meta.Icon}
            label={meta.label}
            count={counts[t]}
            active={isOn}
            onClick={() => onToggle(t)}
            iconProps={{ color: isOn ? meta.color : 'var(--c-text-placeholder)' }}
            trailing={
              <span
                className={styles.sourceDot}
                aria-hidden="true"
                style={{ background: isOn ? meta.color : 'transparent', borderColor: meta.color }}
              />
            }
          />
        )
      })}
    </>
  )
}

function WorkspaceFilters({
  workspaces,
  enabled,
  onToggle,
}: {
  workspaces: { id: number; name: string; count: number }[]
  enabled: Set<number>
  onToggle: (id: number) => void
}) {
  return (
    <>
      {workspaces.map((w) => (
        <AppSidebarItem
          key={w.id}
          Icon={Layers}
          label={w.name}
          count={w.count}
          active={enabled.has(w.id)}
          onClick={() => onToggle(w.id)}
        />
      ))}
    </>
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
              style={{ background: SOURCE_META[t].color }}
            />
          ))}
        </span>
      )}
    </button>
  )
}

function EventRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const meta = SOURCE_META[event.type]
  const Icon = meta.Icon
  const color = meta.color

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
