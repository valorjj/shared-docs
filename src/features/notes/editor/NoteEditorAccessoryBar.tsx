import { useEffect, useReducer } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Highlighter,
  Heading,
  List,
  ListTodo,
  Quote,
  Plus,
} from 'lucide-react'
import { useKeyboardInset } from './useKeyboardInset'
import styles from './NoteEditorAccessoryBar.module.css'

type Props = {
  editor: Editor | null
  /** Opens the block-insert bottom sheet (owned by NoteEditor). */
  onOpenInsert: () => void
}

/** ¶ → H1 → H2 → H3 → ¶. One button cycles through heading levels. */
function cycleHeading(editor: Editor): void {
  const c = editor.chain().focus()
  if (editor.isActive('heading', { level: 1 })) c.toggleHeading({ level: 2 })
  else if (editor.isActive('heading', { level: 2 })) c.toggleHeading({ level: 3 })
  else if (editor.isActive('heading', { level: 3 })) c.setParagraph()
  else c.toggleHeading({ level: 1 })
  c.run()
}

/**
 * Mobile-only formatting bar pinned just above the on-screen keyboard while
 * the editor is focused. Desktop uses NoteEditorToolbar instead (this never
 * mounts there — the keyboard inset stays 0).
 */
export default function NoteEditorAccessoryBar({ editor, onOpenInsert }: Props) {
  const inset = useKeyboardInset()
  // Editor mutations (focus/blur/selection/marks) don't re-render this
  // component on their own — it lives above useEditor. Force a re-render on
  // editor transactions so active states + the focus gate stay live.
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', force)
    editor.on('focus', force)
    editor.on('blur', force)
    return () => {
      editor.off('transaction', force)
      editor.off('focus', force)
      editor.off('blur', force)
    }
  }, [editor])

  if (!editor) return null
  if (inset <= 0 || !editor.isFocused) return null

  const btn = (
    active: boolean,
    label: string,
    onPress: () => void,
    Icon: typeof Bold,
  ) => (
    <button
      type="button"
      className={`${styles.btn}${active ? ` ${styles.active}` : ''}`}
      // pointerdown + preventDefault keeps the editor focused (and the
      // keyboard up) — a plain click would blur the editor first.
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
      }}
      aria-label={label}
      title={label}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )

  return (
    <div className={styles.bar} style={{ bottom: inset }} role="toolbar" aria-label="서식">
      {btn(editor.isActive('bold'), '굵게', () => editor.chain().focus().toggleBold().run(), Bold)}
      {btn(editor.isActive('italic'), '기울임', () => editor.chain().focus().toggleItalic().run(), Italic)}
      {btn(editor.isActive('highlight'), '강조', () => editor.chain().focus().toggleHighlight().run(), Highlighter)}
      {btn(editor.isActive('heading'), '제목', () => cycleHeading(editor), Heading)}
      {btn(editor.isActive('bulletList'), '글머리 기호', () => editor.chain().focus().toggleBulletList().run(), List)}
      {btn(editor.isActive('taskList'), '체크리스트', () => editor.chain().focus().toggleTaskList().run(), ListTodo)}
      {btn(editor.isActive('blockquote'), '인용', () => editor.chain().focus().toggleBlockquote().run(), Quote)}
      {btn(false, '삽입', onOpenInsert, Plus)}
    </div>
  )
}
