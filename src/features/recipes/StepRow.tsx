import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { RecipeStep } from './types'
import styles from './RecipeEditor.module.css'

type Props = {
  step: RecipeStep
  index: number
  onChange: (next: RecipeStep) => void
  onDelete: () => void
}

export default function StepRow({ step, index, onChange, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.stepRow}>
      <div className={styles.stepLeft}>
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
        <span className={styles.stepIndex}>{index + 1}</span>
      </div>
      <textarea
        className={styles.stepText}
        rows={2}
        placeholder="조리 순서를 적어주세요."
        value={step.text}
        onChange={(e) => onChange({ ...step, text: e.target.value })}
      />
      <button
        type="button"
        className={styles.rowDelete}
        onClick={onDelete}
        aria-label="순서 삭제"
        title="삭제"
      >
        <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
