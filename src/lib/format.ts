export function formatMoney(amount: number, currency: string, locale = 'ko-KR'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`
  }
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function currentMonthString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthBounds(yyyyMm: string): { from: string; to: string } {
  const [y, m] = yyyyMm.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(first), to: fmt(last) }
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function formatMonthLabel(yyyyMm: string, locale = 'ko-KR'): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(y, m - 1, 1))
}
