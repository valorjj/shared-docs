import { useMemo, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { useAttachments, useDeleteAttachment } from '../api'
import type { Attachment } from '../types'
import NoteAttachmentRow from './NoteAttachmentRow'
import NoteAttachmentLightbox from './NoteAttachmentLightbox'
import styles from './NoteAttachments.module.css'

type Props = {
  noteId: number
  /** When false, attachment delete is hidden — VIEW recipients see the
   *  gallery but can't mutate it. */
  canEdit?: boolean
}

/** Renders the attachment gallery below the editor body. Hidden when
 *  the note has no attachments (it would only add visual noise). */
export default function NoteAttachments({ noteId, canEdit = true }: Props) {
  const attachmentsQuery = useAttachments(noteId)
  const deleteAttachment = useDeleteAttachment()
  const [lightboxId, setLightboxId] = useState<number | null>(null)

  const attachments = useMemo(() => attachmentsQuery.data ?? [], [attachmentsQuery.data])
  const lightboxTarget = useMemo<Attachment | null>(
    () => (lightboxId !== null ? attachments.find((a) => a.id === lightboxId) ?? null : null),
    [attachments, lightboxId],
  )

  if (attachments.length === 0) return null

  return (
    <section className={styles.root} aria-label="첨부 파일">
      <header className={styles.header}>
        <Paperclip size={14} strokeWidth={1.75} className={styles.headerIcon} aria-hidden="true" />
        <span className={styles.headerLabel}>첨부</span>
        <span className={styles.headerCount}>{attachments.length}</span>
      </header>
      <ul className={styles.list}>
        {attachments.map((a) => (
          <NoteAttachmentRow
            key={a.id}
            attachment={a}
            onOpenLightbox={
              a.contentType.startsWith('image/') ? () => setLightboxId(a.id) : undefined
            }
            onDelete={canEdit ? () => deleteAttachment.mutate({ id: a.id, noteId }) : undefined}
          />
        ))}
      </ul>
      <NoteAttachmentLightbox
        attachment={lightboxTarget}
        onClose={() => setLightboxId(null)}
      />
    </section>
  )
}
