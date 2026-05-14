import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import styles from './AppSidebarSheet.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

/**
 * Mobile-only Radix Dialog slide-up sheet. Pair with `AppSidebar` so
 * touch users get the same filter / nav surface that desktop shows
 * in the left rail.
 */
export function AppSidebarSheet({ open, onOpenChange, title, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <div className={styles.handle} aria-hidden="true" />
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
