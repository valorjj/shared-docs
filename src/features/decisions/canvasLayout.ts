import Dagre from '@dagrejs/dagre'
import type { PlanTree } from './types'

const SP_W = 280, SP_H = 76, OPT_W = 220, OPT_H = 56

/** Left→right layered DAG layout. 안건 own their option nodes (ownership edges),
 *  flow edges (option → downstream 안건) drive ranks, so downstream 안건 land in the
 *  next rank instead of on top of the upstream option column. Keyed by namespaced id. */
export function layoutPositions(tree: PlanTree): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 96 })

  for (const sp of tree.subPlans) {
    g.setNode(`sp:${sp.id}`, { width: SP_W, height: SP_H })
    for (const o of sp.options) {
      g.setNode(`opt:${o.id}`, { width: OPT_W, height: OPT_H })
      g.setEdge(`sp:${sp.id}`, `opt:${o.id}`)          // ownership (안건 → its option)
    }
  }
  const spIds = new Set(tree.subPlans.map((s) => s.id))
  const optIds = new Set(tree.subPlans.flatMap((s) => s.options.map((o) => o.id)))
  for (const e of tree.optionFlowEdges) {
    if (optIds.has(e.sourceOptionId) && spIds.has(e.targetSubPlanId)) {
      g.setEdge(`opt:${e.sourceOptionId}`, `sp:${e.targetSubPlanId}`)   // flow → next rank
    }
  }

  Dagre.layout(g)
  const out = new Map<string, { x: number; y: number }>()
  g.nodes().forEach((id) => {
    const n = g.node(id)
    if (n) out.set(id, { x: n.x - n.width / 2, y: n.y - n.height / 2 })   // dagre gives centers → top-left
  })
  return out
}
