import type { DutchInput, DutchOutput } from '../types'

/**
 * Split a total across N weighted shares plus a tip percentage.
 *
 * Equal weights (every share = 1) give the classic N-way split.
 * Uneven weights let you say "I pay 60%, partner pays 40%" by passing
 * weights of 6 and 4 (or any ratio).
 */
export function computeDutch(input: DutchInput): DutchOutput {
  const { total, tipPct, shares } = input
  if (total < 0) {
    throw new Error('총액이 0보다 작을 수 없습니다.')
  }
  if (shares.length === 0) {
    throw new Error('인원이 필요합니다.')
  }
  const grandTotal = total * (1 + tipPct / 100)
  const totalWeight = shares.reduce((s, x) => s + (x.weight > 0 ? x.weight : 0), 0)
  if (totalWeight <= 0) {
    throw new Error('비중 합이 0보다 커야 합니다.')
  }
  const perShare = shares.map((s) => ({
    label: s.label,
    amount: s.weight > 0 ? (grandTotal * s.weight) / totalWeight : 0,
  }))
  return { perShare, grandTotal }
}
