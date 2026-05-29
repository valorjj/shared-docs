import type { LoanInput, LoanOutput, LoanScheduleRow } from '../types'

/**
 * Amortization schedule for both Korean 균등 conventions.
 *
 *  원리금균등 — fixed monthly payment; interest decreases, principal increases.
 *  원금균등   — fixed principal slice; payment + interest both decrease.
 */
export function computeLoan(input: LoanInput): LoanOutput {
  const { principal, annualRate, months, type } = input
  if (principal <= 0 || months <= 0) {
    throw new Error('원금과 개월 수는 0보다 커야 합니다.')
  }
  const r = annualRate / 100 / 12
  const schedule: LoanScheduleRow[] = []
  let balance = principal
  let totalInterest = 0

  if (type === '원리금균등') {
    const monthly =
      r === 0
        ? principal / months
        : (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1)
    for (let m = 1; m <= months; m++) {
      const interest = balance * r
      const principalPaid = monthly - interest
      balance -= principalPaid
      totalInterest += interest
      schedule.push({
        month: m,
        payment: monthly,
        principal: principalPaid,
        interest,
        balance: Math.max(balance, 0),
      })
    }
    return { firstPayment: schedule[0].payment, totalInterest, schedule }
  }

  // 원금균등 — fixed principal slice each month, interest decreases with balance.
  const principalSlice = principal / months
  for (let m = 1; m <= months; m++) {
    const interest = balance * r
    const payment = principalSlice + interest
    balance -= principalSlice
    totalInterest += interest
    schedule.push({
      month: m,
      payment,
      principal: principalSlice,
      interest,
      balance: Math.max(balance, 0),
    })
  }
  return { firstPayment: schedule[0].payment, totalInterest, schedule }
}
