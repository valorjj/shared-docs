import type { ReactNode } from 'react'
import { useIsDesktop } from '../../lib/useMediaQuery'
import './MobileTable.css'

export type Column<T> = {
  /** stable key for React + accessor identity */
  key: string
  /** column header label */
  header: string
  /** custom renderer for the cell value; defaults to `String(row[key])` */
  render?: (row: T) => ReactNode
  /**
   * Mobile card layout role:
   * - 'primary'   → large, top-of-card position (e.g. item name)
   * - 'secondary' → secondary line (e.g. category, date)
   * - 'meta'      → small footer line (e.g. who, when)
   * - 'hidden'    → not rendered in mobile cards
   *
   * Default: 'secondary'
   */
  mobile?: 'primary' | 'secondary' | 'meta' | 'hidden'
  /** if false, hide this column in the desktop table; default true */
  desktop?: boolean
  /** align cell content (desktop) */
  align?: 'left' | 'right' | 'center'
}

export type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  keyOf: (row: T) => string | number
  onRowClick?: (row: T) => void
  empty?: ReactNode
  /** trailing actions cell, both views (e.g. edit/delete buttons) */
  rowActions?: (row: T) => ReactNode
}

function valueOf<T>(col: Column<T>, row: T): ReactNode {
  if (col.render) return col.render(row)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any)[col.key] as ReactNode
}

export default function MobileTable<T>({
  columns,
  rows,
  keyOf,
  onRowClick,
  empty,
  rowActions,
}: Props<T>) {
  const isDesktop = useIsDesktop()

  if (rows.length === 0) {
    return <div className="mtbl__empty">{empty ?? '데이터가 없습니다.'}</div>
  }

  if (isDesktop) {
    return (
      <div className="mtbl__desktop-wrap">
        <table className="mtbl__table">
          <thead>
            <tr>
              {columns.filter((c) => c.desktop !== false).map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                  {c.header}
                </th>
              ))}
              {rowActions && <th className="mtbl__actions-th"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                className={onRowClick ? 'mtbl__row--clickable' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.filter((c) => c.desktop !== false).map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {valueOf(c, row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="mtbl__actions-td" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const primaryCols   = columns.filter((c) => c.mobile === 'primary')
  const secondaryCols = columns.filter((c) => (c.mobile ?? 'secondary') === 'secondary')
  const metaCols      = columns.filter((c) => c.mobile === 'meta')

  return (
    <ul className="mtbl__cards">
      {rows.map((row) => (
        <li
          key={keyOf(row)}
          className={`mtbl__card ${onRowClick ? 'mtbl__card--clickable' : ''}`}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          {primaryCols.length > 0 && (
            <div className="mtbl__card-primary">
              {primaryCols.map((c) => (
                <span key={c.key}>{valueOf(c, row)}</span>
              ))}
            </div>
          )}
          {secondaryCols.length > 0 && (
            <div className="mtbl__card-secondary">
              {secondaryCols.map((c) => (
                <span key={c.key} className="mtbl__card-field">
                  <span className="mtbl__card-label">{c.header}</span>
                  <span className="mtbl__card-value">{valueOf(c, row)}</span>
                </span>
              ))}
            </div>
          )}
          {(metaCols.length > 0 || rowActions) && (
            <div className="mtbl__card-meta">
              {metaCols.map((c) => (
                <span key={c.key}>{valueOf(c, row)}</span>
              ))}
              {rowActions && (
                <span className="mtbl__card-actions" onClick={(e) => e.stopPropagation()}>
                  {rowActions(row)}
                </span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
