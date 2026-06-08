import { useMemo } from 'react'
import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EmptyState } from '../../components/ui'
import SubPlanCanvasNode, { type SubPlanCanvasNodeType } from './SubPlanCanvasNode'
import styles from './PlanCanvas.module.css'
import type { SubPlanNode } from './types'

const nodeTypes = { subplan: SubPlanCanvasNode }
const NODE_W = 260
const GAP_X = 64

type Props = { subPlans: SubPlanNode[] }

export default function PlanCanvas({ subPlans }: Props) {
  // Left→right row by arrival order (tree is sortOrder-sorted). Uncontrolled:
  // computed once at mount; the canvas remounts on tab-switch so data stays fresh.
  const nodes = useMemo<SubPlanCanvasNodeType[]>(
    () =>
      subPlans.map((sp, i) => ({
        id: String(sp.id),
        type: 'subplan',
        position: { x: i * (NODE_W + GAP_X), y: 0 },
        data: { subPlan: sp },
        draggable: false,
      })),
    [subPlans],
  )

  if (subPlans.length === 0) {
    return <EmptyState title="안건이 없어요" description="목록에서 안건을 추가하면 여기에 나타나요." />
  }

  return (
    <div className={styles.canvas}>
      <ReactFlow
        defaultNodes={nodes}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
