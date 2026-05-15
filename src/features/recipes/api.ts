import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type {
  CreateRecipePayload,
  Recipe,
  RecipeCategory,
  UpdateRecipePayload,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

/** Same cap as the note attachment gate — keeps a friendly client-side
 *  rejection before the request leaves the browser. */
export const MAX_RECIPE_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_LABEL = '5MB'

export type UploadedFile = {
  url: string
  originalFilename: string
  contentType: string
  sizeBytes: number
}

/** Compose an absolute URL from a stored-file path like `/files/abc.jpg`. */
export function absoluteFileUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${API_BASE}${pathOrUrl}`
}

async function uploadFileReq(file: File): Promise<UploadedFile> {
  if (file.type.startsWith('image/') && file.size > MAX_RECIPE_IMAGE_BYTES) {
    throw new Error(`이미지는 ${MAX_LABEL} 이하만 업로드할 수 있어요.`)
  }
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<UploadedFile>('/api/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export function useUploadFile() {
  return useMutation({
    mutationFn: (file: File) => uploadFileReq(file),
  })
}

export const recipeKeys = {
  list: () => ['recipes', 'list'] as const,
  detail: (id: number) => ['recipes', 'detail', id] as const,
  categories: () => ['recipe-categories'] as const,
}

async function fetchRecipes(): Promise<Recipe[]> {
  const { data } = await apiClient.get<Recipe[]>('/api/recipes')
  return data
}

async function fetchRecipe(id: number): Promise<Recipe> {
  const { data } = await apiClient.get<Recipe>(`/api/recipes/${id}`)
  return data
}

async function fetchRecipeCategories(): Promise<RecipeCategory[]> {
  const { data } = await apiClient.get<RecipeCategory[]>('/api/recipe-categories')
  return data
}

async function createRecipeReq(payload: CreateRecipePayload): Promise<Recipe> {
  const { data } = await apiClient.post<Recipe>('/api/recipes', payload)
  return data
}

async function updateRecipeReq(id: number, payload: UpdateRecipePayload): Promise<Recipe> {
  const { data } = await apiClient.patch<Recipe>(`/api/recipes/${id}`, payload)
  return data
}

async function deleteRecipeReq(id: number): Promise<void> {
  await apiClient.delete(`/api/recipes/${id}`)
}

export function useRecipes() {
  return useQuery({ queryKey: recipeKeys.list(), queryFn: fetchRecipes })
}

export function useRecipe(id: number | null) {
  return useQuery({
    queryKey: id == null ? [] : recipeKeys.detail(id),
    queryFn: () => fetchRecipe(id as number),
    enabled: id !== null,
  })
}

export function useRecipeCategories() {
  return useQuery({
    queryKey: recipeKeys.categories(),
    queryFn: fetchRecipeCategories,
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRecipePayload) => createRecipeReq(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.list() }),
  })
}

export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRecipePayload }) =>
      updateRecipeReq(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData<Recipe>(recipeKeys.detail(updated.id), updated)
      qc.setQueryData<Recipe[]>(recipeKeys.list(), (prev) => {
        if (!prev) return prev
        return prev
          .map((r) => (r.id === updated.id ? updated : r))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      })
    },
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRecipeReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.list() }),
  })
}
