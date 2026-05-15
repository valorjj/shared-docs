import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../api/client'
import { linkKeys, type UsefulLinkPreview } from '../../links/api'
import styles from './LinkHoverPreview.module.css'

const HOVER_DELAY_MS = 400
const PAD = 8

type ActiveLink = {
  href: string
  rect: DOMRect
}

/**
 * Delegate `mouseover` listener on the passed-in container — when the
 * cursor lingers over an `<a>` for 400ms, fetch its OpenGraph metadata
 * via the existing `/api/links/preview` endpoint and show a small
 * portaled card with favicon + title + description + (if available)
 * a hero thumbnail.
 *
 * Reuses the same OG fetcher and TanStack query key as `useLinkPreview`
 * in features/links/api.ts so a URL hovered in memo and previewed in
 * the LinkAddModal share the same cache.
 */
export default function LinkHoverPreview({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>
}) {
  const qc = useQueryClient()
  const [active, setActive] = useState<ActiveLink | null>(null)
  const [data, setData] = useState<UsefulLinkPreview | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const clear = () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      // Only preview http(s) links — skip mailto, tel, anchors.
      if (!/^https?:\/\//i.test(href)) return
      clear()
      const rect = anchor.getBoundingClientRect()
      hoverTimerRef.current = window.setTimeout(() => {
        setActive({ href, rect })
        // Read from cache first; if miss, fetch via the shared preview key.
        qc.fetchQuery({
          queryKey: linkKeys.preview(href),
          queryFn: async () => {
            const { data } = await apiClient.post<UsefulLinkPreview>(
              '/api/links/preview',
              { url: href },
            )
            return data
          },
          staleTime: 5 * 60 * 1000,
          retry: false,
        }).then((res) => setData(res)).catch(() => setData(null))
      }, HOVER_DELAY_MS)
    }

    const onOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null
      // If the cursor moved into the popup itself, keep it open.
      if (related && popupRef.current?.contains(related)) return
      clear()
      // Small grace period so the popup doesn't blink off if the cursor
      // slides off the link toward the popup.
      window.setTimeout(() => {
        const hovering = popupRef.current?.matches(':hover')
        if (!hovering) {
          setActive(null)
          setData(null)
        }
      }, 60)
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseout', onOut)
    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseout', onOut)
      clear()
    }
  }, [containerRef, qc])

  if (!active) return null

  // Position: prefer below the link, flip above if there's no room.
  const top =
    active.rect.bottom + 260 > window.innerHeight && active.rect.top > 270
      ? active.rect.top - 6
      : active.rect.bottom + 6
  const placeAbove = top < active.rect.top
  const left = Math.max(
    PAD,
    Math.min(active.rect.left, window.innerWidth - 320 - PAD),
  )

  return createPortal(
    <div
      ref={popupRef}
      className={`${styles.popup}${placeAbove ? ` ${styles.above}` : ''}`}
      style={{ top, left }}
      onMouseLeave={() => {
        setActive(null)
        setData(null)
      }}
      role="dialog"
      aria-label="링크 미리보기"
    >
      <a
        className={styles.body}
        href={active.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {data?.imageUrl ? (
          <img className={styles.image} src={data.imageUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        <div className={styles.text}>
          <div className={styles.site}>
            {data?.faviconUrl && (
              <img
                className={styles.favicon}
                src={data.faviconUrl}
                alt=""
                width={12}
                height={12}
                loading="lazy"
              />
            )}
            <span className={styles.siteName}>
              {data?.siteName ?? hostnameOf(active.href)}
            </span>
          </div>
          {data?.title && <div className={styles.title}>{data.title}</div>}
          {data?.description && (
            <div className={styles.description}>{data.description}</div>
          )}
          {!data && <div className={styles.loading}>미리보기 불러오는 중…</div>}
        </div>
      </a>
    </div>,
    document.body,
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
