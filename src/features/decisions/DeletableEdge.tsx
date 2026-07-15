import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import styles from './DeletableEdge.module.css'

export type DeletableEdgeData = { kind: 'flow' | 'related' }
export type DeletableEdgeType = Edge<DeletableEdgeData, 'deletable'>

export default function DeletableEdge(
  { id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }: EdgeProps<DeletableEdgeType>,
) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  // 관련 (legacy 안건→안건) edges render muted + dashed; flow edges are solid.
  const edgeStyle = data?.kind === 'related' ? { strokeDasharray: '6 4', opacity: 0.5 } : undefined

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
