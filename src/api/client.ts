import axios, { AxiosError } from 'axios'
import { clearToken, getToken } from '../auth/tokenStorage'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

export type ApiErrorBody = { error?: string; message?: string }

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
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    const message = body?.error ?? body?.message ?? error.message

    if (status === 401) {
      clearToken()
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        window.location.href = '/login?error=session_expired'
      }
    }

    return Promise.reject(new ApiError(message, status, body))
  },
)
