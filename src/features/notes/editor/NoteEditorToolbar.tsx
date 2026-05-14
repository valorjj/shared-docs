import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Paperclip,
} from 'lucide-react'
import styles from './NoteEditorToolbar.module.css'

type Props = {
  editor: Editor | null
  onPickFile: () => void
}

export default function NoteEditorToolbar({ editor, onPickFile }: Props) {
  if (!editor) return null

  const promptLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

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
      {btn(editor.isActive('blockquote'), '인용', () =>
        editor.chain().focus().toggleBlockquote().run(), Quote)}
      {btn(editor.isActive('codeBlock'), '코드', () =>
        editor.chain().focus().toggleCodeBlock().run(), Code)}
      <span className={styles.sep} aria-hidden="true" />
      {btn(editor.isActive('link'), '링크', promptLink, LinkIcon)}
      {btn(false, '파일 첨부', onPickFile, Paperclip)}
    </div>
  )
}
