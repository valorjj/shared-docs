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
import { formatRelativeTime } from '../notes/shared/formatRelativeTime'
import type { UsefulLink } from './api'
import { hostnameOf } from './url'
import styles from './LinkCard.module.css'

type Props = {
  link: UsefulLink
  onEdit: () => void
  onRefreshMeta: () => void
  onTogglePin: () => void
  onDelete: () => void
}

export default function LinkCard({
  link,
  onEdit,
  onRefreshMeta,
  onTogglePin,
  onDelete,
}: Props) {
  const [imageError, setImageError] = useState(false)
  const showImage = !!link.imageUrl && !imageError

  return (
    <article className={styles.card}>
      {showImage && (
        <a
          className={styles.imageLink}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${link.title ?? link.url} 새 탭에서 열기`}
        >
          <img
            className={styles.image}
            src={link.imageUrl!}
            alt=""
            loading="lazy"
            onError={() => setImageError(true)}
          />
        </a>
      )}
      <div className={styles.body}>
        <header className={styles.head}>
          <div className={styles.site}>
            {link.faviconUrl && !imageError ? (
              <img
                className={styles.favicon}
                src={link.faviconUrl}
                alt=""
                width={14}
                height={14}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span className={styles.faviconFallback} aria-hidden="true" />
            )}
            <span className={styles.siteName}>
              {link.siteName ?? hostnameOf(link.url)}
            </span>
          </div>
          <div className={styles.headActions}>
            {link.pinned && (
              <span className={styles.pinned} title="고정됨" aria-label="고정됨">
                <Pin size={12} strokeWidth={2.25} />
              </span>
            )}
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
        </header>

        <a
          className={styles.titleLink}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <h3 className={styles.title}>
            {link.title ?? link.url}
            <ExternalLink size={12} strokeWidth={2} className={styles.externalIcon} aria-hidden="true" />
          </h3>
        </a>

        {link.description && (
          <p className={styles.description}>{link.description}</p>
        )}

        {link.note && (
          <div className={styles.note}>
            <span className={styles.noteLabel}>메모</span>
            <p className={styles.noteText}>{link.note}</p>
          </div>
        )}

        <footer className={styles.foot}>
          <span className={styles.category}>{link.category}</span>
          <span className={styles.sep} aria-hidden="true">·</span>
          <span className={styles.time}>{formatRelativeTime(link.updatedAt)}</span>
        </footer>
      </div>
    </article>
  )
}

