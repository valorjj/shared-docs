export type PlanStatus = 'ACTIVE' | 'ARCHIVED'
export type SubPlanStatus = 'EMPTY' | 'IN_PROGRESS' | 'DECIDED'

export type PlanSummary = {
  id: number
  title: string
  description: string | null
  status: PlanStatus
  canvasX: number | null
  canvasY: number | null
  groupLabel: string | null
  subPlanCount: number
  decidedCount: number
  createdByUserId: number
  createdAt: string
}

export type Rating = { userId: number; score: number; comment: string | null }

export type DecisionInfo = {
  id: number
  chosenOptionId: number
  reason: string
  decidedByUserId: number
  decidedAt: string
}

export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  avgScore: number | null
  ratingCount: number
  ratings: Rating[]
}

export type SubPlanNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  canvasX: number | null
  canvasY: number | null
  status: SubPlanStatus
  options: OptionNode[]
  decision: DecisionInfo | null
}

export type SubPlanEdge = {
  id: number
  sourceSubPlanId: number
  targetSubPlanId: number
}

export type PlanTree = {
  id: number
  title: string
  description: string | null
  status: PlanStatus
  canvasX: number | null
  canvasY: number | null
  groupLabel: string | null
  createdByUserId: number
  createdAt: string
  subPlans: SubPlanNode[]
  edges: SubPlanEdge[]
}

// ── Payloads ──
export type CreatePlanPayload = { title: string; description?: string }
export type UpdatePlanPayload = { title?: string; description?: string; status?: PlanStatus }
export type TitleDescPayload = { title: string; description?: string }
export type RatePayload = { score: number; comment?: string }
export type LockDecisionPayload = { chosenOptionId: number; reason: string }
export type CanvasPositionPayload = { canvasX: number; canvasY: number }
export type CreateEdgePayload = { sourceSubPlanId: number; targetSubPlanId: number }
