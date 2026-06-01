import axios, { AxiosError } from 'axios'
import { clearToken, getToken } from '../auth/tokenStorage'
import { getActiveWorkspaceId } from '../auth/workspaceStorage'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// v1 ad-hoc shape ({ error, message }) plus RFC 7807 ProblemDetail fields the
// v2 backend now returns ({ type, title, detail, status, errors }).
export type ApiErrorBody = {
  error?: string
  message?: string
  type?: string
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string>
}

export class ApiError extends Error {
  status: number
  body?: ApiErrorBody

  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // v2 tenancy: every resource endpoint requires the active workspace. Read it
  // synchronously from storage (interceptors can't use hooks). It's harmless on
  // the few workspace-agnostic endpoints (/api/workspaces, /api/auth) — the
  // backend simply ignores it there. When no workspace is active yet, the
  // header is omitted; the app gates resource rendering until one is set
  // (see ActiveWorkspaceProvider + MobileShell), so resource calls never fire
  // headerless.
  const workspaceId = getActiveWorkspaceId()
  if (workspaceId != null) {
    config.headers['X-Workspace-Id'] = String(workspaceId)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    const message = body?.error ?? body?.message ?? body?.detail ?? body?.title ?? error.message

    if (status === 401) {
      clearToken()
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        window.location.href = '/login?error=session_expired'
      }
    }

    return Promise.reject(new ApiError(message, status, body))
  },
)
