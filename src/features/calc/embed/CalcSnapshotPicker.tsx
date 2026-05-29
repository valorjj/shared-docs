import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useCalcEntries } from '../api'
import { formatCurrency, formatKRW } from '../format'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import { CALC_MODE_LABELS, type CalcEntry, type CalcMode } from '../types'
import styles from './CalcSnapshotPicker.module.css'

export type CalcSnapshotAttrs = {
  entryId: number
  mode: CalcMode
  input: string
  result: string
  label: string
  capturedAt: string
  tombstone: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (attrs: CalcSnapshotAttrs) => void
}

/** Single-step picker: lists recent tape entries from both partners. */
export default function CalcSnapshotPicker({ open, onOpenChange, onInsert }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          {open && <PickerBody onClose={() => onOpenChange(false)} onInsert={onInsert} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PickerBody({
  onClose,
  onInsert,
}: {
  onClose: () => void
  onInsert: (attrs: CalcSnapshotAttrs) => void
}) {
  const { data, isLoading } = useCalcEntries()
  const entries = (data ?? []).slice(0, 30)

  const handlePick = (entry: CalcEntry) => {
    onInsert({
      entryId: entry.id,
      mode: entry.mode,
      input: entry.inputJson,
      result: entry.resultJson,
      label: entry.label ?? '',
      capturedAt: new Date().toISOString(),
      tombstone: false,
    })
    onClose()
  }

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerSpacer} />
        <Dialog.Title className={styles.title}>계산 스냅샷 삽입</Dialog.Title>
        <button
          type="button"
          className={styles.headerClose}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {isLoading ? (
        <p className={styles.empty}>불러오는 중…</p>
      ) : entries.length === 0 ? (
        <p className={styles.empty}>아직 계산 기록이 없습니다. /calc에서 먼저 계산해보세요.</p>
      ) : (
        <ol className={styles.list}>
          {entries.map((entry) => {
            const input = safeParse(entry.inputJson)
            const result = safeParse(entry.resultJson)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => handlePick(entry)}
                >
                  <div className={styles.rowTop}>
                    <span className={styles.modeBadge}>{CALC_MODE_LABELS[entry.mode]}</span>
                    <span className={styles.author}>{entry.createdBy.name}</span>
                    <span className={styles.sep}>·</span>
                    <time className={styles.time}>{formatRelativeTime(entry.createdAt)}</time>
                  </div>
                  <div className={styles.rowSummary}>
                    {renderSummary(entry.mode, input, result)}
                  </div>
                  {entry.label && <p className={styles.rowLabel}>{entry.label}</p>}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function renderSummary(mode: CalcMode, input: any, result: any): string {
  switch (mode) {
    case 'BASIC':
      return summarizeBasic(input, result)
    case 'INSTALLMENT':
      return `${formatKRW(input.principal ?? 0)} / ${input.months ?? 0}개월 → 월 ${formatKRW(result.monthly ?? 0)}`
    case 'LOAN':
      return `${formatKRW(input.principal ?? 0)} / ${input.months ?? 0}개월 (${input.type ?? ''}) → 첫달 ${formatKRW(result.firstPayment ?? 0)}`
    case 'DUTCH': {
      const cur = input.currency ?? 'KRW'
      return `${formatCurrency(input.total ?? 0, cur)} ÷ ${(input.shares ?? []).length}명`
    }
    case 'DATE':
      return result.description ?? ''
    default:
      return JSON.stringify({ input, result })
  }
}

function summarizeBasic(input: any, result: any): string {
  if (typeof input?.expr === 'string') {
    return `${input.expr} = ${result?.formatted ?? result?.value ?? '?'}`
  }
  const lines = Array.isArray(result?.lines) ? result.lines : []
  const meaningful = lines.filter(
    (l: any) => l?.kind !== 'blank' && l?.kind !== 'comment',
  )
  if (meaningful.length === 0) return '(빈 계산)'
  if (meaningful.length === 1) {
    const only = meaningful[0]
    const src = String(only.source ?? '').trim()
    return src && only.formatted ? `${src} = ${only.formatted}` : (only.formatted ?? '?')
  }
  const fin = result?.finalFormatted
  return fin ? `${meaningful.length}단계 · 최종 ${fin}` : `${meaningful.length}단계`
}
