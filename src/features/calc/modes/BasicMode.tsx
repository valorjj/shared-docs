import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeBasic } from '../compute/basic'
import type { BasicInput, BasicOutput } from '../types'
import styles from './BasicMode.module.css'

export default function BasicMode() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState<BasicOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: BasicInput = { expr }
      const out = computeBasic(input)
      setResult(out)
      create.mutate({
        mode: 'BASIC',
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
      <Field>
        <Label htmlFor="calc-basic-expr">식</Label>
        <Input
          id="calc-basic-expr"
          type="text"
          inputMode="decimal"
          placeholder="예: 1500000 * 1.1"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          autoFocus
        />
      </Field>
      <Button
        variant="primary"
        type="submit"
        leading={<Calculator size={14} strokeWidth={2} />}
      >
        계산
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
      {result && !error && (
        <div className={styles.result} aria-live="polite">
          = <strong>{result.formatted}</strong>
        </div>
      )}
    </form>
  )
}
