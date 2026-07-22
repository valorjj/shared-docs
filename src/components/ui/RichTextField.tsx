import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import styles from './RichTextField.module.css'

type Props = {
  value: string | null
  placeholder: string
  onSave: (html: string) => void
  disabled?: boolean
}

const isBlankHtml = (html: string | null): boolean => {
  if (!html) return true
  // strip tags + &nbsp; and check for any real text
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

/**
 * Small non-collaborative rich-text field for Decisions 장점/단점. Read mode shows
 * server-sanitized HTML with no editor mounted (mobile-light). Tap → edit mode
 * mounts Tiptap; autosaves on change (debounced) and on blur, then exits. The
 * server re-sanitizes on save, so rendering the stored HTML is safe.
 */
export default function RichTextField({ value, placeholder, onSave, disabled }: Props) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    const empty = isBlankHtml(value)
    const enterEdit = () => { if (!disabled) setEditing(true) }
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="편집"
        className={empty ? `${styles.read} ${styles.empty}` : styles.read}
        onClick={(e) => {
          // Let links inside the HTML navigate instead of entering edit mode.
          if ((e.target as HTMLElement).closest('a')) return
          enterEdit()
        }}
        onKeyDown={(e) => {
          if (e.key === ' ') e.preventDefault()
          if (e.key === 'Enter' || e.key === ' ') enterEdit()
        }}
      >
        {empty
          ? <span className={styles.placeholder}>{placeholder}</span>
          : <div className={styles.html} dangerouslySetInnerHTML={{ __html: value! }} />}
      </div>
    )
  }

  return (
    <RichTextEditor
      value={value}
      placeholder={placeholder}
      onSave={onSave}
      onDone={() => setEditing(false)}
    />
  )
}

function RichTextEditor({
  value, placeholder, onSave, onDone,
}: { value: string | null; placeholder: string; onSave: (html: string) => void; onDone: () => void }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<string>(value ?? '')
  const initialRef = useRef<string>(value ?? '')
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true,
        HTMLAttributes: { rel: 'nofollow noopener', target: '_blank' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? '',
    autofocus: 'end',
    editorProps: { attributes: { class: styles.editor } },
    onUpdate: ({ editor }) => {
      latestRef.current = editor.getHTML()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const html = latestRef.current
        if (html !== initialRef.current) {
          onSaveRef.current(html)
          initialRef.current = html
        }
      }, 600)
    },
  })

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (latestRef.current !== initialRef.current) {
      onSaveRef.current(latestRef.current)
    }
  }, [])

  const flushAndExit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (editor) {
      const html = editor.getHTML()
      if (html !== initialRef.current) {
        onSaveRef.current(html)
        initialRef.current = html
      }
    }
    onDone()
  }

  return (
    <div className={styles.editWrap} onBlur={(e) => {
      // Exit only when focus leaves the whole editor subtree (not on internal focus moves).
      if (!e.currentTarget.contains(e.relatedTarget as Node)) flushAndExit()
    }}>
      <EditorContent editor={editor} />
    </div>
  )
}
