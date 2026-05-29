import type { InstallmentInput, InstallmentOutput } from '../types'

/**
 * 원리금균등 installment (equal monthly payment).
 *
 *   M = P · r(1+r)^n / ((1+r)^n - 1)
 *
 * When the rate is 0, M reduces to P / n. Returns total interest + total
 * paid for the summary card.
 */
export function computeInstallment(input: InstallmentInput): InstallmentOutput {
  const { principal, annualRate, months } = input
  if (principal <= 0 || months <= 0) {
    throw new Error('원금과 개월 수는 0보다 커야 합니다.')
  }
  const r = annualRate / 100 / 12
  const monthly =
    r === 0
      ? principal / months
      : (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1)
  const totalPaid = monthly * months
  const totalInterest = totalPaid - principal
  return { monthly, totalInterest, totalPaid }
}
