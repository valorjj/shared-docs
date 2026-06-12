import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type {
  CanvasPositionPayload, CreateEdgePayload, CreatePlanPayload, LockDecisionPayload,
  OptionNode, PlanEvent, PlanSummary, PlanTree, Rating, RatePayload, ReorderSubPlansPayload,
  SubPlanEdge, SubPlanNode, TitleDescPayload, UpdatePlanPayload,
} from './types'

export const decisionKeys = {
  scope: (wsId: number | null) => ['decisions', wsId] as const,
  list: (wsId: number | null) => ['decisions', wsId, 'list'] as const,
  completed: (wsId: number | null) => ['decisions', wsId, 'completed'] as const,
  trash: (wsId: number | null) => ['decisions', wsId, 'trash'] as const,
  tree: (wsId: number | null, planId: number) => ['decisions', wsId, 'tree', planId] as const,
  timeline: (wsId: number | null, planId: number) => ['decisions', wsId, 'timeline', planId] as const,
  feed: (wsId: number | null) => ['decisions', wsId, 'feed'] as const,
}

// ── Queries ──
export function usePlans() {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.list(activeId),
    queryFn: async () => (await apiClient.get<PlanSummary[]>('/api/plans')).data,
    enabled: activeId != null,
  })
}

export function useCompletedPlans(enabled = true) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.completed(activeId),
    queryFn: async () => (await apiClient.get<PlanSummary[]>('/api/plans/completed')).data,
    enabled: enabled && activeId != null,
  })
}
export function useTrashedPlans(enabled = true) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.trash(activeId),
    queryFn: async () => (await apiClient.get<PlanSummary[]>('/api/plans/trash')).data,
    enabled: enabled && activeId != null,
  })
}

export function usePlanTree(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.tree(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanTree>(`/api/plans/${planId}`)).data,
    enabled: activeId != null && Number.isFinite(planId),
  })
}

export function useTimeline(planId: number, enabled = true) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.timeline(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanEvent[]>(`/api/plans/${planId}/timeline`)).data,
    enabled: enabled && activeId != null && Number.isFinite(planId),
  })
}

export function useFeed(enabled = true, limit = 50) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.feed(activeId),
    queryFn: async () => (await apiClient.get<PlanEvent[]>(`/api/decision-feed?limit=${limit}`)).data,
    enabled: enabled && activeId != null,
  })
}

// ── Plan mutations ──
export function useCreatePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (p: CreatePlanPayload) => (await apiClient.post<PlanSummary>('/api/plans', p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdatePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: UpdatePlanPayload }) =>
      (await apiClient.patch<PlanSummary>(`/api/plans/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeletePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/plans/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useCompletePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/complete`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUncompletePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/uncomplete`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useRestorePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.post(`/api/plans/${id}/restore`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeletePlanForever() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/plans/${id}/forever`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useLockPlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/lock`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUnlockPlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.post<PlanSummary>(`/api/plans/${id}/unlock`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── SubPlan (안건) mutations ──
export function useAddSubPlan(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (p: TitleDescPayload) =>
      (await apiClient.post<SubPlanNode>(`/api/plans/${planId}/subplans`, p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdateSubPlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: TitleDescPayload }) =>
      (await apiClient.patch<SubPlanNode>(`/api/subplans/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteSubPlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/subplans/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Option (선택지) mutations ──
export function useAddOption() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { subPlanId: number; payload: TitleDescPayload }) =>
      (await apiClient.post<OptionNode>(`/api/subplans/${v.subPlanId}/options`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdateOption() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: TitleDescPayload }) =>
      (await apiClient.patch<OptionNode>(`/api/options/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteOption() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/options/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Rating (평가) mutations ──
export function useRateOption() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { optionId: number; payload: RatePayload }) =>
      (await apiClient.put<Rating>(`/api/options/${v.optionId}/rating`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteRating() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (optionId: number) => { await apiClient.delete(`/api/options/${optionId}/rating`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Vote (투표) mutations ──
export function useCastVote() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (optionId: number) => { await apiClient.put(`/api/options/${optionId}/vote`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useRetractVote() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (optionId: number) => { await apiClient.delete(`/api/options/${optionId}/vote`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Decision (결정) mutations ──
export function useLockDecision() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { subPlanId: number; payload: LockDecisionPayload }) =>
      (await apiClient.post(`/api/subplans/${v.subPlanId}/decision`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useReopenDecision() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (subPlanId: number) => { await apiClient.post(`/api/subplans/${subPlanId}/decision/reopen`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Canvas (D3): drag positions + edges ──

/**
 * Persist a node's dragged position. Positions don't affect list/roadmap roll-ups
 * or the 목록 view, so this does NOT invalidate any query — the mounted canvas owns
 * its node state; the next mount reads the persisted value. Fire-and-forget.
 */
export function useMoveSubPlan() {
  return useMutation({
    mutationFn: async (v: { id: number; payload: CanvasPositionPayload }) => {
      await apiClient.patch(`/api/subplans/${v.id}`, v.payload)
    },
  })
}

/** Create an edge. Invalidates the decisions scope so the 목록 view (chips, spine
 *  accents, 연결 modal) reflects it; the mounted canvas seeds once and appends the
 *  returned edge to its own local state, so it is unaffected by the refetch. */
export function useCreateEdge(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: CreateEdgePayload) =>
      (await apiClient.post<SubPlanEdge>(`/api/plans/${planId}/edges`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

export function useDeleteEdge() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/edges/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

/** Create a 안건 from the canvas. Unlike useAddSubPlan, this DOES invalidate the
 *  scope so 목록 + roadmap roll-ups stay correct; the mounted canvas keeps its
 *  local node state (it ignores the prop refetch), so there is no remount/flash. */
export function useAddSubPlanOnCanvas(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (p: TitleDescPayload) =>
      (await apiClient.post<SubPlanNode>(`/api/plans/${planId}/subplans`, p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

/** Reorder a plan's 안건. Optimistically reorders the cached tree, rolls back on
 *  error, and reconciles via a scope invalidation on settle. */
export function useReorderSubPlans(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: ReorderSubPlansPayload) => {
      await apiClient.patch(`/api/plans/${planId}/subplans/order`, payload)
    },
    onMutate: async (payload: ReorderSubPlansPayload) => {
      const key = decisionKeys.tree(activeId, planId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PlanTree>(key)
      if (prev) {
        const byId = new Map(prev.subPlans.map((sp) => [sp.id, sp] as const))
        const reordered = payload.orderedSubPlanIds.map((id) => byId.get(id)).filter((sp): sp is NonNullable<typeof sp> => sp != null)
        qc.setQueryData<PlanTree>(key, { ...prev, subPlans: reordered })
      }
      return { prev, key }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
