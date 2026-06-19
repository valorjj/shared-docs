import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'

export type CalendarEventType = 'anniversary' | 'todo' | 'purchase' | 'settlement'

export type CalendarEvent = {
  date: string                  // YYYY-MM-DD
  type: CalendarEventType
  refId: number
  title: string
  category: string | null
  color: string | null
  icon: string | null
  recurring: boolean | null
  done: boolean | null
  amount: number | null
  currency: string | null
  workspaceId: number
  workspaceName: string
}

export const calendarKeys = {
  scope: (wsId: number | null) => ['calendar', wsId] as const,
  events: (wsId: number | null, all: boolean, from: string, to: string) =>
    ['calendar', all ? 'all' : wsId, 'events', from, to] as const,
}

async function fetchEvents(from: string, to: string, all: boolean): Promise<CalendarEvent[]> {
  const path = all ? '/api/calendar/events/all' : '/api/calendar/events'
  const { data } = await apiClient.get<CalendarEvent[]>(path, { params: { from, to } })
  return data
}

export function useCalendarEvents(from: string, to: string, all: boolean) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: calendarKeys.events(activeId, all, from, to),
    queryFn: () => fetchEvents(from, to, all),
    // per-workspace mode needs an active workspace; all-mode does not.
    enabled: (all || activeId != null) && !!(from && to),
  })
}

export function monthRange(year: number, monthIndex0: number): { from: string; to: string } {
  const first = new Date(Date.UTC(year, monthIndex0, 1))
  const last = new Date(Date.UTC(year, monthIndex0 + 1, 0))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(first), to: fmt(last) }
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
