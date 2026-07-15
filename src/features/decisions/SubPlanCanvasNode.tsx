import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock, type LucideIcon } from 'lucide-react'
import styles from './SubPlanCanvasNode.module.css'
import type { SubPlanNode, SubPlanStatus, AccentIcon } from './types'

export type SubPlanCanvasNodeData = { subPlan: SubPlanNode }
export type SubPlanCanvasNodeType = Node<SubPlanCanvasNodeData, 'subplan'>

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}
const ICON_MAP: Record<AccentIcon, LucideIcon> = {
  Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock,
}

export default function SubPlanCanvasNode({ data }: NodeProps<SubPlanCanvasNodeType>) {
  const { subPlan } = data
  const statusClass =
    subPlan.status === 'EMPTY' ? styles.statusEmpty
    : subPlan.status === 'DECIDED' ? styles.statusDecided
    : styles.statusProgress
  const AccentIconCmp = subPlan.icon && subPlan.icon in ICON_MAP ? ICON_MAP[subPlan.icon as AccentIcon] : null

  return (
    <div
      className={`${styles.node} ${statusClass}${subPlan.accentColor ? ` ${styles.accented}` : ''}`}
      style={subPlan.accentColor ? ({ ['--card-accent' as string]: `var(--c-tag-${subPlan.accentColor})` }) : undefined}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <div className={styles.head}>
        {AccentIconCmp && <AccentIconCmp size={14} className={styles.icon} />}
        <span className={styles.title}>{subPlan.title}</span>
        <span className={styles.status}>{STATUS_LABEL[subPlan.status]}</span>
      </div>
      <div className={styles.meta}>
        <span>선택지 {subPlan.options.length}</span>
        {subPlan.deadline && <span className={styles.deadline}>기한 {subPlan.deadline}</span>}
      </div>
    </div>
  )
}
