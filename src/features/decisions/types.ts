export type PlanStatus = 'ACTIVE' | 'COMPLETED'
export type SubPlanStatus = 'EMPTY' | 'IN_PROGRESS' | 'DECIDED'

export type PlanSummary = {
  id: number
  title: string
  description: string | null
  status: PlanStatus
  canvasX: number | null
  canvasY: number | null
  groupLabel: string | null
  parentPlanId: number | null
  subPlanCount: number
  decidedCount: number
  createdByUserId: number
  createdAt: string
  lockedAt: string | null
  lockedByUserId: number | null
  deletedAt: string | null
  deadline: string | null
  completedAt: string | null
}

export type Rating = { userId: number; score: number; comment: string | null }

export type DecisionInfo = {
  id: number
  chosenOptionId: number
  reason: string
  decidedByUserId: number
  decidedAt: string
  voteSnapshot: string | null
}

export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  avgScore: number | null
  ratingCount: number
  ratings: Rating[]
  voterUserIds: number[]
}

export type VoteSnapshotEntry = { optionId: number; title: string; count: number; voters: string[] }

export type SubPlanNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  canvasX: number | null
  canvasY: number | null
  deadline: string | null
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
  parentPlanId: number | null
  createdByUserId: number
  createdAt: string
  lockedAt: string | null
  lockedByUserId: number | null
  deadline: string | null
  completedAt: string | null
  subPlans: SubPlanNode[]
  edges: SubPlanEdge[]
}

export type PlanHierarchyNode = {
  id: number
  parentPlanId: number | null
  title: string
  status: PlanStatus
  deadline: string | null
  completedAt: string | null
  lockedAt: string | null
  canvasX: number | null
  canvasY: number | null
  subPlanCount: number
  decidedCount: number
  childCount: number
  createdAt: string
}

export type PlanHierarchy = {
  rootId: number
  ancestorIds: number[]
  nodes: PlanHierarchyNode[]
}

// ── Payloads ──
export type CreatePlanPayload = { title: string; description?: string; groupLabel?: string; parentPlanId?: number }
export type SetDeadlinePayload = { deadline: string }   // YYYY-MM-DD
export type UpdatePlanPayload = { title?: string; description?: string; groupLabel?: string }
export type TitleDescPayload = { title: string; description?: string }
export type RatePayload = { score: number; comment?: string }
export type LockDecisionPayload = { chosenOptionId: number; reason: string }
export type CanvasPositionPayload = { canvasX: number; canvasY: number }
export type CreateEdgePayload = { sourceSubPlanId: number; targetSubPlanId: number }

export type PlanEventType =
  | 'PLAN_CREATED' | 'SUBPLAN_ADDED' | 'OPTION_ADDED'
  | 'DECISION_LOCKED' | 'DECISION_CHANGED' | 'DECISION_REOPENED'
  | 'PLAN_LOCKED' | 'PLAN_UNLOCKED'
  | 'PLAN_COMPLETED' | 'PLAN_UNCOMPLETED'
  | 'DEADLINE_SET' | 'DEADLINE_CLEARED'
  | 'SUBDECISION_ADDED' | 'SUBDECISION_REMOVED' | 'SUBPLAN_PROMOTED'

export type PlanEvent = {
  id: number
  planId: number
  subPlanId: number | null
  type: PlanEventType
  actorUserId: number
  payload: Record<string, string | null> | null
  createdAt: string
}

export type ReorderSubPlansPayload = { orderedSubPlanIds: number[] }
