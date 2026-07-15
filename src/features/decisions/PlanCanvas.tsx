import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, MarkerType,
  useNodesState, useEdgesState, useReactFlow, addEdge,
  type Connection, type Edge, type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { EmptyState, Button } from '../../components/ui'
import SubPlanCanvasNode, { type SubPlanCanvasNodeType } from './SubPlanCanvasNode'
import OptionCanvasNode, { type OptionCanvasNodeType } from './OptionCanvasNode'
import DeletableEdge, { type DeletableEdgeType } from './DeletableEdge'
import OwnershipEdge, { type OwnershipEdgeType } from './OwnershipEdge'
import TitleDescModal from './TitleDescModal'
import {
  useMoveSubPlan, useMoveOption, useAddFlowEdge, useDeleteFlowEdge, useDeleteEdge, useAddSubPlanOnCanvas,
} from './api'
import { useSettings } from '../settings/settingsContext'
import { usePlanPresence } from './collab/usePlanPresence'
import { useSmoothedPresence } from './collab/useSmoothedPresence'
import PresenceCursors from './PresenceCursors'
import styles from './PlanCanvas.module.css'
import type { PlanTree } from './types'

const nodeTypes = { subplan: SubPlanCanvasNode, option: OptionCanvasNode }
const edgeTypes = { deletable: DeletableEdge, ownership: OwnershipEdge }

const CLUSTER_GAP_X = 520   // horizontal gap between 안건 clusters (auto-layout)
const OPT_OFFSET_X = 320    // options placed to the right of their 안건
const OPT_GAP_Y = 84        // vertical gap between sibling option nodes
const SNAP = 16
const DRAG_SAVE_MS = 400

const spId = (id: number) => `sp:${id}`
const optId = (id: number) => `opt:${id}`
const parseNodeId = (nid: string): { kind: 'sp' | 'opt'; id: number } => {
  const [k, n] = nid.split(':')
  return { kind: k as 'sp' | 'opt', id: Number(n) }
}

type CanvasNode = SubPlanCanvasNodeType | OptionCanvasNodeType
type CanvasEdge = DeletableEdgeType | OwnershipEdgeType

/** Per-option decision state for the canvas. A decided 안건's chosen option is
 *  'chosen' (emphasized); its other options are 'dimmed'; anything under an
 *  undecided 안건 is 'normal'. Drives the glow/dim collapse-to-trail visual. */
function optionStates(tree: PlanTree): Map<number, 'chosen' | 'dimmed' | 'normal'> {
  const states = new Map<number, 'chosen' | 'dimmed' | 'normal'>()
  for (const sp of tree.subPlans) {
    const decided = sp.decision != null
    const chosenId = sp.decision?.chosenOptionId ?? null
    for (const o of sp.options) {
      states.set(o.id, !decided ? 'normal' : o.id === chosenId ? 'chosen' : 'dimmed')
    }
  }
  return states
}

/** 안건 nodes + their option nodes. Saved canvasX/Y win; nulls fall back to a
 *  left→right cluster fan-out (안건, then its options stacked to the right). */
function buildNodes(tree: PlanTree): CanvasNode[] {
  const states = optionStates(tree)
  const nodes: CanvasNode[] = []
  tree.subPlans.forEach((sp, i) => {
    const baseX = sp.canvasX ?? i * CLUSTER_GAP_X
    const baseY = sp.canvasY ?? 0
    nodes.push({ id: spId(sp.id), type: 'subplan', position: { x: baseX, y: baseY }, data: { subPlan: sp } })
    sp.options.forEach((o, j) => {
      const ox = o.canvasX ?? baseX + OPT_OFFSET_X
      const oy = o.canvasY ?? baseY + (j - (sp.options.length - 1) / 2) * OPT_GAP_Y
      const st = states.get(o.id)
      nodes.push({
        id: optId(o.id), type: 'option', position: { x: ox, y: oy },
        data: { option: o, chosen: st === 'chosen', dimmed: st === 'dimmed' },
      })
    })
  })
  return nodes
}

/** Ownership (안건→option, auto), flow (option→안건, from tree.optionFlowEdges),
 *  and legacy 관련 (안건→안건, from tree.edges). Dangling edges — any endpoint not
 *  rendered as a node — are skipped. */
