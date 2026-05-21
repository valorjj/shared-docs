import { useMemo } from 'react'
import type { SheetColumn, SheetData } from '../types'
import { parseCellNumber } from '../shared/sheetData'
import styles from './SheetStatusBar.module.css'

type Props = {
  data: SheetData
  /** Column key of the currently focused cell. null when nothing is
   *  focused (e.g. before the user clicks a cell). */
  focusedColumnKey: string | null
}

const KRW_FMT = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

/**
 * Footer strip that aggregates the focused column. Click any cell to
 * pin a column; click outside to clear focus.
 *
 * The aggregation runs against `parseCellNumber` so a "currency" column
 * with values like "₩50,000" works without any cell-level coercion —
 * the user keeps editing whatever shape they like, and the bar still
 * adds them up. Non-numeric cells in the column are silently skipped
 * from sum/avg but DO count toward "개수" (matches Numbers/Sheets).
 */
export default function SheetStatusBar({ data, focusedColumnKey }: Props) {
  const summary = useMemo(() => computeSummary(data, focusedColumnKey), [data, focusedColumnKey])

  if (!summary) {
    return (
      <div className={styles.bar} role="status">
        <span className={styles.hint}>셀을 클릭하면 합계 · 평균 · 개수가 표시됩니다</span>
      </div>
    )
  }

  return (
    <div className={styles.bar} role="status">
      <span className={styles.col}>{summary.columnName}</span>
      <span className={styles.sep} aria-hidden="true">·</span>
      <span className={styles.metric}>
        <span className={styles.metricLabel}>합</span>
        <span className={styles.metricValue}>{formatMetric(summary.sum, summary.isCurrency)}</span>
      </span>
      <span className={styles.metric}>
        <span className={styles.metricLabel}>평균</span>
        <span className={styles.metricValue}>
          {summary.numericCount > 0
            ? formatMetric(summary.sum / summary.numericCount, summary.isCurrency)
            : '—'}
        </span>
      </span>
      <span className={styles.metric}>
        <span className={styles.metricLabel}>개수</span>
        <span className={styles.metricValue}>{summary.filledCount}</span>
      </span>
    </div>
  )
}

type Summary = {
  columnName: string
  isCurrency: boolean
  sum: number
  /** Cells that parse as numbers. */
  numericCount: number
  /** Cells with any non-empty value. */
  filledCount: number
}

function computeSummary(data: SheetData, key: string | null): Summary | null {
  if (key == null) return null
  const col: SheetColumn | undefined = data.columns.find((c) => c.key === key)
  if (!col) return null
  // Always show the bar when a column is focused, even if it's a text
  // column — the user still gets a usable 개수. Sum/avg gracefully show
  // 0 / — when no cell parses as a number.
  let sum = 0
  let numericCount = 0
  let filledCount = 0
  for (const row of data.rows) {
    const raw = row[key]
    if (raw == null || raw === '') continue
    filledCount++
    const n = parseCellNumber(raw)
    if (n != null) {
      sum += n
      numericCount++
    }
  }
  return {
    columnName: col.name,
    isCurrency: col.kind === 'currency',
    sum,
    numericCount,
    filledCount,
  }
}

function formatMetric(n: number, isCurrency: boolean): string {
  if (!Number.isFinite(n)) return '—'
  return isCurrency ? `₩${KRW_FMT.format(n)}` : KRW_FMT.format(n)
}

