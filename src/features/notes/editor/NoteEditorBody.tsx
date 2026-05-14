import { useEffect, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { absoluteFileUrl } from '../api'
import styles from './NoteEditorBody.module.css'

type Props = {
  noteId: number
  initialBody: string
  onBodyChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string>
  onUploadFile: (file: File) => Promise<{ url: string; filename: string; sizeBytes: number }>
  registerEditor: (editor: Editor | null) => void
}

const IMAGE_MIME = /^image\//

export default function NoteEditorBody({
  noteId,
  initialBody,
  onBodyChange,
  onUploadImage,
  onUploadFile,
  registerEditor,
}: Props) {
  const lastNoteId = useRef(noteId)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: '내용을 입력하세요…' }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
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

  return <EditorContent editor={editor} className={styles.wrapper} />
}
