import axios, { AxiosError } from 'axios'

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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    const message = body?.error ?? body?.message ?? error.message
    return Promise.reject(new ApiError(message, status, body))
  },
)
