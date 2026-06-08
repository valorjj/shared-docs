import { useState } from 'react'
import { type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import styles from './SubPlanCanvasNode.module.css'
import type { SubPlanNode, SubPlanStatus } from './types'

export type SubPlanCanvasNodeData = { subPlan: SubPlanNode }
export type SubPlanCanvasNodeType = Node<SubPlanCanvasNodeData, 'subplan'>

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}
const STATUS_CLASS: Record<SubPlanStatus, string> = {
  EMPTY: 'statusEmpty', IN_PROGRESS: 'statusProgress', DECIDED: 'statusDecided',
}

export default function SubPlanCanvasNode({ data }: NodeProps<SubPlanCanvasNodeType>) {
  const [open, setOpen] = useState(false)
  const { subPlan } = data
  const chosenId = subPlan.decision?.chosenOptionId ?? null

  return (
    <div className={`${styles.node} ${styles[STATUS_CLASS[subPlan.status]]}`}>
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
                <span className={styles.optionAvg}>{o.avgScore != null ? o.avgScore.toFixed(1) : '–'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
