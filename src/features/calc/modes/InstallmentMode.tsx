import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeInstallment } from '../compute/installment'
import { formatKRW } from '../format'
import type { InstallmentInput, InstallmentOutput } from '../types'
import styles from './SpecializedMode.module.css'

export default function InstallmentMode() {
  const [principal, setPrincipal] = useState<number>(0)
  const [annualRate, setAnnualRate] = useState<number>(5)
  const [months, setMonths] = useState<number>(12)
  const [result, setResult] = useState<InstallmentOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: InstallmentInput = { principal, annualRate, months }
      const out = computeInstallment(input)
      setResult(out)
      create.mutate({
        mode: 'INSTALLMENT',
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
          <Label htmlFor="calc-inst-principal">원금 (₩)</Label>
          <Input
            id="calc-inst-principal"
            type="number"
            min="0"
            inputMode="decimal"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
          />
        </Field>
        <Field>
          <Label htmlFor="calc-inst-rate">연이율 (%)</Label>
          <Input
            id="calc-inst-rate"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={annualRate}
            onChange={(e) => setAnnualRate(Number(e.target.value) || 0)}
          />
        </Field>
        <Field>
          <Label htmlFor="calc-inst-months">개월</Label>
          <Input
            id="calc-inst-months"
            type="number"
            min="1"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 1)}
          />
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
        <div className={styles.resultCard} aria-live="polite">
          <div className={styles.resultPrimary}>
            월 납입 <strong>{formatKRW(result.monthly)}</strong>
          </div>
          <div className={styles.resultMeta}>
            총 이자 {formatKRW(result.totalInterest)} · 총 상환 {formatKRW(result.totalPaid)}
          </div>
        </div>
      )}
    </form>
  )
}
