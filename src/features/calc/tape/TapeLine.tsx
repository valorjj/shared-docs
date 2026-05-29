import { MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import { useDeleteCalcEntry, useUpdateCalcEntry } from '../api'
import { formatCurrency, formatKRW } from '../format'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import { CALC_MODE_LABELS, type CalcEntry } from '../types'
import styles from './Tape.module.css'

type Props = {
  entry: CalcEntry
  active?: boolean
  onSelect?: (entry: CalcEntry) => void
}

export default function TapeLine({ entry, active = false, onSelect }: Props) {
  const update = useUpdateCalcEntry()
  const del = useDeleteCalcEntry()

  const input = safeParse(entry.inputJson)
  const result = safeParse(entry.resultJson)
  const summary = renderSummary(entry.mode, input, result)

  const handleClick = () => onSelect?.(entry)
  const handleKey = (e: React.KeyboardEvent) => {
    if (!onSelect) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(entry)
    }
  }

  // Clicks on the kebab (the menu trigger or its items) must NOT bubble
  // up to the row's onClick — otherwise picking "삭제" would also seed
  // the editor with the doomed entry.
  const stopRow = (e: React.SyntheticEvent) => e.stopPropagation()

  const className = [
    styles.line,
    entry.pinned ? styles.linePinned : '',
    active ? styles.lineActive : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={className}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={handleClick}
      onKeyDown={handleKey}
      title={onSelect ? '클릭하여 편집기에 불러오기' : undefined}
    >
      <header className={styles.header}>
        <span className={styles.modeBadge}>{CALC_MODE_LABELS[entry.mode]}</span>
        {entry.pinned && (
          <Pin size={11} strokeWidth={2.25} className={styles.pinGlyph} aria-label="고정됨" />
        )}
        <span className={styles.author}>{entry.createdBy.name}</span>
        <span className={styles.sep}>·</span>
        <time className={styles.time}>{formatRelativeTime(entry.createdAt)}</time>
        <span onClick={stopRow} onPointerDown={stopRow} onKeyDown={stopRow}>
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
        </span>
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

/** BASIC summary handles both shapes:
 *  - legacy single-line: input = {expr}, result = {value, formatted}
 *  - 2026-05-29 multi-line: input = {body}, result = {lines, finalFormatted} */
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

function renderSummary(mode: string, input: any, result: any): string {
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
