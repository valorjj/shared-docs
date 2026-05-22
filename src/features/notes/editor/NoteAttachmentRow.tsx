import { useState } from 'react'
import { Download, File, FileText, Image as ImageIcon, MoreHorizontal, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Menu, MenuItem } from '../../../components/ui/Menu'
import { formatBytes } from '../../../lib/format'
import { absoluteFileUrl } from '../api'
import type { Attachment } from '../types'
import styles from './NoteAttachments.module.css'

type Props = {
  attachment: Attachment
  onOpenLightbox?: () => void
  /** Undefined for VIEW recipients — hides the kebab/delete affordance. */
  onDelete?: () => void
}

export default function NoteAttachmentRow({ attachment, onOpenLightbox, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isImage = attachment.contentType.startsWith('image/')
  const url = absoluteFileUrl(attachment.url)

  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.preview}
        onClick={onOpenLightbox}
        disabled={!isImage}
        aria-label={isImage ? `${attachment.originalFilename} 확대 보기` : attachment.originalFilename}
      >
        {isImage ? (
          <img src={url} alt="" loading="lazy" className={styles.previewImg} />
        ) : (
          <span className={styles.previewIcon} aria-hidden="true">
            <FileIcon contentType={attachment.contentType} />
          </span>
        )}
      </button>
      <div className={styles.meta}>
        <a
          className={styles.name}
          href={url}
          target="_blank"
          rel="noreferrer"
          title={attachment.originalFilename}
        >
          {attachment.originalFilename}
        </a>
        <span className={styles.size}>{formatBytes(attachment.sizeBytes)}</span>
      </div>
      <a
        className={styles.action}
        href={url}
        download={attachment.originalFilename}
        target="_blank"
        rel="noreferrer"
        aria-label="다운로드"
        title="다운로드"
      >
        <Download size={15} strokeWidth={1.75} />
      </a>
      {onDelete && (
        <>
          <Menu
            trigger={
              <button type="button" className={styles.action} aria-label={`${attachment.originalFilename} 메뉴`}>
                <MoreHorizontal size={16} strokeWidth={2} />
              </button>
            }
          >
            <MenuItem onSelect={() => setConfirmOpen(true)} icon={<Trash2 size={14} />} destructive>
              첨부 삭제
            </MenuItem>
          </Menu>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={`${attachment.originalFilename}을(를) 삭제할까요?`}
            description="본문에 삽입된 이미지/링크는 그대로 남으니, 본문에서도 함께 지워주세요."
            confirmLabel="삭제"
            destructive
            onConfirm={onDelete}
          />
        </>
      )}
    </li>
  )
}

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith('image/')) return <ImageIcon size={18} strokeWidth={1.5} />
  if (contentType.startsWith('text/') || contentType.includes('pdf')) {
    return <FileText size={18} strokeWidth={1.5} />
  }
  return <File size={18} strokeWidth={1.5} />
}
