import { useState } from 'react'
import {
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu'
import type { UsefulLink } from './api'
import styles from './LinkRow.module.css'

type Props = {
  link: UsefulLink
  onEdit: () => void
  onRefreshMeta: () => void
  onTogglePin: () => void
  onDelete: () => void
}

export default function LinkRow({
  link,
  onEdit,
  onRefreshMeta,
  onTogglePin,
  onDelete,
}: Props) {
  const [faviconErr, setFaviconErr] = useState(false)
  const hasFav = !!link.faviconUrl && !faviconErr

  return (
    <div className={styles.row}>
      <a
        className={styles.main}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className={styles.faviconWrap} aria-hidden="true">
          {hasFav ? (
            <img
              className={styles.favicon}
              src={link.faviconUrl!}
              alt=""
              width={16}
              height={16}
              loading="lazy"
              onError={() => setFaviconErr(true)}
            />
          ) : (
            <span className={styles.faviconFallback} />
          )}
        </span>
        <div className={styles.content}>
          <div className={styles.titleLine}>
            <span className={styles.title}>{link.title ?? link.url}</span>
            {link.pinned && (
              <span className={styles.pinned} aria-label="고정됨">
                <Pin size={11} strokeWidth={2.25} />
              </span>
            )}
            <ExternalLink size={11} strokeWidth={2} className={styles.externalIcon} aria-hidden="true" />
          </div>
          <div className={styles.metaLine}>
            <span className={styles.site}>{link.siteName ?? hostnameOf(link.url)}</span>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.category}>{link.category}</span>
            {link.description && (
              <>
                <span className={styles.sep} aria-hidden="true">·</span>
                <span className={styles.desc}>{link.description}</span>
              </>
            )}
          </div>
        </div>
      </a>
      <Menu
        trigger={
          <button type="button" className={styles.kebab} aria-label="링크 옵션">
            <MoreHorizontal size={14} strokeWidth={1.75} />
          </button>
        }
      >
        <MenuItem onSelect={onEdit} icon={<Pencil size={14} />}>편집</MenuItem>
        <MenuItem onSelect={onRefreshMeta} icon={<RefreshCw size={14} />}>
          메타 새로고침
        </MenuItem>
        <MenuItem
          onSelect={onTogglePin}
          icon={link.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        >
          {link.pinned ? '고정 해제' : '고정'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={onDelete} icon={<Trash2 size={14} />} destructive>
          삭제
        </MenuItem>
      </Menu>
    </div>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
