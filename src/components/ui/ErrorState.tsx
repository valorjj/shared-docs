import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from './Button'
import styles from './ErrorState.module.css'

/**
 * Inline error block — pairs a single-line message with a "다시 시도"
 * button. Used everywhere a fetch can fail and the user should retry
 * without leaving the page.
 *
 * Accepts an `error` of type `unknown` to match TanStack's `error`
 * shape (`Error | null`). Strings, Error instances, and null/undefined
 * all resolve to a friendly Korean fallback.
 */
export function ErrorState({
  error,
  fallback = '데이터를 불러오지 못했어요.',
  onRetry,
  retryLabel = '다시 시도',
  action,
}: {
  /** TanStack's `error` field, a string, or anything thrown. */
  error?: unknown
  /** Used when `error` doesn't carry a message. */
  fallback?: string
  /** Most call sites already have a refetch() — wire it here. */
  onRetry?: () => void
  retryLabel?: string
  /** Extra action element (e.g. a secondary "관리자에게 알리기" link).
   *  Rendered to the right of the retry button. */
  action?: ReactNode
}) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === 'string' && error
        ? error
        : fallback

  return (
    <div role="alert" className={styles.root}>
      <AlertCircle size={16} strokeWidth={2} aria-hidden="true" className={styles.icon} />
      <span className={styles.message}>{message}</span>
      {(onRetry || action) && (
        <span className={styles.actions}>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {action}
        </span>
      )}
    </div>
  )
}
