import { useEffect, useState, type FormEvent } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'
import {
  Button,
  Checkbox,
  ErrorText,
  Field,
  Input,
  Label,
  Modal,
  Select,
  Stack,
  Textarea,
} from '../../components/ui'
import {
  useCreateUsefulLink,
  useLinkPreview,
  useUsefulLinkCategories,
  type CreateUsefulLinkPayload,
  type UsefulLinkPreview,
} from './api'
import { hostnameOf } from './url'
import styles from './LinkAddModal.module.css'

type Props = {
  open: boolean
  onClose: () => void
}

const URL_OK_RE = /^([a-z][a-z0-9+\-.]*:)?\/\//i
const LIKELY_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+/i

function looksLikeUrl(raw: string): boolean {
  const v = raw.trim()
  if (v.length < 4) return false
  return URL_OK_RE.test(v) || LIKELY_DOMAIN_RE.test(v)
}

export default function LinkAddModal({ open, onClose }: Props) {
  return open ? <LinkAddModalInner onClose={onClose} /> : null
}

function LinkAddModalInner({ onClose }: { onClose: () => void }) {
  const { data: categories } = useUsefulLinkCategories()
  const create = useCreateUsefulLink()

  const [url, setUrl] = useState('')
  const [debouncedUrl, setDebouncedUrl] = useState('')
  const [note, setNote] = useState('')
  const [pinned, setPinned] = useState(false)
  // Null until the user picks one — the default value is derived from
  // the loaded categories list rather than synced via an effect.
  const [category, setCategory] = useState<string | null>(null)
  const effectiveCategory = category ?? categories?.[0]?.name ?? ''

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedUrl(url), 500)
    return () => window.clearTimeout(t)
  }, [url])

  const previewEnabled = looksLikeUrl(debouncedUrl)
  const preview = useLinkPreview(debouncedUrl, previewEnabled)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl || !effectiveCategory) return
    const p = preview.data
    const payload: CreateUsefulLinkPayload = {
      url: trimmedUrl,
      title: p?.title ?? null,
      description: p?.description ?? null,
      imageUrl: p?.imageUrl ?? null,
      faviconUrl: p?.faviconUrl ?? null,
      siteName: p?.siteName ?? null,
      note: note.trim() || null,
      pinned,
      category: effectiveCategory,
    }
    create.mutate(payload, { onSuccess: onClose })
  }

  const busy = create.isPending
  const error = create.error

  return (
    <Modal
      open
      onClose={onClose}
      title="링크 추가"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button
            variant="primary"
            type="submit"
            form="link-add-form"
            disabled={busy || !url.trim() || !effectiveCategory}
          >
            {busy ? '저장 중…' : '추가'}
          </Button>
        </>
      }
    >
      <form id="link-add-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="link-add-url">URL</Label>
            <Input
              id="link-add-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
              autoComplete="off"
            />
          </Field>

          {previewEnabled && (
            <PreviewCard
              loading={preview.isLoading || preview.isFetching}
              data={preview.data}
              error={preview.isError}
            />
          )}

          <Field>
            <Label htmlFor="link-add-category">카테고리</Label>
            <Select
              id="link-add-category"
              value={effectiveCategory}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="" disabled>선택…</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="link-add-note" optional>메모</Label>
            <Textarea
              id="link-add-note"
              rows={3}
              placeholder="이 링크를 저장한 이유를 적어두면 나중에 찾기 쉬워요."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </Field>

          <Checkbox
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            label="목록 상단에 고정"
          />

          {error && (
            <ErrorText>
              {error instanceof Error ? error.message : '저장에 실패했습니다.'}
            </ErrorText>
          )}
        </Stack>
      </form>
    </Modal>
  )
}

function PreviewCard({
  loading,
  data,
  error,
}: {
  loading: boolean
  data: UsefulLinkPreview | undefined
  error: boolean
}) {
  if (loading) {
    return (
      <div className={styles.previewLoading}>
        <Loader2 size={14} strokeWidth={2} className={styles.spin} aria-hidden="true" />
        미리보기 불러오는 중…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className={styles.previewError}>
        <ImageOff size={14} strokeWidth={1.75} aria-hidden="true" />
        미리보기를 가져오지 못했어요. 그대로 저장해도 됩니다.
      </div>
    )
  }
  const empty = !data.title && !data.description && !data.imageUrl
  if (empty) {
    return (
      <div className={styles.previewError}>
        <ImageOff size={14} strokeWidth={1.75} aria-hidden="true" />
        이 페이지는 미리보기 정보를 제공하지 않아요.
      </div>
    )
  }
  return (
    <div className={styles.preview}>
      {data.imageUrl ? (
        <img className={styles.previewImage} src={data.imageUrl} alt="" loading="lazy" />
      ) : (
        <div className={styles.previewImagePlaceholder} aria-hidden="true" />
      )}
      <div className={styles.previewBody}>
        <div className={styles.previewSite}>
          {data.faviconUrl && (
            <img className={styles.previewFavicon} src={data.faviconUrl} alt="" width={12} height={12} />
          )}
          {data.siteName ?? hostnameOf(data.url)}
        </div>
        {data.title && <div className={styles.previewTitle}>{data.title}</div>}
        {data.description && <div className={styles.previewDesc}>{data.description}</div>}
      </div>
    </div>
  )
}

