// Persists the user's currently-active workspace id so it survives reloads and
// is readable synchronously by the axios interceptor (which can't call hooks).
// Mirrors tokenStorage. The value is the X-Workspace-Id sent on every
// resource request; see api/client.ts.
const ACTIVE_WORKSPACE_KEY = 'shared-docs.activeWorkspaceId'

export function getActiveWorkspaceId(): number | null {
  const raw = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function setActiveWorkspaceId(id: number): void {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(id))
}

export function clearActiveWorkspaceId(): void {
  localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
}

export const ACTIVE_WORKSPACE_STORAGE_KEY = ACTIVE_WORKSPACE_KEY
