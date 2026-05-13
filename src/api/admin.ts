import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Role } from '../auth/authContext'

export type AdminUser = {
  id: number
  email: string
  name: string
  pictureUrl: string | null
  role: Role
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

export type AllowedEmail = {
  id: number
  email: string
  defaultRole: Role
  addedAt: string
}

export type AdminOverview = {
  users: AdminUser[]
  pendingAllowedEmails: AllowedEmail[]
}

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
}

async function fetchOverview(): Promise<AdminOverview> {
  const { data } = await apiClient.get<AdminOverview>('/api/admin/overview')
  return data
}

async function patchUserRole(id: number, role: Role): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/api/admin/users/${id}/role`, { role })
  return data
}

async function patchUserActive(id: number, active: boolean): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/api/admin/users/${id}/active`, { active })
  return data
}

async function postAllowedEmail(email: string, defaultRole: Role): Promise<AllowedEmail> {
  const { data } = await apiClient.post<AllowedEmail>('/api/admin/allowed-emails', {
    email,
    defaultRole,
  })
  return data
}

async function patchAllowedEmailRole(id: number, role: Role): Promise<AllowedEmail> {
  const { data } = await apiClient.patch<AllowedEmail>(
    `/api/admin/allowed-emails/${id}/role`,
    { role },
  )
  return data
}

async function deleteAllowedEmailReq(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/allowed-emails/${id}`)
}

export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: fetchOverview,
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => patchUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.overview }),
  })
}

export function useUpdateUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => patchUserActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.overview }),
  })
}

export function useAddAllowedEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, defaultRole }: { email: string; defaultRole: Role }) =>
      postAllowedEmail(email, defaultRole),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.overview }),
  })
}

export function useUpdateAllowedEmailRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => patchAllowedEmailRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.overview }),
  })
}

export function useDeleteAllowedEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAllowedEmailReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.overview }),
  })
}
