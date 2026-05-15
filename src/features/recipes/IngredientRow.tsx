import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { UNITS } from './recipeData'
import type { RecipeIngredient } from './types'
import styles from './RecipeEditor.module.css'

type Props = {
  ingredient: RecipeIngredient
  factor: number
  onChange: (next: RecipeIngredient) => void
  onDelete: () => void
}

export default function IngredientRow({
  ingredient,
  factor,
  onChange,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ingredient.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  const displayAmount =
    ingredient.amount == null
      ? ''
      : factor === 1
        ? formatAmount(ingredient.amount)
        : formatAmount(ingredient.amount * factor)

  return (
    <div ref={setNodeRef} style={style} className={styles.ingRow}>
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="순서 변경"
        title="드래그해서 순서 변경"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      <input
        className={`${styles.ingInput} ${styles.ingName}`}
        type="text"
        placeholder="재료"
        value={ingredient.name}
        onChange={(e) => onChange({ ...ingredient, name: e.target.value })}
      />

      <input
        className={`${styles.ingInput} ${styles.ingAmount}`}
        type="text"
        inputMode="decimal"
        placeholder="양"
        value={factor === 1 ? amountToString(ingredient.amount) : displayAmount}
        readOnly={factor !== 1}
        onChange={(e) =>
          onChange({ ...ingredient, amount: parseAmount(e.target.value) })
        }
        title={factor !== 1 ? '인분 환산 모드 — 1인분에서 편집하세요' : undefined}
      />

      <select
        className={`${styles.ingInput} ${styles.ingUnit}`}
        value={ingredient.unit}
        onChange={(e) => onChange({ ...ingredient, unit: e.target.value })}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>{u || '—'}</option>
        ))}
      </select>

      <button
        type="button"
        className={styles.rowDelete}
        onClick={onDelete}
        aria-label="재료 삭제"
        title="삭제"
      >
        <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}

function amountToString(amount: number | null): string {
  if (amount == null) return ''
  if (Number.isInteger(amount)) return String(amount)
  return String(amount)
}

function parseAmount(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1).replace(/\.0$/, '')
}
