import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'

export type OwnershipEdgeType = Edge<Record<string, never>, 'ownership'>

/** 안건 → its 선택지: automatic ownership link. Muted dashed, no arrowhead,
 *  never selectable/deletable (handled by the edge's selectable/deletable flags). */
export default function OwnershipEdge(
  { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps<OwnershipEdgeType>,
) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <BaseEdge id={id} path={path} style={{ stroke: 'var(--c-border-strong)', strokeDasharray: '4 4', opacity: 0.55 }} />
}
