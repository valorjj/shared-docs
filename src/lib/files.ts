/**
 * Shared file-storage helpers. The backend serves uploaded files at
 * `/files/{storedFilename}` (see `FileController` + `FileStorageService`
 * in the `note` package). Multiple frontend features land on this same
 * URL space — memo attachments, recipe hero images, and any future
 * upload-aware feature — so the URL-composition + size-gate constants
 * live here, not duplicated in each feature's `api.ts`.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

/** Client-side gate before a multipart request leaves the browser.
 *  The server's multipart limit (20MB in application.yml) is the
 *  authoritative backstop; this constant just gives users a fast
 *  friendly Korean error before the upload starts. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_LABEL = '5MB'

/** Compose an absolute URL from a stored-file path like `/files/abc.jpg`.
 *  Returns the input unchanged if it's already absolute (e.g. a user
 *  pasted an external CDN URL into a recipe image). */
export function absoluteFileUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${API_BASE}${pathOrUrl}`
}
