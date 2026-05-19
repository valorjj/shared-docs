import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  Bookmark,
  Table as TableIcon,
  Link as LinkIcon,
  Paperclip,
} from 'lucide-react'
import styles from './NoteEditorToolbar.module.css'

type Props = {
  editor: Editor | null
  onPickFile: () => void
  /** Parent owns the LinkDialog; toolbar just requests it open. The
   *  context menu (also inside the editor body) requests it via the
   *  same prop, so the dialog has a single source of truth. */
  onRequestLinkDialog: () => void
  onPickLinkCard: () => void
}

export default function NoteEditorToolbar({
  editor,
  onPickFile,
  onRequestLinkDialog,
  onPickLinkCard,
}: Props) {
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
      {btn(editor.isActive('highlight'), '강조', () => editor.chain().focus().toggleHighlight().run(), Highlighter)}
      <span className={styles.sep} aria-hidden="true" />
      {btn(editor.isActive('heading', { level: 1 }), '제목 1', () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1)}
      {btn(editor.isActive('heading', { level: 2 }), '제목 2', () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
      {btn(editor.isActive('heading', { level: 3 }), '제목 3', () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3)}
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
      {btn(false, '구분선', () =>
        editor.chain().focus().setHorizontalRule().run(), Minus)}
      <span className={styles.sep} aria-hidden="true" />
      {btn(editor.isActive('link'), '링크', onRequestLinkDialog, LinkIcon)}
      {btn(false, '링크 카드', onPickLinkCard, Bookmark)}
      {btn(false, '파일 첨부 (이미지 5MB까지)', onPickFile, Paperclip)}
    </div>
  )
}
