import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type {
  CanvasPositionPayload, CreateEdgePayload, CreateLinkResourcePayload, CreatePlanPayload, LockDecisionPayload,
  OptionNode, PlanEvent, PlanHierarchy, PlanResource, PlanSummary, PlanTree, Rating, RatePayload, ReorderSubPlansPayload,
  SubPlanEdge, SubPlanNode, TitleDescPayload, UpdatePlanPayload, UpdateResourceTitlePayload,
} from './types'
import type { Note } from '../notes/types'

export const decisionKeys = {
  scope: (wsId: number | null) => ['decisions', wsId] as const,
  list: (wsId: number | null) => ['decisions', wsId, 'list'] as const,
  completed: (wsId: number | null) => ['decisions', wsId, 'completed'] as const,
  trash: (wsId: number | null) => ['decisions', wsId, 'trash'] as const,
  tree: (wsId: number | null, planId: number) => ['decisions', wsId, 'tree', planId] as const,
  timeline: (wsId: number | null, planId: number) => ['decisions', wsId, 'timeline', planId] as const,
  feed: (wsId: number | null) => ['decisions', wsId, 'feed'] as const,
  hierarchy: (wsId: number | null, planId: number) => ['decisions', wsId, 'hierarchy', planId] as const,
  resources: (wsId: number | null, planId: number) => ['decisions', wsId, 'resources', planId] as const,
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

export function usePlanHierarchy(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.hierarchy(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanHierarchy>(`/api/plans/${planId}/hierarchy`)).data,
    enabled: activeId != null && Number.isFinite(planId),
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
export function useSetPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; deadline: string }) =>
      (await apiClient.put<PlanSummary>(`/api/plans/${v.id}/deadline`, { deadline: v.deadline })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useClearPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.delete<PlanSummary>(`/api/plans/${id}/deadline`)).data,
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
export function useSetSubPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; deadline: string }) =>
      (await apiClient.put<SubPlanNode>(`/api/subplans/${v.id}/deadline`, { deadline: v.deadline })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useClearSubPlanDeadline() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.delete<SubPlanNode>(`/api/subplans/${id}/deadline`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function usePromoteSubPlan() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (subPlanId: number) =>
      (await apiClient.post<PlanSummary>(`/api/subplans/${subPlanId}/promote`)).data,
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

/** Position-only persist for a sub-decision node on the parent canvas. Mirrors
 *  useMoveSubPlan above: canvas state is seeded once by the mounted canvas and
 *  the next mount reads the persisted value, so this does NOT invalidate any
 *  query — fire-and-forget, same as useMoveSubPlan. */
export function useMovePlan() {
  return useMutation({
    mutationFn: async (p: { id: number } & CanvasPositionPayload) =>
      (await apiClient.patch<PlanSummary>(`/api/plans/${p.id}`, { canvasX: p.canvasX, canvasY: p.canvasY })).data,
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

// ── Discussion note ──

/** Idempotent POST: ensures the plan's linked discussion note exists and
 *  returns it. Re-running on a stale cache is safe — the backend creates
 *  once and returns the same note on every subsequent call. */
export function useDiscussionNote(planId: number, enabled: boolean) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: [...decisionKeys.tree(activeId, planId), 'discussion-note'],
    queryFn: async () => (await apiClient.post<Note>(`/api/plans/${planId}/discussion-note`)).data,
    enabled: enabled && activeId != null && Number.isFinite(planId),
    staleTime: 60 * 1000,
    retry: false, // 409 discussion-note-private must surface, not retry
  })
}

// ── Plan resources (자료) ──
async function listResourcesReq(planId: number): Promise<PlanResource[]> {
  const { data } = await apiClient.get<PlanResource[]>(`/api/plans/${planId}/resources`)
  return data
}
async function addLinkResourceReq(planId: number, payload: CreateLinkResourcePayload): Promise<PlanResource> {
  const { data } = await apiClient.post<PlanResource>(`/api/plans/${planId}/resources`, payload)
  return data
}
async function uploadResourceFileReq(planId: number, file: File): Promise<PlanResource> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<PlanResource>(
    `/api/plans/${planId}/resources/file`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}
async function updateResourceTitleReq(id: number, payload: UpdateResourceTitlePayload): Promise<PlanResource> {
  const { data } = await apiClient.patch<PlanResource>(`/api/resources/${id}`, payload)
  return data
}
async function deleteResourceReq(id: number): Promise<void> {
  await apiClient.delete(`/api/resources/${id}`)
}

export function usePlanResources(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.resources(activeId, planId),
    queryFn: () => listResourcesReq(planId),
    enabled: activeId != null && Number.isFinite(planId),
  })
}
export function useAddLinkResource(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (payload: CreateLinkResourcePayload) => addLinkResourceReq(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUploadResourceFile(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (file: File) => uploadResourceFileReq(planId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdateResourceTitle() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateResourceTitlePayload }) => updateResourceTitleReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteResource() {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deleteResourceReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
