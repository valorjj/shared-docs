export type DeadlineTone = 'danger' | 'accent' | 'neutral'

/** Local YYYY-MM-DD for a Date (used to read "today" without UTC drift). */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar-day difference target − base, both 'YYYY-MM-DD'. Positive = future. */
export function daysUntil(baseIso: string, targetIso: string): number {
  const [by, bm, bd] = baseIso.split('-').map(Number)
  const [ty, tm, td] = targetIso.split('-').map(Number)
  const base = Date.UTC(by, bm - 1, bd)
  const target = Date.UTC(ty, tm - 1, td)
  return Math.round((target - base) / 86_400_000)
}

/** Live D-day chip text + tone for a deadline relative to today. */
export function deadlineLabel(deadlineIso: string, todayIso: string): { text: string; tone: DeadlineTone } {
  const days = daysUntil(todayIso, deadlineIso)
  if (days < 0) return { text: '지남', tone: 'danger' }
  if (days === 0) return { text: '오늘', tone: 'accent' }
  if (days === 1) return { text: '내일', tone: 'accent' }
  return { text: `${days}일 남음`, tone: 'neutral' }
}

/** Frozen annotation for a settled (decided/completed) item with a deadline:
 *  was it settled on/before the deadline (기한 내) or after (기한 지나)? */
export function settledDeadlineLabel(deadlineIso: string, settledAtIso: string, noun: string): { text: string; tone: DeadlineTone } {
  const settledDay = toLocalDateString(new Date(settledAtIso))
  const onTime = daysUntil(deadlineIso, settledDay) <= 0
  return onTime ? { text: `기한 내 ${noun}`, tone: 'neutral' } : { text: `기한 지나 ${noun}`, tone: 'danger' }
}

/** Full date for the chip's title tooltip: 'YYYY.MM.DD'. */
export function fullDate(deadlineIso: string): string {
  const [y, m, d] = deadlineIso.split('-')
  return `${y}.${m}.${d}`
}
