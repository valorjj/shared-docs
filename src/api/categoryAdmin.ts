import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

/** Every feature with admin-curated categories. Keep in sync with the
 *  ENDPOINTS table below. */
export type CategoryKind = 'purchase' | 'todo' | 'anniversary' | 'link' | 'recipe'

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  purchase: '구매',
  todo: '할 일',
  anniversary: '기념일',
  link: '링크',
  recipe: '레시피',
}

/** Shape every category endpoint returns. The DTO is identical across
 *  features (name, color, icon, sortOrder, active) so the admin UI is
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

type EndpointPair = { publicList: string; admin: string }

const ENDPOINTS: Record<CategoryKind, EndpointPair> = {
  purchase:    { publicList: '/api/purchase-categories',    admin: '/api/admin/purchase-categories' },
  todo:        { publicList: '/api/todo-categories',        admin: '/api/admin/todo-categories' },
  anniversary: { publicList: '/api/anniversary-categories', admin: '/api/admin/anniversary-categories' },
  link:        { publicList: '/api/link-categories',        admin: '/api/admin/link-categories' },
  recipe:      { publicList: '/api/recipe-categories',      admin: '/api/admin/recipe-categories' },
}

/** Query keys mirror what each feature's `*Keys.categories()` produces
 *  so admin mutations can invalidate the public lists too. */
const PUBLIC_KEY: Record<CategoryKind, readonly string[]> = {
  purchase:    ['purchase-categories'],
  todo:        ['todo-categories'],
  anniversary: ['anniversary-categories'],
  link:        ['link-categories'],
  recipe:      ['recipe-categories'],
}

const adminKey = (kind: CategoryKind) => ['admin', 'categories', kind] as const

async function listAllReq(kind: CategoryKind): Promise<CategoryRow[]> {
  const { data } = await apiClient.get<CategoryRow[]>(ENDPOINTS[kind].admin)
  return data
}

async function createReq(kind: CategoryKind, payload: CreateCategoryPayload): Promise<CategoryRow> {
  const { data } = await apiClient.post<CategoryRow>(ENDPOINTS[kind].admin, payload)
  return data
}

async function updateReq(
  kind: CategoryKind,
  id: number,
  payload: UpdateCategoryPayload,
): Promise<CategoryRow> {
  const { data } = await apiClient.patch<CategoryRow>(`${ENDPOINTS[kind].admin}/${id}`, payload)
  return data
}

async function deleteReq(kind: CategoryKind, id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS[kind].admin}/${id}`)
}

export function useAdminCategories(kind: CategoryKind) {
  return useQuery({
    queryKey: adminKey(kind),
    queryFn: () => listAllReq(kind),
    staleTime: 5 * 60 * 1000,
  })
}

function useInvalidator(kind: CategoryKind) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: adminKey(kind) })
    // The public list backs every feature's category dropdowns + filter
    // chips — without this they'd stay stale until next reload.
    qc.invalidateQueries({ queryKey: PUBLIC_KEY[kind] })
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
