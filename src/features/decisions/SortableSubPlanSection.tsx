import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { type ComponentProps } from 'react'
import SubPlanSection from './SubPlanSection'
import sectionStyles from './SubPlanSection.module.css'
import styles from './PlanDetail.module.css'

type Props = ComponentProps<typeof SubPlanSection> & {
  showSpine: boolean
  spineActive: boolean
}

export default function SortableSubPlanSection({ showSpine, spineActive, ...sectionProps }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionProps.subPlan.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const handle = (
    <button
      type="button"
      className={`${sectionStyles.dragHandle}${isDragging ? ` ${sectionStyles.dragging}` : ''}`}
      aria-label="안건 순서 변경"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={14} />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style}>
      {showSpine && <div className={[styles.spine, spineActive && styles.active].filter(Boolean).join(' ')} aria-hidden="true" />}
      <SubPlanSection {...sectionProps} dragHandle={handle} />
    </div>
  )
}
