import { useMemo } from 'react'
import { Card } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import type { Purchase, PurchaseCategory } from './api'
import './purchases.css'

const SIZE = 160
const CENTER = SIZE / 2
const OUTER_R = 70
const INNER_R = 46
const FALLBACK_COLOR = '#8a857c'

type Slice = {
  name: string
  value: number
  pct: number
  color: string
  icon: string | null
}

type Props = {
  rows: Purchase[]
  categories: PurchaseCategory[]
  currentFilter: string
  onFilterChange: (next: string) => void
}

export function CategoryChart({ rows, categories, currentFilter, onFilterChange }: Props) {
  const { slices, total } = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      if (r.currency !== 'KRW') continue
      map.set(r.category, (map.get(r.category) ?? 0) + r.amount)
    }
    const sum = Array.from(map.values()).reduce((s, v) => s + v, 0)
    const entries: Slice[] = Array.from(map.entries())
      .map(([name, value]) => {
        const meta = categories.find((c) => c.name === name)
        return {
          name,
          value,
          pct: sum > 0 ? value / sum : 0,
          color: meta?.color ?? FALLBACK_COLOR,
          icon: meta?.icon ?? null,
        }
      })
      .sort((a, b) => b.value - a.value)
    return { slices: entries, total: sum }
  }, [rows, categories])

  const paths = useMemo(() => buildSlicePaths(slices), [slices])

  if (total === 0) return null

  const selected = currentFilter === 'ALL' ? null : currentFilter

  return (
    <Card className="cat-chart" padding="md">
      <div className="cat-chart__header">
        <span className="cat-chart__title">카테고리별 지출</span>
        <span className="cat-chart__sub">원화(KRW) 기준 · 카테고리를 클릭해 필터링</span>
      </div>

      <div className="cat-chart__body">
        <div className="cat-chart__svg-wrap">
          <svg
            className="cat-chart__svg"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            role="img"
            aria-label="카테고리별 도넛 차트"
          >
            {paths.map((p, i) => {
              const slice = slices[i]
              const active = selected === slice.name
              return (
                <path
                  key={slice.name}
                  d={p}
                  fill={slice.color}
                  className={`cat-chart__slice${active ? ' cat-chart__slice--active' : ''}${selected && !active ? ' cat-chart__slice--dim' : ''}`}
                  onClick={() => onFilterChange(active ? 'ALL' : slice.name)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${slice.name} ${Math.round(slice.pct * 100)}%`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onFilterChange(active ? 'ALL' : slice.name)
                    }
                  }}
                />
              )
            })}
            <text
              x={CENTER}
              y={CENTER - 6}
              textAnchor="middle"
              className="cat-chart__center-label"
            >
              합계
            </text>
            <text
              x={CENTER}
              y={CENTER + 12}
              textAnchor="middle"
              className="cat-chart__center-value"
            >
              {formatMoney(total, 'KRW')}
            </text>
          </svg>
        </div>

        <ul className="cat-chart__legend">
          {slices.map((s) => {
            const active = selected === s.name
            return (
              <li key={s.name}>
                <button
                  type="button"
                  className={`cat-chart__legend-item${active ? ' cat-chart__legend-item--active' : ''}`}
                  onClick={() => onFilterChange(active ? 'ALL' : s.name)}
                >
                  <span className="cat-chart__legend-swatch" style={{ background: s.color }} />
                  {s.icon && <span aria-hidden="true">{s.icon}</span>}
                  <span className="cat-chart__legend-name">{s.name}</span>
                  <span className="cat-chart__legend-pct">{Math.round(s.pct * 100)}%</span>
                  <span className="cat-chart__legend-amount">{formatMoney(s.value, 'KRW')}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}

function buildSlicePaths(slices: Slice[]): string[] {
  const out: string[] = []
  if (slices.length === 0) return out

  // Special case: a single slice is a full ring → use two half-arcs to draw a complete donut.
  if (slices.length === 1) {
    out.push(
      [
        `M ${CENTER} ${CENTER - OUTER_R}`,
        `A ${OUTER_R} ${OUTER_R} 0 1 1 ${CENTER} ${CENTER + OUTER_R}`,
        `A ${OUTER_R} ${OUTER_R} 0 1 1 ${CENTER} ${CENTER - OUTER_R}`,
        `M ${CENTER} ${CENTER - INNER_R}`,
        `A ${INNER_R} ${INNER_R} 0 1 0 ${CENTER} ${CENTER + INNER_R}`,
        `A ${INNER_R} ${INNER_R} 0 1 0 ${CENTER} ${CENTER - INNER_R}`,
        'Z',
      ].join(' '),
    )
    return out
  }

  let angle = -Math.PI / 2
  for (const s of slices) {
    const sweep = s.pct * Math.PI * 2
    const end = angle + sweep
    const largeArc = sweep > Math.PI ? 1 : 0
    const x1 = CENTER + OUTER_R * Math.cos(angle)
    const y1 = CENTER + OUTER_R * Math.sin(angle)
    const x2 = CENTER + OUTER_R * Math.cos(end)
    const y2 = CENTER + OUTER_R * Math.sin(end)
    const x3 = CENTER + INNER_R * Math.cos(end)
    const y3 = CENTER + INNER_R * Math.sin(end)
    const x4 = CENTER + INNER_R * Math.cos(angle)
    const y4 = CENTER + INNER_R * Math.sin(angle)
    out.push(
      [
        `M ${x1} ${y1}`,
        `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z',
      ].join(' '),
    )
    angle = end
  }
  return out
}
