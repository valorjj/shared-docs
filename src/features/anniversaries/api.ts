import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

export type AnniversaryUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type Anniversary = {
  id: number
  name: string
  date: string                  // YYYY-MM-DD
  recurring: boolean
  category: string
  gift: string | null
  note: string | null
  createdBy: AnniversaryUserRef
  createdAt: string
  updatedAt: string
}

export type AnniversaryCategory = {
  id: number
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  active: boolean
}

export type AnniversaryPayload = {
  name: string
  date: string
  recurring: boolean
  category: string
  gift?: string | null
  note?: string | null
}

export const anniversaryKeys = {
  list: () => ['anniversaries', 'list'] as const,
  categories: () => ['anniversary-categories'] as const,
}

export async function fetchAnniversaryList(): Promise<Anniversary[]> {
  const { data } = await apiClient.get<Anniversary[]>('/api/anniversaries')
  return data
}
const fetchList = fetchAnniversaryList

async function fetchCategories(): Promise<AnniversaryCategory[]> {
  const { data } = await apiClient.get<AnniversaryCategory[]>('/api/anniversary-categories')
  return data
}

async function createReq(payload: AnniversaryPayload): Promise<Anniversary> {
  const { data } = await apiClient.post<Anniversary>('/api/anniversaries', payload)
  return data
}

async function updateReq(id: number, payload: AnniversaryPayload): Promise<Anniversary> {
  const { data } = await apiClient.patch<Anniversary>(`/api/anniversaries/${id}`, payload)
  return data
}

async function deleteReq(id: number): Promise<void> {
  await apiClient.delete(`/api/anniversaries/${id}`)
}

export function useAnniversaries() {
  return useQuery({ queryKey: anniversaryKeys.list(), queryFn: fetchList })
}

export function useAnniversaryCategories() {
  return useQuery({
    queryKey: anniversaryKeys.categories(),
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  })
}

export function useCreateAnniversary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AnniversaryPayload) => createReq(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: anniversaryKeys.list() })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useUpdateAnniversary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AnniversaryPayload }) =>
      updateReq(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: anniversaryKeys.list() })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useDeleteAnniversary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteReq(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: anniversaryKeys.list() })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

/** Compute the next occurrence date of a (possibly recurring) anniversary, in the user's local time. */
export function nextOccurrence(a: Anniversary, today: Date = new Date()): Date {
  const [y, m, d] = a.date.split('-').map(Number)
  if (!a.recurring) {
    return new Date(y, m - 1, d)
  }
  const thisYear = new Date(today.getFullYear(), m - 1, d)
  // If today is past this year's occurrence, roll to next year
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (thisYear < todayMid) {
    return new Date(today.getFullYear() + 1, m - 1, d)
  }
  return thisYear
}

export function daysFromToday(d: Date, today: Date = new Date()): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((a.getTime() - t.getTime()) / 86_400_000)
}

export function formatShortDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function yearsSince(anchorIso: string, occurrence: Date): number {
  const [y] = anchorIso.split('-').map(Number)
  return occurrence.getFullYear() - y
}
