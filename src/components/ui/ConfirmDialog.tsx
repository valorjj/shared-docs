import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={description ? undefined : 'no-desc'}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description && <Dialog.Description className={styles.description}>{description}</Dialog.Description>}
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button type="button" className={styles.cancel}>
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`${styles.confirm}${destructive ? ` ${styles.destructive}` : ''}`}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
