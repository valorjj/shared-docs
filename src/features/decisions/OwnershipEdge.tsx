import { BaseEdge, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'

export type OwnershipEdgeType = Edge<Record<string, never>, 'ownership'>

/** 안건 → its 선택지: automatic ownership link. Muted solid straight line, no
 *  arrowhead, never selectable/deletable (handled by the edge's flags). */
export default function OwnershipEdge(
  { id, sourceX, sourceY, targetX, targetY }: EdgeProps<OwnershipEdgeType>,
) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  return <BaseEdge id={id} path={path} style={{ stroke: 'var(--c-border-strong)', opacity: 0.55 }} />
}
