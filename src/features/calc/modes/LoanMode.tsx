import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label, Select } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeLoan } from '../compute/loan'
import { formatKRW } from '../format'
import type { LoanInput, LoanOutput, LoanType } from '../types'
import styles from './SpecializedMode.module.css'

const LOAN_TYPES: LoanType[] = ['원리금균등', '원금균등']

export default function LoanMode() {
  const [principal, setPrincipal] = useState<number>(0)
  const [annualRate, setAnnualRate] = useState<number>(5)
  const [months, setMonths] = useState<number>(12)
  const [type, setType] = useState<LoanType>('원리금균등')
  const [result, setResult] = useState<LoanOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: LoanInput = { principal, annualRate, months, type }
      const out = computeLoan(input)
      setResult(out)
      create.mutate({
        mode: 'LOAN',
        inputJson: JSON.stringify(input),
        resultJson: JSON.stringify(out),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산할 수 없습니다.')
      setResult(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.fields}>
        <Field>
          <Label htmlFor="calc-loan-principal">원금 (₩)</Label>
          <Input
            id="calc-loan-principal"
            type="number"
            min="0"
            inputMode="decimal"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
          />
        </Field>
        <Field>
          <Label htmlFor="calc-loan-rate">연이율 (%)</Label>
          <Input
            id="calc-loan-rate"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={annualRate}
            onChange={(e) => setAnnualRate(Number(e.target.value) || 0)}
          />
        </Field>
        <Field>
          <Label htmlFor="calc-loan-months">개월</Label>
          <Input
            id="calc-loan-months"
            type="number"
            min="1"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 1)}
          />
        </Field>
        <Field>
          <Label htmlFor="calc-loan-type">방식</Label>
          <Select
            id="calc-loan-type"
            value={type}
            onChange={(e) => setType(e.target.value as LoanType)}
          >
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Button
        variant="primary"
        type="submit"
        leading={<Calculator size={14} strokeWidth={2} />}
      >
        계산
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
      {result && !error && (
        <>
          <div className={styles.resultCard} aria-live="polite">
            <div className={styles.resultPrimary}>
              첫 달 <strong>{formatKRW(result.firstPayment)}</strong>
            </div>
            <div className={styles.resultMeta}>
              총 이자 {formatKRW(result.totalInterest)} · {months}개월 ({type})
            </div>
          </div>
          <button
            type="button"
            className={styles.scheduleToggle}
            onClick={() => setShowSchedule((s) => !s)}
          >
            {showSchedule ? '상환 스케줄 접기' : '상환 스케줄 펼치기'}
          </button>
          {showSchedule && (
            <table className={styles.schedule}>
              <thead>
                <tr>
                  <th>월</th>
                  <th>납입</th>
                  <th>원금</th>
                  <th>이자</th>
                  <th>잔액</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{formatKRW(row.payment)}</td>
                    <td>{formatKRW(row.principal)}</td>
                    <td>{formatKRW(row.interest)}</td>
                    <td>{formatKRW(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </form>
  )
}
