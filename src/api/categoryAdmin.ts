import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { useActiveWorkspace } from '../auth/useActiveWorkspace'

/** Every feature with per-workspace categories. */
export type CategoryKind = 'purchase' | 'todo' | 'anniversary' | 'link' | 'recipe'

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  purchase: '구매',
  todo: '할 일',
  anniversary: '기념일',
  link: '링크',
  recipe: '레시피',
}

/** Shape every category endpoint returns. The DTO is identical across
 *  features (name, color, icon, sortOrder, active) so the management UI is
 *  fully shared. */
export type CategoryRow = {
  id: number
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  active: boolean
}

export type CreateCategoryPayload = {
  name: string
  color?: string | null
  icon?: string | null
  sortOrder?: number
}

export type UpdateCategoryPayload = {
  name: string
  color?: string | null
  icon?: string | null
  sortOrder?: number
  active?: boolean
}

/**
 * Phase C: categories are per-workspace and managed by any member, so there is
 * one endpoint per kind (no /api/admin/* surface). The X-Workspace-Id header is
 * injected by the axios interceptor; `?all=true` returns inactive categories too
 * (for the management UI), the default is active-only (for pickers/filters).
 */
const BASE: Record<CategoryKind, string> = {
  purchase:    '/api/purchase-categories',
  todo:        '/api/todo-categories',
  anniversary: '/api/anniversary-categories',
  link:        '/api/link-categories',
  recipe:      '/api/recipe-categories',
}

/**
 * The public list key MUST match each feature's `*Keys.categories(wsId)` so a
 * mutation here invalidates the pickers/filters too. Both are
 * `['<kind>-categories', wsId]`.
 */
const publicKey = (kind: CategoryKind, wsId: number | null) => [`${kind}-categories`, wsId] as const
const manageKey = (kind: CategoryKind, wsId: number | null) => ['categories-manage', kind, wsId] as const

async function listAllReq(kind: CategoryKind): Promise<CategoryRow[]> {
  const { data } = await apiClient.get<CategoryRow[]>(BASE[kind], { params: { all: true } })
  return data
}

async function createReq(kind: CategoryKind, payload: CreateCategoryPayload): Promise<CategoryRow> {
  const { data } = await apiClient.post<CategoryRow>(BASE[kind], payload)
  return data
}

async function updateReq(
  kind: CategoryKind,
  id: number,
  payload: UpdateCategoryPayload,
): Promise<CategoryRow> {
  const { data } = await apiClient.patch<CategoryRow>(`${BASE[kind]}/${id}`, payload)
  return data
}

async function deleteReq(kind: CategoryKind, id: number): Promise<void> {
  await apiClient.delete(`${BASE[kind]}/${id}`)
}

/** Management list (includes inactive) for the active workspace. */
export function useManagedCategories(kind: CategoryKind) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: manageKey(kind, activeId),
    queryFn: () => listAllReq(kind),
    enabled: activeId != null,
    staleTime: 5 * 60 * 1000,
  })
}

function useInvalidator(kind: CategoryKind) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return () => {
    qc.invalidateQueries({ queryKey: manageKey(kind, activeId) })
    // The public list backs every feature's category dropdowns + filter
    // chips — without this they'd stay stale until next reload.
    qc.invalidateQueries({ queryKey: publicKey(kind, activeId) })
  }
}

export function useCreateCategory(kind: CategoryKind) {
  const invalidate = useInvalidator(kind)
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => createReq(kind, payload),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory(kind: CategoryKind) {
  const invalidate = useInvalidator(kind)
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCategoryPayload }) =>
      updateReq(kind, id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory(kind: CategoryKind) {
  const invalidate = useInvalidator(kind)
  return useMutation({
    mutationFn: (id: number) => deleteReq(kind, id),
    onSuccess: invalidate,
  })
}
