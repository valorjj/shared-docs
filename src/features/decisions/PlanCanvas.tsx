import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType,
  useNodesState, useEdgesState, useReactFlow, addEdge,
  type Connection, type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { EmptyState, Button } from '../../components/ui'
import SubPlanCanvasNode, { type SubPlanCanvasNodeType } from './SubPlanCanvasNode'
import SubDecisionCanvasNode, { type SubDecisionCanvasNodeType, type SubDecisionCanvasNodeData } from './SubDecisionCanvasNode'
import DeletableEdge, { type DeletableEdgeType } from './DeletableEdge'
import TitleDescModal from './TitleDescModal'
import { useMoveSubPlan, useMovePlan, useCreateEdge, useDeleteEdge, useAddSubPlanOnCanvas } from './api'
import { useSettings } from '../settings/settingsContext'
import styles from './PlanCanvas.module.css'
import type { PlanTree, SubPlanNode, PlanHierarchyNode } from './types'

const nodeTypes = { subplan: SubPlanCanvasNode, subdecision: SubDecisionCanvasNode }
const edgeTypes = { deletable: DeletableEdge }
const NODE_W = 260
const GAP_X = 64
const DRAG_SAVE_MS = 400

/** Auto-layout fallback for nodes never dragged (canvasX/Y null) — the D2 row. */
function nodePosition(sp: SubPlanNode, i: number) {
  return { x: sp.canvasX ?? i * (NODE_W + GAP_X), y: sp.canvasY ?? 0 }
}

function toNode(sp: SubPlanNode, i: number): SubPlanCanvasNodeType {
  return { id: String(sp.id), type: 'subplan', position: nodePosition(sp, i), data: { subPlan: sp } }
}

type CanvasNode = SubPlanCanvasNodeType | SubDecisionCanvasNodeType

function toChildNode(p: PlanHierarchyNode, i: number): SubDecisionCanvasNodeType {
  return {
    id: `plan-${p.id}`,
    type: 'subdecision',
    position: { x: p.canvasX ?? i * (220 + 48), y: p.canvasY ?? 340 },
    data: { plan: p },
  }
}

function toEdge(e: PlanTree['edges'][number]): DeletableEdgeType {
  return {
    id: String(e.id),
    source: String(e.sourceSubPlanId),
    target: String(e.targetSubPlanId),
    type: 'deletable',
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

type Props = { tree: PlanTree; childPlans: PlanHierarchyNode[]; locked: boolean }

export default function PlanCanvas({ tree, childPlans, locked }: Props) {
  if (tree.subPlans.length === 0) {
    return (
      <div className={`${styles.canvas} ${styles.canvasEmpty}`}>
        <CanvasEmpty tree={tree} childPlans={childPlans} locked={locked} />
      </div>
    )
  }
  return (
    <ReactFlowProvider>
      <Flow tree={tree} childPlans={childPlans} locked={locked} />
    </ReactFlowProvider>
  )
}

/** Empty canvas: no React Flow context, so the first 안건 is created with a null
 *  position (auto-layout will place the single node on the next mount). */
function CanvasEmpty({ tree, locked }: Props) {
  const [adding, setAdding] = useState(false)
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)
  return (
    <>
      <EmptyState
        title="안건이 없어요"
        description={locked ? '잠긴 계획이에요.' : '안건을 추가하면 여기에 나타나요.'}
        action={locked ? undefined : <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAdding(true)}>안건 추가</Button>}
      />
      {!locked && (
        <TitleDescModal
          open={adding} onClose={() => setAdding(false)} entityLabel="안건" busy={addSubPlanM.isPending}
          onSubmit={(p) => addSubPlanM.mutate(p, { onSuccess: () => setAdding(false) })}
        />
      )}
    </>
  )
}

function Flow({ tree, childPlans, locked }: Props) {
  // Seed controlled state ONCE from the initial tree (React reads an initializer
  // only on first render). Later tree refetches are intentionally ignored — the
  // canvas owns its state while mounted; the next mount re-reads fresh data.
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([
    ...tree.subPlans.map(toNode),
    ...childPlans.map(toChildNode),
  ])
  const [edges, setEdges, onEdgesChange] = useEdgesState<DeletableEdgeType>(tree.edges.map(toEdge))
  const [adding, setAdding] = useState(false)

  const { theme } = useSettings()
  const colorMode = theme === 'light' ? 'light' : 'dark'

  const navigate = useNavigate()
  const move = useMoveSubPlan()
  const movePlan = useMovePlan()
  const createEdgeM = useCreateEdge(tree.id)
  const deleteEdgeM = useDeleteEdge()
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)

  const { screenToFlowPosition } = useReactFlow()
  const wrapRef = useRef<HTMLDivElement>(null)

  // Persist each node's final position, debounced per node id.
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const onNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
    const timers = saveTimers.current
    const existing = timers.get(node.id)
    if (existing) clearTimeout(existing)
    timers.set(node.id, setTimeout(() => {
      if (node.type === 'subdecision') {
        movePlan.mutate({ id: (node.data as SubDecisionCanvasNodeData).plan.id, canvasX: node.position.x, canvasY: node.position.y })
      } else {
        move.mutate({ id: Number(node.id), payload: { canvasX: node.position.x, canvasY: node.position.y } })
      }
      timers.delete(node.id)
    }, DRAG_SAVE_MS))
  }, [move, movePlan])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    createEdgeM.mutate(
      { sourceSubPlanId: Number(c.source), targetSubPlanId: Number(c.target) },
      {
        onSuccess: (edge) => setEdges((es) => addEdge(toEdge(edge), es)),
        onError: (err) => window.alert((err as { body?: { detail?: string } }).body?.detail ?? '연결할 수 없어요.'),
      },
    )
  }, [createEdgeM, setEdges])

  // ✕ on a selected edge (and the Delete key) call React Flow's deleteElements,
  // which removes the edge locally and fires this — we persist the removal here.
  const onEdgesDelete = useCallback((deleted: DeletableEdgeType[]) => {
    deleted.forEach((e) => deleteEdgeM.mutate(Number(e.id)))
  }, [deleteEdgeM])

  // "+ 안건" spawns at the canvas viewport center, then persists that position.
  const addAtCenter = useCallback((payload: { title: string; description?: string }, done: () => void) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 }
    addSubPlanM.mutate(payload, {
      onSuccess: (sp) => {
        move.mutate({ id: sp.id, payload: { canvasX: center.x, canvasY: center.y } })
        setNodes((ns) => ns.concat({ id: String(sp.id), type: 'subplan', position: center, data: { subPlan: sp } }))
        done()
      },
    })
  }, [addSubPlanM, move, screenToFlowPosition, setNodes])

  return (
    <div className={styles.canvas} ref={wrapRef}>
      {!locked && (
        <div className={styles.toolbar}>
          <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAdding(true)}>안건 추가</Button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => {
          if (node.type === 'subdecision') navigate(`/decisions/${(node.data as SubDecisionCanvasNodeData).plan.id}`)
        }}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        elementsSelectable={!locked}
        edgesFocusable={!locked}
        deleteKeyCode={locked ? null : undefined}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <TitleDescModal
        open={adding} onClose={() => setAdding(false)} entityLabel="안건" busy={addSubPlanM.isPending}
        onSubmit={(p) => addAtCenter(p, () => setAdding(false))}
      />
    </div>
  )
}
