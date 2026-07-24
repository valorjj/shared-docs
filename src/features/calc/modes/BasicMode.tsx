import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, Trash } from 'lucide-react'
import { Button, Input } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeBasic } from '../compute/basic'
import type { BasicInput, BasicLine, BasicOutput, CalcEntry } from '../types'
import BasicFunctionBar from './BasicFunctionBar'
import styles from './BasicMode.module.css'

const STORAGE_KEY = 'shared-docs:calc:basic-scratchpad'
const LABEL_KEY = 'shared-docs:calc:basic-label'

const PLACEHOLDER = `# 1단계
a = 1000 * 2

# 2단계
b = a / 10

# 3단계
c = b * 10 * 6`

type Props = {
  /** When set, the scratchpad seeds from this entry instead of localStorage.
   *  Edits stay in memory while a seed is loaded — the "fresh" scratchpad
   *  in localStorage survives untouched until the user comes back to it. */
  seedEntry?: CalcEntry | null
}

export default function BasicMode({ seedEntry = null }: Props) {
  // Re-keyed by the parent on seedEntry change, so these initializers
  // run fresh whenever the user clicks a different history entry.
  const [body, setBody] = useState<string>(() => initialBody(seedEntry))
  const [label, setLabel] = useState<string>(() => initialLabel(seedEntry))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const create = useCreateCalcEntry()

  // Persist the *fresh* scratchpad to localStorage. While a seed is
  // loaded we leave localStorage alone so the user's fresh draft sits
  // safely in the background.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (seedEntry) return
    window.localStorage.setItem(STORAGE_KEY, body)
  }, [body, seedEntry])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (seedEntry) return
    window.localStorage.setItem(LABEL_KEY, label)
  }, [label, seedEntry])

  // Live evaluation — parser is fast enough that a debounce isn't worth it.
  const output = useMemo<BasicOutput>(() => computeBasic({ body }), [body])

  const insertAtCursor = (text: string, caretOffset?: number) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart ?? body.length
    const end = ta.selectionEnd ?? body.length
    const next = body.slice(0, start) + text + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + (caretOffset ?? text.length)
      ta.setSelectionRange(pos, pos)
    })
  }

  const handleSave = () => {
    if (!hasAnyResult(output)) return
    const input: BasicInput = { body }
    create.mutate(
      {
        mode: 'BASIC',
        inputJson: JSON.stringify(input),
        resultJson: JSON.stringify(output),
        label: label.trim() || null,
      },
      {
        // Leave the scratchpad as-is after save — they may want to keep
        // iterating from the same starting point. Clearing the label is
        // the only signal that "this snapshot is done".
        onSuccess: () => setLabel(''),
      },
    )
  }

  const handleClear = () => {
    if (body.trim() && !window.confirm('스크래치패드를 비울까요? 저장하지 않은 내용은 사라집니다.')) {
      return
    }
    setBody('')
    setLabel('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  // Render N rows on the rail — one per source line.
  const rows = output.lines.length > 0 ? output.lines : [{ source: '', kind: 'blank' as const }]

  return (
    <div className={styles.shell}>
      {seedEntry && (
        <div className={styles.seedBanner}>
          <span>
            기록을 불러왔습니다
            {seedEntry.label ? ` — "${seedEntry.label}"` : ''}.
            저장하면 새 항목으로 추가됩니다.
          </span>
        </div>
      )}
      <div className={styles.toolbar}>
        <Input
          className={styles.labelInput}
          placeholder="제목 (선택) — 예: 월세 계산"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={200}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!hasAnyResult(output) || create.isPending}
          leading={<Save size={14} strokeWidth={2} />}
        >
          {create.isPending ? '저장 중…' : '저장'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          leading={<Trash size={14} strokeWidth={2} />}
        >
          비우기
        </Button>
      </div>

      <BasicFunctionBar onInsert={insertAtCursor} />

      <div className={styles.scratchpad}>
        <textarea
          ref={textareaRef}
          className={styles.editor}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <div className={styles.rail} aria-label="계산 결과">
          {rows.map((line, i) => (
            <RowResult key={i} line={line} onInsert={insertAtCursor} />
          ))}
        </div>
      </div>

      <div className={styles.summary}>
        <span>
          {nonEmptyLineCount(output.lines)}단계
          {output.finalFormatted && (
            <>
              {' · 최종 '}
              <span className={styles.summaryFinal}>{output.finalFormatted}</span>
            </>
          )}
        </span>
        <span className={styles.copyHint}>
          연산자로 시작하면 이전 결과에 이어집니다 · 결과를 클릭하면 삽입돼요
        </span>
      </div>
    </div>
  )
}

function RowResult({
  line,
  onInsert,
}: {
  line: BasicLine
  onInsert: (value: string) => void
}) {
  if (line.kind === 'blank') return <div className={`${styles.row} ${styles.rowBlank}`} />
  if (line.kind === 'comment') return <div className={`${styles.row} ${styles.rowComment}`} />

  if (line.kind === 'error') {
    return (
      <div className={`${styles.row} ${styles.rowError}`} title={line.error ?? ''}>
        ! {line.error}
      </div>
    )
  }

  const isAssign = line.kind === 'assign'
  return (
    <div className={`${styles.row} ${isAssign ? styles.rowAssign : styles.rowExpr}`}>
      {isAssign && line.name && (
        <span className={styles.assignName}>{line.name} =</span>
      )}
      <button
        type="button"
        className={styles.resultBtn}
        onClick={() => onInsert(String(line.value ?? ''))}
        title={`${line.formatted} — 클릭하여 값 삽입`}
      >
        {line.formatted}
      </button>
    </div>
  )
}

function initialBody(seed: CalcEntry | null): string {
  if (seed) {
    try {
      const input = JSON.parse(seed.inputJson)
      if (typeof input.body === 'string') return input.body
      // Legacy single-line: convert to a one-line scratchpad for editing.
      if (typeof input.expr === 'string') return input.expr
    } catch {
      // fall through to localStorage / empty
    }
  }
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(STORAGE_KEY) ?? ''
}

function initialLabel(seed: CalcEntry | null): string {
  if (seed) return seed.label ?? ''
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(LABEL_KEY) ?? ''
}

function hasAnyResult(output: BasicOutput): boolean {
  return output.lines.some((l) => l.value !== undefined)
}

function nonEmptyLineCount(lines: BasicLine[]): number {
  return lines.filter((l) => l.kind !== 'blank' && l.kind !== 'comment').length
}
