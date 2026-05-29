export type CalcMode = 'BASIC' | 'INSTALLMENT' | 'LOAN' | 'DUTCH' | 'DATE'

export const CALC_MODES: CalcMode[] = ['BASIC', 'INSTALLMENT', 'LOAN', 'DUTCH', 'DATE']

export const CALC_MODE_LABELS: Record<CalcMode, string> = {
  BASIC:       '기본',
  INSTALLMENT: '할부',
  LOAN:        '대출',
  DUTCH:       '더치페이',
  DATE:        '날짜',
}

export type CalcUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type CalcEntry = {
  id: number
  mode: CalcMode
  inputJson: string
  resultJson: string
  label: string | null
  pinned: boolean
  createdBy: CalcUserRef
  createdAt: string
}

// Mode-specific shapes — discriminated by the parent CalcEntry.mode field.
// Stored as JSON strings on the entry and parsed at render time.

export type BasicInput = { expr: string }
export type BasicOutput = { value: number; formatted: string }

export type InstallmentInput = { principal: number; annualRate: number; months: number }
export type InstallmentOutput = { monthly: number; totalInterest: number; totalPaid: number }

export type LoanType = '원리금균등' | '원금균등'
export type LoanInput = { principal: number; annualRate: number; months: number; type: LoanType }
export type LoanScheduleRow = {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}
export type LoanOutput = {
  firstPayment: number
  totalInterest: number
  schedule: LoanScheduleRow[]
}

export type DutchShare = { label: string; weight: number }
export type DutchInput = {
  total: number
  currency: string
  tipPct: number
  shares: DutchShare[]
}
export type DutchOutput = {
  perShare: Array<{ label: string; amount: number }>
  grandTotal: number
}

export type DateSubMode = 'D_DAY' | 'BETWEEN' | 'WORKING_DAYS'
export type DateInput =
  | { mode: 'D_DAY'; target: string }
  | { mode: 'BETWEEN'; from: string; to: string }
  | { mode: 'WORKING_DAYS'; from: string; to: string }
export type DateOutput = { days: number; description: string }
