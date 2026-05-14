const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Korean relative time. "방금", "5분 전", "3시간 전", "어제", "3일 전", "YYYY-MM-DD". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const delta = now.getTime() - t
  if (delta < MIN) return '방금'
  if (delta < HOUR) return `${Math.floor(delta / MIN)}분 전`
  if (delta < DAY) return `${Math.floor(delta / HOUR)}시간 전`
  if (delta < 2 * DAY) return '어제'
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}일 전`
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
