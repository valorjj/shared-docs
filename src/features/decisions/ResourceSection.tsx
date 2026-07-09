import { useRef, useState } from 'react'
import { Paperclip, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatBytes } from '../../lib/format'
import { absoluteFileUrl } from '../../lib/files'
import { usePlanResources, useAddLinkResource, useUploadResourceFile, useDeleteResource } from './api'
import { resourceIconSpec } from './resourceIcon'
import type { PlanResource } from './types'
import LinkResourceModal from './LinkResourceModal'
import styles from './ResourceSection.module.css'

type Props = { planId: number }

/** 자료 section — links + files, never gated on the plan's lock state
 *  (evidence stays writable after a decision freezes). */
export default function ResourceSection({ planId }: Props) {
  const { data } = usePlanResources(planId)
  const addLink = useAddLinkResource(planId)
  const uploadFile = useUploadResourceFile(planId)
  const deleteResource = useDeleteResource()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<PlanResource | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resources = data ?? []

  const handleFilePick = (file: File) => {
    uploadFile.mutate(file, {
      onError: (err) => {
        window.alert(err instanceof Error ? err.message : '업로드에 실패했어요.')
      },
    })
  }

  return (
    <section className={styles.section} aria-label="자료">
      <header className={styles.header}>
        <h2 className={styles.heading}>
          <Paperclip size={14} aria-hidden /> 자료
        </h2>
        <div className={styles.headerActions}>
          <button type="button" className={styles.addButton} onClick={() => setLinkModalOpen(true)}>
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

      {resources.length === 0 && <p className={styles.empty}>아직 자료가 없어요.</p>}

      {resources.length > 0 && (
        <ul className={styles.list}>
          {resources.map((r) => {
            const { Icon, tintVar, colorVar } = resourceIconSpec(r)
            const label = r.title ?? r.originalFilename ?? r.url ?? '자료'
            const href = r.kind === 'LINK' ? (r.url ?? '#') : absoluteFileUrl(r.fileUrl ?? '')
            return (
              <li key={r.id} className={styles.row}>
                <span className={styles.tile} style={{ background: tintVar, color: colorVar }} aria-hidden="true">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <a className={styles.name} href={href} target="_blank" rel="noreferrer" title={label}>
                  {label}
                </a>
                {r.kind === 'FILE' && r.sizeBytes != null && (
                  <span className={styles.meta}>{formatBytes(r.sizeBytes)}</span>
                )}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`${label} 삭제`}
                  onClick={() => setConfirmTarget(r)}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <LinkResourceModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        busy={addLink.isPending}
        onSubmit={(payload) => addLink.mutate(payload, { onSuccess: () => setLinkModalOpen(false) })}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title={`${confirmTarget?.title ?? confirmTarget?.originalFilename ?? confirmTarget?.url ?? '자료'}을(를) 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onConfirm={() => {
          if (confirmTarget) deleteResource.mutate(confirmTarget.id)
          setConfirmTarget(null)
        }}
      />
    </section>
  )
}
