import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type {
  CreatePlanPayload, LockDecisionPayload, OptionNode, PlanSummary, PlanTree,
  Rating, RatePayload, SubPlanNode, TitleDescPayload, UpdatePlanPayload,
} from './types'

export const decisionKeys = {
  scope: (wsId: number | null) => ['decisions', wsId] as const,
  list: (wsId: number | null) => ['decisions', wsId, 'list'] as const,
  tree: (wsId: number | null, planId: number) => ['decisions', wsId, 'tree', planId] as const,
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

export function usePlanTree(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.tree(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanTree>(`/api/plans/${planId}`)).data,
    enabled: activeId != null && Number.isFinite(planId),
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
