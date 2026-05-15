import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { absoluteFileUrl } from '../api'
import { Tag } from './extensions/Tag'
import {
  SlashCommand,
  type SlashKeyHandler,
  type SlashState,
} from './extensions/SlashCommand'
import { buildSlashItems } from './slashItems'
import NoteEditorBubbleMenu from './NoteEditorBubbleMenu'
import SlashMenuPopup from './SlashMenuPopup'
import styles from './NoteEditorBody.module.css'

type Props = {
  noteId: number
  initialBody: string
  onBodyChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string>
  onUploadFile: (file: File) => Promise<{ url: string; filename: string; sizeBytes: number }>
  onPickFile: () => void
  registerEditor: (editor: Editor | null) => void
}

const IMAGE_MIME = /^image\//

export default function NoteEditorBody({
  noteId,
  initialBody,
  onBodyChange,
  onUploadImage,
  onUploadFile,
  onPickFile,
  registerEditor,
}: Props) {
  const lastNoteId = useRef(noteId)

  // Slash menu state — driven from the Tiptap extension's callbacks.
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const slashKeyHandlerRef = useRef<SlashKeyHandler | null>(null)
  const slashItems = useMemo(() => buildSlashItems(onPickFile), [onPickFile])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "내용을 입력하세요. '/' 를 누르면 메뉴가 열려요." }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Tag,
      // Ref is stored on the extension and only read inside ProseMirror
      // keydown handlers — never during render.
      // eslint-disable-next-line react-hooks/refs
      SlashCommand.configure({
        items: slashItems,
        keyHandlerRef: slashKeyHandlerRef,
        onOpen: setSlashState,
        onUpdate: setSlashState,
        onClose: () => setSlashState(null),
      }),
    ],
    content: initialBody || '',
    editorProps: {
      attributes: { class: styles.editor },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (!file) continue
            event.preventDefault()
            void handleFileInsert(file)
            return true
          }
        }
        return false
      },
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        event.preventDefault()
        for (const file of Array.from(files)) {
          void handleFileInsert(file)
        }
        return true
      },
    },
    onUpdate({ editor: e }) {
      onBodyChange(e.getHTML())
    },
  })

  async function handleFileInsert(file: File) {
    if (!editor) return
    try {
      if (IMAGE_MIME.test(file.type)) {
        const url = await onUploadImage(file)
        editor.chain().focus().setImage({ src: absoluteFileUrl(url) }).run()
      } else {
        const att = await onUploadFile(file)
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'paragraph',
            content: [
              {
                type: 'text',
                marks: [{ type: 'link', attrs: { href: absoluteFileUrl(att.url) } }],
                text: `📎 ${att.filename}`,
              },
            ],
          })
          .run()
      }
    } catch (err) {
      console.error('upload failed', err)
      const msg = err instanceof Error ? err.message : '파일 업로드에 실패했어요.'
      window.alert(msg)
    }
  }

  useEffect(() => {
    registerEditor(editor)
    return () => registerEditor(null)
  }, [editor, registerEditor])

  useEffect(() => {
    if (!editor) return
    if (lastNoteId.current !== noteId) {
      lastNoteId.current = noteId
      editor.commands.setContent(initialBody || '', { emitUpdate: false })
    }
  }, [noteId, initialBody, editor])

  return (
    <div className={styles.wrapper}>
      <EditorContent editor={editor} />
      <NoteEditorBubbleMenu editor={editor} />
      {slashState && (
        <SlashMenuPopup state={slashState} keyHandlerRef={slashKeyHandlerRef} />
      )}
    </div>
  )
}