function buildEdges(tree: PlanTree): CanvasEdge[] {
  const states = optionStates(tree)
  const spSet = new Set(tree.subPlans.map((s) => s.id))
  const optSet = new Set(tree.subPlans.flatMap((s) => s.options.map((o) => o.id)))
  const edges: CanvasEdge[] = []
  tree.subPlans.forEach((sp) => {
    sp.options.forEach((o) => {
      edges.push({
        id: `own:${sp.id}-${o.id}`, source: spId(sp.id), target: optId(o.id),
        type: 'ownership', selectable: false, deletable: false, focusable: false,
      })
    })
  })
  tree.optionFlowEdges.forEach((e) => {
    if (!optSet.has(e.sourceOptionId) || !spSet.has(e.targetSubPlanId)) return
    const st = states.get(e.sourceOptionId)
    edges.push({
      id: `flow:${e.id}`, source: optId(e.sourceOptionId), target: spId(e.targetSubPlanId),
      type: 'deletable', data: { kind: 'flow', dimmed: st === 'dimmed', chosen: st === 'chosen' },
      markerEnd: { type: MarkerType.ArrowClosed },
    })
  })
  tree.edges.forEach((e) => {
    if (!spSet.has(e.sourceSubPlanId) || !spSet.has(e.targetSubPlanId)) return
    edges.push({
      id: `rel:${e.id}`, source: spId(e.sourceSubPlanId), target: spId(e.targetSubPlanId),
      type: 'deletable', data: { kind: 'related' }, markerEnd: { type: MarkerType.ArrowClosed },
    })
  })
  return edges
}

type Props = {
  tree: PlanTree
  locked: boolean
  onNodeSelect?: (sel: { kind: 'sp' | 'opt'; id: number }) => void
  focusNodeId?: string
}

