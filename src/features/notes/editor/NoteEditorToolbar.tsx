import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Table as TableIcon,
  Link as LinkIcon,
  Paperclip,
} from 'lucide-react'
import LinkDialog from './LinkDialog'
import styles from './NoteEditorToolbar.module.css'

type Props = {
  editor: Editor | null
  onPickFile: () => void
}

export default function NoteEditorToolbar({ editor, onPickFile }: Props) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  if (!editor) return null

  const btn = (
    active: boolean,
    label: string,
    onClick: () => void,
    Icon: typeof Bold,
  ) => (
    <button
      type="button"
      className={`${styles.btn}${active ? ` ${styles.active}` : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  )

  return (
    <div className={styles.bar} role="toolbar" aria-label="서식">
      {btn(editor.isActive('bold'), '굵게', () => editor.chain().focus().toggleBold().run(), Bold)}
      {btn(editor.isActive('italic'), '기울임', () => editor.chain().focus().toggleItalic().run(), Italic)}
      {btn(editor.isActive('strike'), '취소선', () => editor.chain().focus().toggleStrike().run(), Strikethrough)}
      <span className={styles.sep} aria-hidden="true" />
      {btn(editor.isActive('heading', { level: 1 }), '제목 1', () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1)}
      {btn(editor.isActive('heading', { level: 2 }), '제목 2', () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
      <span className={styles.sep} aria-hidden="true" />
      {btn(editor.isActive('bulletList'), '글머리 기호', () =>
        editor.chain().focus().toggleBulletList().run(), List)}
      {btn(editor.isActive('orderedList'), '번호 매기기', () =>
        editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
      {btn(editor.isActive('taskList'), '체크리스트', () =>
        editor.chain().focus().toggleTaskList().run(), ListTodo)}
      {btn(editor.isActive('blockquote'), '인용', () =>
        editor.chain().focus().toggleBlockquote().run(), Quote)}
      {btn(editor.isActive('codeBlock'), '코드', () =>
        editor.chain().focus().toggleCodeBlock().run(), Code)}
      {btn(editor.isActive('table'), '표', () =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), TableIcon)}
      <span className={styles.sep} aria-hidden="true" />
      {btn(editor.isActive('link'), '링크', () => setLinkDialogOpen(true), LinkIcon)}
      {btn(false, '파일 첨부 (이미지 5MB까지)', onPickFile, Paperclip)}

      <LinkDialog
        open={linkDialogOpen}
        editor={editor}
        onClose={() => setLinkDialogOpen(false)}
      />
    </div>
  )
}
