/** Shared formatters for calc views. KRW rounds to integer (the won
 *  has no fractional unit); decimals use ko-KR grouping. */

export function formatKRW(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function formatCurrency(n: number, currency: string): string {
  if (currency === 'KRW') return formatKRW(n)
  return `${currency} ${Number(n.toFixed(2)).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`
}

export function formatDecimal(n: number, fractionDigits = 2): string {
  return Number(n.toFixed(fractionDigits)).toLocaleString('ko-KR', {
    maximumFractionDigits: fractionDigits,
  })
}
