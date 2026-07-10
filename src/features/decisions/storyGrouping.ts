import type { PlanSummary } from './types'

export type StoryMonth = {
  key: string          // 'YYYY-MM' — stable sort/react key
  label: string        // 'YYYY.MM' — display
  plans: PlanSummary[] // anchor-ascending within the month
}

export type StoryLayout = {
  months: StoryMonth[]      // ascending (oldest first)
  upcoming: PlanSummary[]   // future-deadline ACTIVE plans, deadline-ascending
}

/**
 * A plan's place on the life-story axis. completedAt when finished, else the
 * creation date — a decision sits where it entered your life. (The design's
 * "latest decision date" tier is intentionally dropped; see the plan's Global
 * Constraints.) Returns the ISO date portion (YYYY-MM-DD).
 */
export function anchorDate(plan: PlanSummary): string {
  const iso = plan.completedAt ?? plan.createdAt
  return iso.slice(0, 10)
}

/**
 * Partition root plans into a chronological timeline + an 예정 (upcoming) bucket.
 * Upcoming = ACTIVE with a future deadline (by `today`, a YYYY-MM-DD string);
 * everything else lands on the month-grouped axis by anchor date, oldest first.
 */
export function buildStoryLayout(plans: PlanSummary[], today: string): StoryLayout {
  const upcoming: PlanSummary[] = []
  const onAxis: PlanSummary[] = []
  for (const p of plans) {
    if (p.status === 'ACTIVE' && p.deadline != null && p.deadline > today) upcoming.push(p)
    else onAxis.push(p)
  }

  const byMonth = new Map<string, PlanSummary[]>()
  for (const p of onAxis) {
    const key = anchorDate(p).slice(0, 7) // YYYY-MM
    const arr = byMonth.get(key)
    if (arr) arr.push(p)
    else byMonth.set(key, [p])
  }

  const months: StoryMonth[] = [...byMonth.keys()]
    .sort() // 'YYYY-MM' lexicographic == chronological ascending
    .map((key) => ({
      key,
      label: key.replace('-', '.'),
      plans: byMonth.get(key)!.slice().sort((a, b) => anchorDate(a).localeCompare(anchorDate(b))),
    }))

  upcoming.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  return { months, upcoming }
}
