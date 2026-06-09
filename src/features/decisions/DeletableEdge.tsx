import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import styles from './DeletableEdge.module.css'

export type DeletableEdgeType = Edge<Record<string, never>, 'deletable'>

export default function DeletableEdge(
  { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }: EdgeProps<DeletableEdgeType>,
) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
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
