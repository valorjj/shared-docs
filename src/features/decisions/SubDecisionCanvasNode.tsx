import { memo } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { GitFork } from 'lucide-react'
import type { PlanHierarchyNode } from './types'
import styles from './SubDecisionCanvasNode.module.css'

export type SubDecisionCanvasNodeData = { plan: PlanHierarchyNode }
export type SubDecisionCanvasNodeType = Node<SubDecisionCanvasNodeData, 'subdecision'>

/** Compact circular-ish canvas node for a 하위결정 — click (in PlanCanvas's
 *  onNodeClick) zooms into the child plan's own page. No handles: sub-decision
 *  nodes don't join the 안건 edge graph. */
function SubDecisionCanvasNode({ data }: NodeProps<SubDecisionCanvasNodeType>) {
  const p = data.plan
  return (
    <div className={`${styles.node}${p.status === 'COMPLETED' ? ' ' + styles.done : ''}`}>
      <GitFork size={13} aria-hidden />
      <span className={styles.title}>{p.title}</span>
      <span className={styles.count}>{p.decidedCount}/{p.subPlanCount}</span>
    </div>
  )
}

export default memo(SubDecisionCanvasNode)
