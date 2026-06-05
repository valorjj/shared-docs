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
  // synchronously from storage (interceptors can't use hooks).
  //
  // CRUCIAL: do NOT attach the header to the workspace-management or auth
  // endpoints. Those are workspace-agnostic AND are the recovery path: if the
  // stored id is stale (e.g. the workspace was deleted, or the DB was rebuilt),
  // WorkspaceContextFilter 403s any request carrying it — so attaching it to
  // /api/workspaces would 403 the very call the client uses to re-discover its
  // workspaces, leaving the app permanently stuck.
  // /api/invitations is workspace-agnostic too: a brand-new invitee may have a
  // stale/no active workspace when they hit the claim endpoint, and attaching a
  // bad X-Workspace-Id would get the request 403'd by WorkspaceContextFilter
  // before the token-based claim even runs.
  const url = config.url ?? ''
  const workspaceAgnostic =
    url.startsWith('/api/workspaces') || url.startsWith('/api/auth') || url.startsWith('/api/invitations')
  const workspaceId = getActiveWorkspaceId()
  if (workspaceId != null && !workspaceAgnostic) {
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
