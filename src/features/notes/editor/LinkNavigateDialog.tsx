import { Copy, ExternalLink } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '../../../components/ui'
import styles from './LinkNavigateDialog.module.css'

type Props = {
  open: boolean
  href: string | null
  onClose: () => void
}

/**
 * Confirm dialog shown when the user clicks a link in the editor body.
 * The `Link` Tiptap extension has `openOnClick: false` so clicks never
 * navigate directly — this dialog asks first, mirroring Bear's behavior
 * of preventing accidental tab opens while editing.
 */
export default function LinkNavigateDialog({ open, href, onClose }: Props) {
  if (!href) return null

  const host = safeHostname(href)

  const openInNewTab = () => {
    window.open(href, '_blank', 'noopener,noreferrer')
    onClose()
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      // Clipboard write denied — leave silently.
    }
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby="link-nav-desc">
          <Dialog.Title className={styles.title}>이 링크를 열까요?</Dialog.Title>
          <div id="link-nav-desc" className={styles.body}>
            <div className={styles.host}>{host}</div>
            <div className={styles.url}>{href}</div>
          </div>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <Button variant="ghost">취소</Button>
            </Dialog.Close>
            <Button
              variant="ghost"
              onClick={copyUrl}
              leading={<Copy size={14} strokeWidth={2} />}
            >
              URL 복사
            </Button>
            <Button
              variant="primary"
              onClick={openInNewTab}
              leading={<ExternalLink size={14} strokeWidth={2} />}
            >
              새 탭에서 열기
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
