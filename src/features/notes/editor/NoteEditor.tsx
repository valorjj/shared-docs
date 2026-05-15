import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  absoluteFileUrl,
  useDeleteNote,
  useUpdateNote,
  useUploadAttachment,
} from '../api'
import type { Note } from '../types'
import NoteAttachments from './NoteAttachments'
import NoteEditorBody from './NoteEditorBody'
import NoteEditorMeta from './NoteEditorMeta'
import NoteEditorMobileBar from './NoteEditorMobileBar'
import NoteEditorTitle from './NoteEditorTitle'
import NoteEditorToolbar from './NoteEditorToolbar'
import styles from './NoteEditor.module.css'

type Props = {
  note: Note
  onDeleted: () => void
  onBack: () => void
}

const AUTOSAVE_MS = 600

export default function NoteEditor({ note, onDeleted, onBack }: Props) {
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const uploadAttachment = useUploadAttachment()

  const [editor, setEditor] = useState<Editor | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Autosave: pendingBody holds the latest HTML; bodyDirty drives the UI hint.
  const pendingBody = useRef<string | null>(null)
  const autosaveTimer = useRef<number | null>(null)
  const [bodyDirty, setBodyDirty] = useState(false)

  const flushBody = useCallback(() => {
    if (pendingBody.current === null) return
    const body = pendingBody.current
    pendingBody.current = null
    setBodyDirty(false)
    updateNote.mutate({ id: note.id, payload: { body } })
  }, [note.id, updateNote])

  const scheduleBodySave = useCallback(
    (html: string) => {
      pendingBody.current = html
      setBodyDirty(true)
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = window.setTimeout(flushBody, AUTOSAVE_MS)
    },
    [flushBody],
  )

  // Flush on unmount / note switch
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current)
        autosaveTimer.current = null
      }
      flushBody()
    }
  }, [note.id, flushBody])

  const handleTitleCommit = (title: string | null) => {
    if (title === note.title) return
    updateNote.mutate({ id: note.id, payload: { title } })
  }

  const handleTogglePin = () => {
    updateNote.mutate({ id: note.id, payload: { pinned: !note.pinned } })
  }

  const handleDelete = () => {
    deleteNote.mutate(note.id, { onSuccess: onDeleted })
  }

  const onUploadImage = async (file: File): Promise<string> => {
    const att = await uploadAttachment.mutateAsync({ noteId: note.id, file })
    return att.url
  }

  const onUploadFile = async (file: File) => {
    const att = await uploadAttachment.mutateAsync({ noteId: note.id, file })
    return { url: att.url, filename: att.originalFilename, sizeBytes: att.sizeBytes }
  }

  const onPickFile = useCallback(() => fileInputRef.current?.click(), [])

  const handlePickedFile = (file: File) => {
    void (async () => {
      try {
        const att = await uploadAttachment.mutateAsync({ noteId: note.id, file })
        if (!editor) return
        if (file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src: absoluteFileUrl(att.url) }).run()
        } else {
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  marks: [{ type: 'link', attrs: { href: absoluteFileUrl(att.url) } }],
                  text: `📎 ${att.originalFilename}`,
                },
              ],
            })
            .run()
        }
      } catch (err) {
        console.error('upload failed', err)
      }
    })()
  }

  return (
    <div className={styles.root}>
      <NoteEditorMobileBar onBack={onBack} />
      <NoteEditorToolbar editor={editor} onPickFile={onPickFile} />
      <input
        ref={fileInputRef}
        type="file"
        className={styles.hiddenFile}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) handlePickedFile(file)
        }}
      />

      <div className={styles.scroll}>
        <div className={styles.inner}>
          <NoteEditorTitle key={note.id} initialValue={note.title} onCommit={handleTitleCommit} />
          <NoteEditorMeta
            note={note}
            saving={bodyDirty || updateNote.isPending}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
          />
          <NoteEditorBody
            noteId={note.id}
            initialBody={note.body}
            onBodyChange={scheduleBodySave}
            onUploadImage={onUploadImage}
            onUploadFile={onUploadFile}
            onPickFile={onPickFile}
            registerEditor={setEditor}
          />
          <NoteAttachments noteId={note.id} />
        </div>
      </div>
    </div>
  )
}
