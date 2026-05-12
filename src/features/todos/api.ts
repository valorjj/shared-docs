import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

export type TodoStatus = 'OPEN' | 'DONE'

export type TodoFilter = 'open' | 'today' | 'week' | 'done' | 'all'

export type TodoUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type Todo = {
  id: number
  task: string
  due: string | null              // YYYY-MM-DD
  status: TodoStatus
  category: string
  note: string | null
  createdBy: TodoUserRef
  completedBy: TodoUserRef | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type TodoCategory = {
  id: number
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  active: boolean
}

export type TodoPayload = {
  task: string
  due?: string | null
  category: string
  note?: string | null
}

export const todoKeys = {
  list: (filter: TodoFilter) => ['todos', 'list', filter] as const,
  categories: () => ['todo-categories'] as const,
}

async function fetchList(filter: TodoFilter): Promise<Todo[]> {
  const { data } = await apiClient.get<Todo[]>('/api/todos', { params: { filter } })
  return data
}

async function fetchCategories(): Promise<TodoCategory[]> {
  const { data } = await apiClient.get<TodoCategory[]>('/api/todo-categories')
  return data
}

async function createReq(payload: TodoPayload): Promise<Todo> {
  const { data } = await apiClient.post<Todo>('/api/todos', payload)
  return data
}

async function updateReq(id: number, payload: TodoPayload): Promise<Todo> {
  const { data } = await apiClient.patch<Todo>(`/api/todos/${id}`, payload)
  return data
}

async function toggleReq(id: number, done: boolean): Promise<Todo> {
  const { data } = await apiClient.patch<Todo>(`/api/todos/${id}/toggle`, { done })
  return data
}

async function deleteReq(id: number): Promise<void> {
  await apiClient.delete(`/api/todos/${id}`)
}

export function useTodos(filter: TodoFilter) {
  return useQuery({
    queryKey: todoKeys.list(filter),
    queryFn: () => fetchList(filter),
  })
}

export function useTodoCategories() {
  return useQuery({
    queryKey: todoKeys.categories(),
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TodoPayload) => createReq(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos', 'list'] }),
  })
}

export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TodoPayload }) =>
      updateReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos', 'list'] }),
  })
}

export function useToggleTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => toggleReq(id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos', 'list'] }),
  })
}

export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos', 'list'] }),
  })
}

export function formatDue(iso: string | null): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const due = new Date(`${iso}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}
