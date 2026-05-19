import { useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react'
import { apiClient } from '../../../../api/client'
import { linkKeys, type UsefulLinkPreview } from '../../../links/api'
import { Menu, MenuItem } from '../../../../components/ui/Menu'
import ConfirmDialog from '../../../../components/ui/ConfirmDialog'
import LinkNavigateDialog from '../LinkNavigateDialog'
import type { LinkCardAttrs } from './LinkCard'
import styles from './LinkCardView.module.css'

/**
 * React node view for the `linkCard` Tiptap block node. Bear-style card —
 * hairline border, no shadow, no card lift. Click the card opens the
 * shared `LinkNavigateDialog` confirm flow, matching plain-link clicks
 * elsewhere in the editor.
 */
export default function LinkCardView(props: NodeViewProps) {
  const attrs = props.node.attrs as LinkCardAttrs
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const host = safeHostname(attrs.url)
  const title = attrs.title ?? host
  const captured = formatCapturedAt(attrs.capturedAt)

  const handleRefresh = async () => {
    if (refreshing || !attrs.url) return
    setRefreshing(true)
    try {
      const fresh = await qc.fetchQuery({
        queryKey: linkKeys.preview(attrs.url),
        queryFn: async () => {
          const { data } = await apiClient.post<UsefulLinkPreview>(
            '/api/links/preview',
            { url: attrs.url },
          )
          return data
        },
        staleTime: 0,
        retry: false,
      })
      props.updateAttributes({
        title: fresh.title,
        description: fresh.description,
        imageUrl: fresh.imageUrl,
        faviconUrl: fresh.faviconUrl,
        siteName: fresh.siteName,
        capturedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('link card refresh failed', err)
      window.alert('미리보기를 갱신하지 못했어요.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <NodeViewWrapper className={styles.wrap}>
      <div className={styles.card} contentEditable={false}>
        <button
          type="button"
          className={styles.clickArea}
          onClick={() => setNavOpen(true)}
          aria-label={`링크 열기: ${title}`}
        >
          <div className={styles.text}>
            <div className={styles.siteRow}>
              {attrs.faviconUrl ? (
                <img
                  className={styles.favicon}
                  src={attrs.faviconUrl}
                  alt=""
                  width={14}
                  height={14}
                  loading="lazy"
                />
              ) : (
                <span className={styles.faviconPlaceholder} aria-hidden="true" />
              )}
              <span className={styles.siteName}>{attrs.siteName ?? host}</span>
            </div>
            <div className={styles.title}>{title}</div>
            {attrs.description && (
              <div className={styles.description}>{attrs.description}</div>
            )}
          </div>
          {attrs.imageUrl && (
            <img
              className={styles.image}
              src={attrs.imageUrl}
              alt=""
              loading="lazy"
            />
          )}
        </button>
        <div className={styles.kebab}>
          <Menu
            trigger={
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="링크 카드 메뉴"
              >
                <MoreHorizontal size={16} strokeWidth={2} />
              </button>
            }
          >
            <MenuItem onSelect={() => setNavOpen(true)} icon={<ExternalLink size={14} />}>
              열기
            </MenuItem>
            <MenuItem onSelect={handleRefresh} icon={<RefreshCw size={14} />}>
              {refreshing ? '갱신 중…' : '새로고침'}
            </MenuItem>
            <MenuItem
              onSelect={() => setConfirmOpen(true)}
              icon={<Trash2 size={14} />}
              destructive
            >
              삭제
            </MenuItem>
          </Menu>
        </div>
      </div>
      {captured && <div className={styles.captured}>{captured}</div>}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="링크 카드를 삭제할까요?"
        description="본문에서 카드가 제거됩니다. 원본 페이지는 영향을 받지 않아요."
        confirmLabel="삭제"
        destructive
        onConfirm={() => props.deleteNode()}
      />
      <LinkNavigateDialog
        open={navOpen}
        href={attrs.url}
        onClose={() => setNavOpen(false)}
      />
    </NodeViewWrapper>
  )
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatCapturedAt(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd} 캡처`
  } catch {
    return ''
  }
}
