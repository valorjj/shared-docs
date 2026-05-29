import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label, Tabs } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeDate } from '../compute/date'
import type { CalcEntry, DateInput, DateOutput, DateSubMode } from '../types'
import styles from './SpecializedMode.module.css'

const SUBMODE_LABELS: Record<DateSubMode, string> = {
  D_DAY: 'D-day',
  BETWEEN: '사이 일수',
  WORKING_DAYS: '영업일',
}
const SUBMODES: DateSubMode[] = ['D_DAY', 'BETWEEN', 'WORKING_DAYS']

const today = () => new Date().toISOString().slice(0, 10)

type Props = {
  seedEntry?: CalcEntry | null
}

type SeedDateInput = {
  mode?: DateSubMode
  target?: string
  from?: string
  to?: string
}

function seedInput(seed: CalcEntry | null): SeedDateInput {
  if (!seed) return {}
  try {
    return JSON.parse(seed.inputJson) as SeedDateInput
  } catch {
    return {}
  }
}

function seedOutput(seed: CalcEntry | null): DateOutput | null {
  if (!seed) return null
  try {
    return JSON.parse(seed.resultJson) as DateOutput
  } catch {
    return null
  }
}

export default function DateMode({ seedEntry = null }: Props) {
  const seed = seedInput(seedEntry)
  const [submode, setSubmode] = useState<DateSubMode>(seed.mode ?? 'D_DAY')
  const [target, setTarget] = useState<string>(seed.target ?? today())
  const [from, setFrom] = useState<string>(seed.from ?? today())
  const [to, setTo] = useState<string>(seed.to ?? today())
  const [result, setResult] = useState<DateOutput | null>(() => seedOutput(seedEntry))
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: DateInput =
        submode === 'D_DAY'
          ? { mode: 'D_DAY', target }
          : submode === 'BETWEEN'
            ? { mode: 'BETWEEN', from, to }
            : { mode: 'WORKING_DAYS', from, to }
      const out = computeDate(input)
      setResult(out)
      create.mutate({
        mode: 'DATE',
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
      {seedEntry && (
        <div className={styles.seedBanner}>
          기록을 불러왔습니다
          {seedEntry.label ? ` — "${seedEntry.label}"` : ''}.
          저장하면 새 항목으로 추가됩니다.
        </div>
      )}
      <div className={styles.dateSubTabs}>
        <Tabs<DateSubMode>
          items={SUBMODES.map((m) => ({ key: m, label: SUBMODE_LABELS[m] }))}
          value={submode}
          onChange={setSubmode}
        />
      </div>

      {submode === 'D_DAY' ? (
        <Field>
          <Label htmlFor="calc-date-target">목표 날짜</Label>
          <Input
            id="calc-date-target"
            type="date"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
      ) : (
        <div className={styles.fields}>
          <Field>
            <Label htmlFor="calc-date-from">시작일</Label>
            <Input
              id="calc-date-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="calc-date-to">종료일</Label>
            <Input
              id="calc-date-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
      )}

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
            <strong>{result.description}</strong>
          </div>
        </div>
      )}
    </form>
  )
}
