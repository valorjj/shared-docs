import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import type { SlashItem } from './extensions/SlashCommand'
import styles from './NoteInsertSheet.module.css'

type Props = {
  open: boolean
  onClose: () => void
  editor: Editor | null
  items: SlashItem[]
}

/**
 * Mobile block-insert sheet opened from the accessory bar's `+`. Reuses the
 * slash-menu items so `/` and `+` stay one source of truth. Runs each item at
 * the current (empty) selection — `deleteRange` on an empty range is a no-op,
 * so nothing is removed (the slash flow instead deletes the typed query).
 */
export default function NoteInsertSheet({ open, onClose, editor, items }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !editor) return null

  const runItem = (item: SlashItem) => {
    const { from, to } = editor.state.selection
    item.run(editor, { from, to })
    onClose()
  }

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="삽입">
        <div className={styles.grabber} aria-hidden="true" />
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => runItem(item)}
              >
                <item.Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>,
    document.body,
  )
}
