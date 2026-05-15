import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from 'lucide-react'
import { useIsTouch } from '../../../lib/useMediaQuery'
import styles from './NoteEditorBubbleMenu.module.css'

type Props = {
  editor: Editor | null
  /** Parent (NoteEditor) owns the LinkDialog — bubble menu just asks
   *  for it to open. */
  onRequestLinkDialog: () => void
}

export default function NoteEditorBubbleMenu({ editor, onRequestLinkDialog }: Props) {
  const isTouch = useIsTouch()
  // iOS already shows its own selection menu (Copy / Look Up / 공유…) on text
  // selection — ours fights with it. Hide on touch-primary devices.
  if (!editor || isTouch) return null

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top' }}
      className={styles.menu}
    >
      <Btn active={editor.isActive('bold')} label="굵게"
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} strokeWidth={2} />
      </Btn>
      <Btn active={editor.isActive('italic')} label="기울임"
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} strokeWidth={2} />
      </Btn>
      <Btn active={editor.isActive('strike')} label="취소선"
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={14} strokeWidth={2} />
      </Btn>
      <Btn active={editor.isActive('code')} label="코드"
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={14} strokeWidth={2} />
      </Btn>
      <span className={styles.sep} aria-hidden="true" />
      <Btn active={editor.isActive('link')} label="링크" onClick={onRequestLinkDialog}>
        <LinkIcon size={14} strokeWidth={2} />
      </Btn>
    </BubbleMenu>
  )
}

function Btn({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.btn}${active ? ` ${styles.active}` : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}
