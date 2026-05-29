import type { DateInput, DateOutput } from '../types'

const MS_PER_DAY = 86_400_000

/** Three sub-modes:
 *   D_DAY        — days from today to a target
 *   BETWEEN      — calendar days between two dates
 *   WORKING_DAYS — Mon-Fri count in a range (no holiday table) */
export function computeDate(input: DateInput): DateOutput {
  switch (input.mode) {
    case 'D_DAY': {
      const target = parseISODate(input.target)
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const days = Math.round((target.getTime() - now.getTime()) / MS_PER_DAY)
      const desc =
        days === 0 ? '오늘' : days > 0 ? `D-${days}` : `D+${-days}`
      return { days, description: `${desc} (${input.target})` }
    }
    case 'BETWEEN': {
      const from = parseISODate(input.from)
      const to = parseISODate(input.to)
      const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
      return { days, description: `${input.from} → ${input.to}: ${days}일` }
    }
    case 'WORKING_DAYS': {
      const from = parseISODate(input.from)
      const to = parseISODate(input.to)
      if (to.getTime() < from.getTime()) {
        throw new Error('시작일이 종료일보다 늦습니다.')
      }
      let count = 0
      const d = new Date(from)
      while (d.getTime() <= to.getTime()) {
        const dow = d.getDay()
        if (dow !== 0 && dow !== 6) count++
        d.setDate(d.getDate() + 1)
      }
      return { days: count, description: `${input.from} → ${input.to}: 영업일 ${count}일` }
    }
  }
}

function parseISODate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${iso}`)
  }
  return new Date(`${iso}T00:00:00`)
}
