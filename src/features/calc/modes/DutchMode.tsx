import { useState, type FormEvent } from 'react'
import { Calculator, Plus, X } from 'lucide-react'
import { Button, ErrorText, Field, IconButton, Input, Label, Select } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeDutch } from '../compute/dutch'
import { formatCurrency } from '../format'
import type { DutchInput, DutchOutput, DutchShare } from '../types'
import styles from './SpecializedMode.module.css'

const CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY']

export default function DutchMode() {
  const [total, setTotal] = useState<number>(0)
  const [currency, setCurrency] = useState<string>('KRW')
  const [tipPct, setTipPct] = useState<number>(0)
  const [shares, setShares] = useState<DutchShare[]>([
    { label: '나', weight: 1 },
    { label: '상대', weight: 1 },
  ])
  const [result, setResult] = useState<DutchOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCalcEntry()

  const setShareLabel = (i: number, label: string) => {
    setShares((prev) => prev.map((s, idx) => (idx === i ? { ...s, label } : s)))
  }
  const setShareWeight = (i: number, weight: number) => {
    setShares((prev) => prev.map((s, idx) => (idx === i ? { ...s, weight } : s)))
  }
  const removeShare = (i: number) => {
    setShares((prev) => prev.filter((_, idx) => idx !== i))
  }
  const addShare = () => {
    setShares((prev) => [...prev, { label: `인원 ${prev.length + 1}`, weight: 1 }])
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: DutchInput = { total, currency, tipPct, shares }
      const out = computeDutch(input)
      setResult(out)
      create.mutate({
        mode: 'DUTCH',
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
          <Label htmlFor="calc-dutch-total">총액</Label>
          <Input
            id="calc-dutch-total"
            type="number"
            min="0"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(Number(e.target.value) || 0)}
          />
        </Field>
        <Field>
          <Label htmlFor="calc-dutch-currency">통화</Label>
          <Select
            id="calc-dutch-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="calc-dutch-tip">팁 (%)</Label>
          <Input
            id="calc-dutch-tip"
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={tipPct}
            onChange={(e) => setTipPct(Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      <Label>인원과 비중</Label>
      {shares.map((s, i) => (
        <div key={i} className={styles.shareRow}>
          <Field>
            <Input
              type="text"
              value={s.label}
              placeholder="이름"
              onChange={(e) => setShareLabel(i, e.target.value)}
            />
          </Field>
          <Field>
            <Input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={s.weight}
              onChange={(e) => setShareWeight(i, Number(e.target.value) || 0)}
            />
          </Field>
          <IconButton
            label="삭제"
            variant="ghost"
            size="sm"
            onClick={() => removeShare(i)}
            disabled={shares.length <= 1}
          >
            <X size={14} strokeWidth={2} />
          </IconButton>
        </div>
      ))}
      <div className={styles.shareRowAdd}>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={addShare}
          leading={<Plus size={14} strokeWidth={2} />}
        >
          인원 추가
        </Button>
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
          {result.perShare.map((s, i) => (
            <div key={i} className={styles.resultPrimary}>
              {s.label}: <strong>{formatCurrency(s.amount, currency)}</strong>
            </div>
          ))}
          <div className={styles.resultMeta}>
            총 합계 (팁 포함): {formatCurrency(result.grandTotal, currency)}
          </div>
        </div>
      )}
    </form>
  )
}