export default function PlanCanvas({ tree, locked, onNodeSelect, focusNodeId }: Props) {
  if (tree.subPlans.length === 0) {
    return (
      <div className={`${styles.canvas} ${styles.canvasEmpty}`}>
        <CanvasEmpty tree={tree} locked={locked} />
      </div>
    )
  }
  return (
    <ReactFlowProvider>
      <Flow tree={tree} locked={locked} onNodeSelect={onNodeSelect} focusNodeId={focusNodeId} />
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

function Flow({ tree, locked, onNodeSelect, focusNodeId }: Props) {
  // Seed controlled state ONCE from the initial tree (React reads an initializer
  // only on first render). Later tree refetches are intentionally ignored — the
  // canvas owns its state while mounted; the next mount re-reads fresh data.
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(buildNodes(tree))
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(buildEdges(tree))
  const [adding, setAdding] = useState(false)

  const { theme } = useSettings()
  const colorMode = theme === 'light' ? 'light' : 'dark'
  const { screenToFlowPosition, setCenter } = useReactFlow()
  const { peers, setCursor, setDrag } = usePlanPresence()
  const smoothed = useSmoothedPresence(peers)
  const lastCursorSent = useRef(0)
  const lastDragSent = useRef(0)
  const localDragId = useRef<string | null>(null)

  // Move nodes that a peer is dragging, from the smoothed target — but never a node
  // the local user is dragging (their own gesture wins). onNodeDragStop broadcasts
  // the exact final position before clearing the drag, so the observer's easing
  // converges to that true target; any residual drift self-heals on the next
  // canvas remount (tab switch / plan change / reload rebuilds nodes from the tree).
  useEffect(() => {
    const drags = smoothed.filter((p) => p.drag && p.drag.nodeId !== localDragId.current)
    if (drags.length === 0) return
    setNodes((ns) =>
      ns.map((n) => {
        const d = drags.find((p) => p.drag!.nodeId === n.id)
        if (!d) return n
        const { x, y } = d.drag!
        if (n.position.x === x && n.position.y === y) return n
        return { ...n, position: { x, y } }
      }),
    )
  }, [smoothed, setNodes])

  // Best-effort focus target from ?focus=sp:{id}/opt:{id} (e.g. the 캔버스에서 보기
  // link on the 안건 detail page). No-ops if the node isn't on this canvas (e.g.
  // a nested 안건) — the user just lands on canvas, per spec.
  useEffect(() => {
    if (!focusNodeId) return
    const n = nodes.find((x) => x.id === focusNodeId)
    if (!n) return
    setCenter(n.position.x, n.position.y, { zoom: 1, duration: 400 })
    onNodeSelect?.(parseNodeId(focusNodeId))
    // run once on mount for this focus target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId])

  const moveSubPlan = useMoveSubPlan()
  const moveOption = useMoveOption()
  const addFlowEdge = useAddFlowEdge(tree.id)
  const deleteFlowEdge = useDeleteFlowEdge()
  const deleteRelatedEdge = useDeleteEdge()
  const addSubPlanM = useAddSubPlanOnCanvas(tree.id)

  const wrapRef = useRef<HTMLDivElement>(null)

  // Persist each node's final position, debounced per node id.
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const dragClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onNodeDragStart = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
    // Cancel any pending settle timer from a just-dropped node — otherwise its
    // stale setDrag(null) fires mid-gesture and briefly nulls this node's broadcast.
    if (dragClearTimer.current) {
      clearTimeout(dragClearTimer.current)
      dragClearTimer.current = null
    }
    localDragId.current = node.id
  }, [])

  const onNodeDrag = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
    const now = performance.now()
    if (now - lastDragSent.current < 50) return
    lastDragSent.current = now
    setDrag({ nodeId: node.id, x: node.position.x, y: node.position.y })
  }, [setDrag])

  const onNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>((_e, node) => {
    const { kind, id } = parseNodeId(node.id)
    const timers = saveTimers.current
    const existing = timers.get(node.id)
    if (existing) clearTimeout(existing)
    timers.set(node.id, setTimeout(() => {
      const payload = { canvasX: node.position.x, canvasY: node.position.y }
      if (kind === 'sp') moveSubPlan.mutate({ id, payload })
      else moveOption.mutate({ id, payload })
      timers.delete(node.id)
    }, DRAG_SAVE_MS))

    // Broadcast the exact final position once (the 50ms throttle in onNodeDrag
    // may have swallowed the last few pixels of movement), then let peers'
    // easing settle onto it before releasing the drag — otherwise the node
    // visibly snaps back to the last-throttled position on other screens.
    setDrag({ nodeId: node.id, x: node.position.x, y: node.position.y })
    if (dragClearTimer.current) clearTimeout(dragClearTimer.current)
    dragClearTimer.current = setTimeout(() => {
      setDrag(null)
      dragClearTimer.current = null
    }, 250)
    localDragId.current = null
  }, [moveSubPlan, moveOption, setDrag])

  // Clear local presence on unmount — otherwise switching views/plans leaves a
  // frozen cursor (and any pending drag-settle timer) visible to peers.
  useEffect(() => () => {
    setCursor(null)
    setDrag(null)
    if (dragClearTimer.current) {
      clearTimeout(dragClearTimer.current)
      dragClearTimer.current = null
    }
  }, [setCursor, setDrag])

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false
    return parseNodeId(c.source).kind === 'opt' && parseNodeId(c.target).kind === 'sp'
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return
    const s = parseNodeId(c.source)
    const t = parseNodeId(c.target)
    if (s.kind !== 'opt' || t.kind !== 'sp') return
    addFlowEdge.mutate(
      { sourceOptionId: s.id, targetSubPlanId: t.id },
      {
        onSuccess: (edge) => setEdges((es) => addEdge({
          id: `flow:${edge.id}`, source: optId(edge.sourceOptionId), target: spId(edge.targetSubPlanId),
          type: 'deletable', data: { kind: 'flow' }, markerEnd: { type: MarkerType.ArrowClosed },
        }, es)),
        onError: (err) => window.alert((err as { body?: { detail?: string } }).body?.detail ?? '연결할 수 없어요.'),
      },
    )
  }, [addFlowEdge, setEdges])

  // ✕ on a selected edge (and the Delete key) call React Flow's deleteElements,
  // which removes the edge locally and fires this — we persist the removal here.
  const onEdgesDelete = useCallback((deleted: CanvasEdge[]) => {
    deleted.forEach((e) => {
      const kind = (e.data as { kind?: string } | undefined)?.kind
      const dbId = Number(e.id.split(':')[1])
      if (kind === 'flow') deleteFlowEdge.mutate(dbId)
      else if (kind === 'related') deleteRelatedEdge.mutate(dbId)
    })
  }, [deleteFlowEdge, deleteRelatedEdge])

  // "+ 안건" spawns at the canvas viewport center, then persists that position.
  const addAtCenter = useCallback((payload: { title: string; description?: string }, done: () => void) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 }
    addSubPlanM.mutate(payload, {
      onSuccess: (sp) => {
        moveSubPlan.mutate({ id: sp.id, payload: { canvasX: center.x, canvasY: center.y } })
        setNodes((ns) => ns.concat({ id: spId(sp.id), type: 'subplan', position: center, data: { subPlan: sp } }))
        done()
      },
    })
  }, [addSubPlanM, moveSubPlan, screenToFlowPosition, setNodes])

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const now = performance.now()
    if (now - lastCursorSent.current < 50) return   // ~20 packets/sec
    lastCursorSent.current = now
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setCursor(pos)
  }, [screenToFlowPosition, setCursor])

  const onCanvasMouseLeave = useCallback(() => setCursor(null), [setCursor])

  return (
    <div className={styles.canvas} ref={wrapRef} onMouseMove={onCanvasMouseMove} onMouseLeave={onCanvasMouseLeave}>
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
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => onNodeSelect?.(parseNodeId(n.id))}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        snapToGrid
        snapGrid={[SNAP, SNAP]}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        elementsSelectable={!locked}
        edgesFocusable={!locked}
        deleteKeyCode={locked ? null : undefined}
      >
        <Background />
        <MiniMap pannable zoomable ariaLabel="미니맵" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <PresenceCursors peers={smoothed} />
      <TitleDescModal
        open={adding} onClose={() => setAdding(false)} entityLabel="안건" busy={addSubPlanM.isPending}
        onSubmit={(p) => addAtCenter(p, () => setAdding(false))}
      />
    </div>
  )
}
