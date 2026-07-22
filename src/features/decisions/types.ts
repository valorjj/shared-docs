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
  subPlanCount: number
  decidedCount: number
  createdByUserId: number
  createdAt: string
  deletedAt: string | null
  deadline: string | null
  completedAt: string | null
}

export type ProConKind = 'PRO' | 'CON'
export type ProCon = { id: number; kind: ProConKind; content: string; createdByUserId: number }

export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  proCons: ProCon[]
  voterUserIds: number[]
  resources: OptionResource[]
  confirmed: boolean
  confirmedAt: string | null
  confirmedBy: number | null
}

export type VoteSnapshotEntry = { optionId: number; title: string; count: number; voters: string[] }

export const ACCENT_COLORS = ['red', 'amber', 'green', 'blue', 'purple', 'gray'] as const
export type AccentColor = typeof ACCENT_COLORS[number]

export const ACCENT_ICONS = ['Flag', 'Star', 'AlertTriangle', 'Home', 'Car', 'Heart', 'Briefcase', 'Clock'] as const
export type AccentIcon = typeof ACCENT_ICONS[number]

export type SubPlanNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  deadline: string | null
  status: SubPlanStatus
  options: OptionNode[]
  parentSubPlanId: number | null
  accentColor: string | null
  icon: string | null
  childSubPlanCount: number
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
  deadline: string | null
  completedAt: string | null
  subPlans: SubPlanNode[]
}

export type SubPlanDetail = {
  id: number
  planId: number
  parentSubPlanId: number | null
  accentColor: string | null
  icon: string | null
  title: string
  description: string | null
  deadline: string | null
  status: SubPlanStatus
  options: OptionNode[]
  children: SubPlanNode[]
  ancestorIds: number[]
  planTitle: string
}

// ── Payloads ──
export type CreatePlanPayload = { title: string; description?: string; groupLabel?: string }
export type SetDeadlinePayload = { deadline: string }   // YYYY-MM-DD
export type UpdatePlanPayload = { title?: string; description?: string; groupLabel?: string }
export type TitleDescPayload = { title: string; description?: string }
export type CreateSubPlanPayload = { title: string; description?: string; parentSubPlanId?: number }
export type CreateProConPayload = { kind: ProConKind; content: string }
export type SetOptionConfirmedPayload = { confirmed: boolean }

export type PlanEventType =
  | 'PLAN_CREATED' | 'SUBPLAN_ADDED' | 'OPTION_ADDED'
  | 'DECISION_LOCKED' | 'DECISION_CHANGED' | 'DECISION_REOPENED'
  | 'PLAN_LOCKED' | 'PLAN_UNLOCKED'
  | 'PLAN_COMPLETED' | 'PLAN_UNCOMPLETED'
  | 'DEADLINE_SET' | 'DEADLINE_CLEARED'
  | 'PROCON_ADDED' | 'PROCON_REMOVED'
  | 'RESOURCE_ADDED' | 'RESOURCE_REMOVED'
  | 'OPTION_CONFIRMED' | 'OPTION_REVOKED'

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

export type PlanResourceKind = 'LINK' | 'FILE'

export type PlanResource = {
  id: number
  planId: number
  kind: PlanResourceKind
  url: string | null
  title: string | null
  attachmentId: number | null
  originalFilename: string | null
  contentType: string | null
  sizeBytes: number | null
  fileUrl: string | null
  createdByUserId: number
  createdAt: string
}

export type CreateLinkResourcePayload = { url: string; title?: string }
export type UpdateResourceTitlePayload = { title?: string }

export type OptionResource = {
  id: number
  optionId: number
  kind: PlanResourceKind
  url: string | null
  title: string | null
  attachmentId: number | null
  originalFilename: string | null
  contentType: string | null
  sizeBytes: number | null
  fileUrl: string | null
  createdByUserId: number
  createdAt: string
}
