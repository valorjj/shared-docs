import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { absoluteFileUrl } from '../api'
import type { Attachment } from '../types'
import { formatBytes } from '../../../lib/format'
import styles from './NoteAttachmentLightbox.module.css'

type Props = {
  attachment: Attachment | null
  onClose: () => void
}

/** Radix Dialog full-screen image viewer. Only renders when `attachment`
 *  is non-null. Click outside / Esc closes (Dialog default). */
export default function NoteAttachmentLightbox({ attachment, onClose }: Props) {
  const open = attachment !== null
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.srOnly}>
            {attachment?.originalFilename ?? ''}
          </Dialog.Title>
          {attachment && (
            <>
              <img
                src={absoluteFileUrl(attachment.url)}
                alt={attachment.originalFilename}
                className={styles.image}
              />
              <footer className={styles.footer}>
                <span className={styles.name}>{attachment.originalFilename}</span>
                <span className={styles.size}>{formatBytes(attachment.sizeBytes)}</span>
              </footer>
            </>
          )}
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
