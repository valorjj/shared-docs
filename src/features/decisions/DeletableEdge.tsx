import { BaseEdge, EdgeLabelRenderer, getStraightPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import styles from './DeletableEdge.module.css'

export type DeletableEdgeData = { kind: 'flow' | 'related'; dimmed?: boolean; chosen?: boolean }
export type DeletableEdgeType = Edge<DeletableEdgeData, 'deletable'>

export default function DeletableEdge(
  { id, data, sourceX, sourceY, targetX, targetY, markerEnd, selected }: EdgeProps<DeletableEdgeType>,
) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  // 관련 edges: muted solid. Flow edges collapse to the taken trail once decided:
  // the chosen option's edge is emphasized (primary), unchosen ones dim.
  const edgeStyle = data?.kind === 'related' ? { opacity: 0.5 }
    : data?.dimmed ? { opacity: 0.28 }
    : data?.chosen ? { stroke: 'var(--c-primary)' }
    : undefined

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={edgeStyle} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`${styles.delete} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={() => deleteElements({ edges: [{ id }] })}
            aria-label="연결 삭제"
          >
            <X size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
