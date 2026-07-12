import { useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import styles from './SubPlanCanvasNode.module.css'
import type { SubPlanNode, SubPlanStatus } from './types'

export type SubPlanCanvasNodeData = { subPlan: SubPlanNode }
export type SubPlanCanvasNodeType = Node<SubPlanCanvasNodeData, 'subplan'>

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

export default function SubPlanCanvasNode({ data }: NodeProps<SubPlanCanvasNodeType>) {
  const [open, setOpen] = useState(false)
  const { subPlan } = data
  const chosenId = subPlan.decision?.chosenOptionId ?? null
  // Explicit map → renames of the CSS class are compile-checked (vs a dynamic key).
  const statusClass =
    subPlan.status === 'EMPTY' ? styles.statusEmpty
    : subPlan.status === 'DECIDED' ? styles.statusDecided
    : styles.statusProgress

  return (
    <div className={`${styles.node} ${statusClass}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <button type="button" className={`${styles.head} nodrag`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={styles.title}>{subPlan.title}</span>
        <span className={styles.status}>{STATUS_LABEL[subPlan.status]}</span>
      </button>

      <div className={styles.meta}>
        <span>선택지 {subPlan.options.length}</span>
        {subPlan.decision && <span className={styles.decided}>결정됨</span>}
      </div>

      {open && (
        <div className={styles.options}>
          {subPlan.options.length === 0 ? (
            <p className={styles.empty}>선택지 없음</p>
          ) : (
            subPlan.options.map((o) => (
              <div key={o.id} className={o.id === chosenId ? `${styles.option} ${styles.optionChosen}` : styles.option}>
                {o.id === chosenId && <Check size={12} className={styles.check} aria-label="결정됨" />}
                <span className={styles.optionTitle}>{o.title}</span>
                {o.voterUserIds.length > 0 && <span className={styles.optionVotes}>{o.voterUserIds.length}표</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
