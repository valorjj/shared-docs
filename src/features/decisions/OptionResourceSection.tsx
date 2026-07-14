import { useRef, useState } from 'react'
import { Paperclip, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { ImageLightbox } from '../../components/ui'
import { formatBytes } from '../../lib/format'
import { absoluteFileUrl } from '../../lib/files'
import { useAddOptionLinkResource, useUploadOptionResourceFile, useDeleteOptionResource } from './api'
import { resourceIconSpec } from './resourceIcon'
import LinkResourceModal from './LinkResourceModal'
import type { OptionResource } from './types'
import styles from './OptionResourceSection.module.css'

type Props = { optionId: number; resources: OptionResource[] }

const isImage = (r: OptionResource) => (r.contentType ?? '').startsWith('image/')

export default function OptionResourceSection({ optionId, resources }: Props) {
  const addLink = useAddOptionLinkResource(optionId)
  const uploadFile = useUploadOptionResourceFile(optionId)
  const deleteResource = useDeleteOptionResource()
  const [linkOpen, setLinkOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<OptionResource | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const images = resources.filter(isImage)
  const rows = resources.filter((r) => !isImage(r))

  const handleFilePick = (file: File) => {
    uploadFile.mutate(file, {
      onError: (err) => window.alert(err instanceof Error ? err.message : '업로드에 실패했어요.'),
    })
  }

  return (
    <section className={styles.section} aria-label="자료">
      <header className={styles.header}>
        <h4 className={styles.heading}><Paperclip size={13} aria-hidden /> 자료</h4>
        <div className={styles.actions}>
          <button type="button" className={styles.addButton} onClick={() => setLinkOpen(true)}>
            <Plus size={13} aria-hidden /> 링크
          </button>
          <button type="button" className={styles.addButton} onClick={() => fileInputRef.current?.click()}>
            <Plus size={13} aria-hidden /> 파일
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.hiddenInput}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFilePick(file)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {images.length > 0 && (
        <ul className={styles.thumbs}>
          {images.map((r) => {
            const src = absoluteFileUrl(r.fileUrl ?? '')
            const label = r.originalFilename ?? '이미지'
            return (
              <li key={r.id} className={styles.thumb}>
                <button type="button" className={styles.thumbBtn} onClick={() => setLightbox({ src, alt: label })}>
                  <img className={styles.thumbImg} src={src} alt={label} loading="lazy" />
                </button>
                <button
                  type="button"
                  className={styles.thumbRemove}
                  aria-label={`${label} 삭제`}
                  onClick={() => setConfirmTarget(r)}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((r) => {
            const { Icon, tintVar, colorVar } = resourceIconSpec(r)
            const label = r.title ?? r.originalFilename ?? r.url ?? '자료'
            const href = r.kind === 'LINK' ? (r.url ?? '#') : absoluteFileUrl(r.fileUrl ?? '')
            return (
              <li key={r.id} className={styles.row}>
                <span className={styles.tile} style={{ background: tintVar, color: colorVar }} aria-hidden="true">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <a className={styles.name} href={href} target="_blank" rel="noreferrer" title={label}>{label}</a>
                {r.kind === 'FILE' && r.sizeBytes != null && (
                  <span className={styles.meta}>{formatBytes(r.sizeBytes)}</span>
                )}
                <button type="button" className={styles.remove} aria-label={`${label} 삭제`} onClick={() => setConfirmTarget(r)}>
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <LinkResourceModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        busy={addLink.isPending}
        onSubmit={(payload) => addLink.mutate(payload, { onSuccess: () => setLinkOpen(false) })}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title={`${confirmTarget?.title ?? confirmTarget?.originalFilename ?? confirmTarget?.url ?? '자료'}을(를) 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onConfirm={() => { if (confirmTarget) deleteResource.mutate(confirmTarget.id); setConfirmTarget(null) }}
      />
      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </section>
  )
}
