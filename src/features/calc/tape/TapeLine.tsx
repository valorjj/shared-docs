import { MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import { useDeleteCalcEntry, useUpdateCalcEntry } from '../api'
import { formatCurrency, formatKRW } from '../format'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import { CALC_MODE_LABELS, type CalcEntry } from '../types'
import styles from './Tape.module.css'

type Props = {
  entry: CalcEntry
}

export default function TapeLine({ entry }: Props) {
  const update = useUpdateCalcEntry()
  const del = useDeleteCalcEntry()

  const input = safeParse(entry.inputJson)
  const result = safeParse(entry.resultJson)
  const summary = renderSummary(entry.mode, input, result)

  return (
    <article className={`${styles.line}${entry.pinned ? ` ${styles.linePinned}` : ''}`}>
      <header className={styles.header}>
        <span className={styles.modeBadge}>{CALC_MODE_LABELS[entry.mode]}</span>
        {entry.pinned && (
          <Pin size={11} strokeWidth={2.25} className={styles.pinGlyph} aria-label="고정됨" />
        )}
        <span className={styles.author}>{entry.createdBy.name}</span>
        <span className={styles.sep}>·</span>
        <time className={styles.time}>{formatRelativeTime(entry.createdAt)}</time>
        <Menu
          trigger={
            <button type="button" className={styles.kebab} aria-label="옵션">
              <MoreHorizontal size={14} strokeWidth={1.75} />
            </button>
          }
        >
          <MenuItem
            icon={entry.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            onSelect={() => update.mutate({ id: entry.id, payload: { pinned: !entry.pinned } })}
          >
            {entry.pinned ? '고정 해제' : '고정'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            icon={<Trash2 size={14} />}
            onSelect={() => del.mutate(entry.id)}
          >
            삭제
          </MenuItem>
        </Menu>
      </header>
      <div className={styles.body}>{summary}</div>
      {entry.label && <p className={styles.label}>{entry.label}</p>}
    </article>
  )
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function renderSummary(mode: string, input: any, result: any): string {
  switch (mode) {
    case 'BASIC':
      return `${input.expr ?? ''} = ${result.formatted ?? result.value ?? '?'}`
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
