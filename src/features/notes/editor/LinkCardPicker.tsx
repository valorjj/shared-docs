import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../api/client'
import {
  Button,
  ErrorText,
  Field,
  Hint,
  Input,
  Label,
  Modal,
  Stack,
} from '../../../components/ui'
import { linkKeys, type UsefulLinkPreview } from '../../links/api'
import type { LinkCardAttrs } from './extensions/LinkCard'

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (attrs: LinkCardAttrs) => void
}

/**
 * Minimal URL → preview → insert flow. Uses the same /api/links/preview
 * endpoint as the LinkAddModal in features/links so cached previews are
 * shared. Insert is one-shot — once the card is in the doc, refresh
 * happens through the card's own kebab menu.
 */
export default function LinkCardPicker({ open, onClose, onInsert }: Props) {
  return open ? <LinkCardPickerInner onClose={onClose} onInsert={onInsert} /> : null
}

function LinkCardPickerInner({
  onClose,
  onInsert,
}: {
  onClose: () => void
  onInsert: (attrs: LinkCardAttrs) => void
}) {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<UsefulLinkPreview | null>(null)

  // Debounce preview fetch — the same 400ms window the LinkAddModal uses.
  useEffect(() => {
    setError(null)
    setPreview(null)
    const trimmed = url.trim()
    if (!isLikelyUrl(trimmed)) return

    let cancelled = false
    const t = window.setTimeout(async () => {
      const normalized = withScheme(trimmed)
      setLoading(true)
      try {
        const data = await qc.fetchQuery({
          queryKey: linkKeys.preview(normalized),
          queryFn: async () => {
            const { data } = await apiClient.post<UsefulLinkPreview>(
              '/api/links/preview',
              { url: normalized },
            )
            return data
          },
          staleTime: 5 * 60 * 1000,
          retry: false,
        })
        if (!cancelled) setPreview(data)
      } catch {
        if (!cancelled) setError('미리보기를 불러오지 못했어요. URL을 확인해주세요.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [url, qc])

  const canSubmit = preview !== null && !loading

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!preview) return
    onInsert({
      url: preview.url,
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      faviconUrl: preview.faviconUrl,
      siteName: preview.siteName,
      capturedAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="링크 카드"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="link-card-form"
            disabled={!canSubmit}
          >
            삽입
          </Button>
        </>
      }
    >
      <form id="link-card-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="link-card-url">URL</Label>
            <Input
              id="link-card-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              autoComplete="off"
              required
            />
            {loading && <Hint>미리보기 불러오는 중…</Hint>}
            {error && <ErrorText>{error}</ErrorText>}
          </Field>

          {preview && <PreviewPanel preview={preview} />}
        </Stack>
      </form>
    </Modal>
  )
}

function PreviewPanel({ preview }: { preview: UsefulLinkPreview }) {
  const host = safeHostname(preview.url)
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        background: 'var(--c-surface-tint)',
      }}
    >
      {preview.imageUrl ? (
        <img
          src={preview.imageUrl}
          alt=""
          style={{
            width: 80,
            height: 80,
            objectFit: 'cover',
            borderRadius: 'var(--r-sm)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 80,
            height: 80,
            background: 'var(--c-border-dashed)',
            borderRadius: 'var(--r-sm)',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--c-text-placeholder)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}
        >
          {preview.faviconUrl && (
            <img src={preview.faviconUrl} alt="" width={12} height={12} />
          )}
          <span>{preview.siteName ?? host}</span>
        </div>
        <div
          style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 'var(--fw-semi)',
            color: 'var(--c-text)',
            lineHeight: 1.35,
            marginBottom: 4,
          }}
        >
          {preview.title ?? host}
        </div>
        {preview.description && (
          <div
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--c-text-muted)',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview.description}
          </div>
        )}
      </div>
    </div>
  )
}

function isLikelyUrl(raw: string): boolean {
  if (!raw) return false
  if (/^https?:\/\//i.test(raw)) return true
  // Bare host-like input (e.g. "example.com/path")
  return /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}/i.test(raw)
}

function withScheme(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
