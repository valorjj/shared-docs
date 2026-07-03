import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  absoluteFileUrl,
  useDeleteNote,
  useUpdateNote,
  useUploadAttachment,
} from '../api'
import type { Note } from '../types'
import DataSnapshotPicker from '../../snapshots/DataSnapshotPicker'
import type { SnapshotAttrs } from '../../snapshots/types'
import CalcSnapshotPicker, { type CalcSnapshotAttrs } from '../../calc/embed/CalcSnapshotPicker'
import LinkCardPicker from './LinkCardPicker'
import type { LinkCardAttrs } from './extensions/LinkCard'
import ShareDialog from '../../shares/ShareDialog'
import LinkDialog from './LinkDialog'
import NoteAttachments from './NoteAttachments'
import NoteEditorBody from './NoteEditorBody'
import NoteEditorMeta from './NoteEditorMeta'
import NoteEditorMobileBar from './NoteEditorMobileBar'
import NoteEditorTitle from './NoteEditorTitle'
import NoteEditorToolbar from './NoteEditorToolbar'
import NoteReferrers from './NoteReferrers'
import { useNoteCollaboration } from '../collab/useNoteCollaboration'
import { collabColorForUser } from '../collab/collabColor'
import CollabAvatarStack from '../collab/CollabAvatarStack'
import { useAuth } from '../../../auth/useAuth'
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

  // After the 2026-05-28 share-system removal the editor is always
  // editable for whomever can see it (visibility check happens server-side).
  const canEdit = true

  const { user } = useAuth()
  const collab = useNoteCollaboration(note.id, note.visibility === 'WORKSPACE')
  const collabUser = user ? { name: user.name, color: collabColorForUser(user.userId) } : undefined

  const [editor, setEditor] = useState<Editor | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [calcSnapshotOpen, setCalcSnapshotOpen] = useState(false)
  const [linkCardOpen, setLinkCardOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const openLinkDialog = useCallback(() => setLinkDialogOpen(true), [])

  // Autosave: pendingBody holds the latest HTML; bodyDirty drives the UI hint.
  const pendingBody = useRef<string | null>(null)
  const autosaveTimer = useRef<number | null>(null)
  const [bodyDirty, setBodyDirty] = useState(false)
  // True while a PATCH is in flight. Without this, a slow response (Cloudflare
  // Tunnel round-trip) plus the user typing again after the 600ms debounce
  // re-arms lets a SECOND PATCH fire before the first one returns — two
  // requests from the same tab racing the row's optimistic-lock version. Root
  // cause of the "Record has changed since last read" conflicts, no second
  // collaborator required.
  const savingInFlight = useRef(false)
  // Lets the retry/requeue paths below re-invoke the latest flushBody without
  // a self-reference inside its own useCallback (react-hooks/immutability).
  const flushBodyRef = useRef<() => void>(() => {})

  const flushBody = useCallback(() => {
    if (pendingBody.current === null) return
    if (savingInFlight.current) {
      // A save is already in flight — don't start a second one. The pending
      // content stays queued; try again shortly.
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = window.setTimeout(() => flushBodyRef.current(), AUTOSAVE_MS)
      return
    }
    const body = pendingBody.current
    pendingBody.current = null
    setBodyDirty(false)
    savingInFlight.current = true
    updateNote.mutate(
      { id: note.id, payload: { body } },
      {
        onSettled: () => {
          savingInFlight.current = false
        },
        onError: () => {
          // Still lost a race (e.g. a real second collaborator). Don't
          // silently drop the edit — requeue and retry. Prefer the editor's
          // current HTML over the stale failed snapshot: it's a full-document
          // snapshot, so it already includes this edit plus anything that
          // landed (locally or via Yjs sync) since the failed attempt.
          pendingBody.current = editor?.getHTML() ?? body
          setBodyDirty(true)
          if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
          autosaveTimer.current = window.setTimeout(() => flushBodyRef.current(), AUTOSAVE_MS)
        },
      },
    )
  }, [note.id, updateNote, editor])

  useEffect(() => {
    flushBodyRef.current = flushBody
  }, [flushBody])

  const scheduleBodySave = useCallback(
    (html: string) => {
      // Defensive — VIEW recipients shouldn't reach this since Tiptap
      // is editable={false}, but if a custom keystroke handler ever
      // bypasses that flag we still refuse to schedule the save.
      if (!canEdit) return
      pendingBody.current = html
      setBodyDirty(true)
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = window.setTimeout(flushBody, AUTOSAVE_MS)
    },
    [canEdit, flushBody],
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
    if (!canEdit) return
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
  const onPickSnapshot = useCallback(() => setSnapshotOpen(true), [])
  const onPickCalcSnapshot = useCallback(() => setCalcSnapshotOpen(true), [])
  const onPickLinkCard = useCallback(() => setLinkCardOpen(true), [])

  const handleInsertSnapshot = (attrs: SnapshotAttrs) => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'dataSnapshot', attrs }).run()
  }

  const handleInsertCalcSnapshot = (attrs: CalcSnapshotAttrs) => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'calcSnapshot', attrs }).run()
  }

  const handleInsertLinkCard = (attrs: LinkCardAttrs) => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'linkCard', attrs }).run()
  }

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
        const msg = err instanceof Error ? err.message : '파일 업로드에 실패했어요.'
        window.alert(msg)
      }
    })()
  }

  return (
    <div className={styles.root}>
      <NoteEditorMobileBar onBack={onBack} />
      {canEdit && (
        <NoteEditorToolbar
          editor={editor}
          onPickFile={onPickFile}
          onRequestLinkDialog={openLinkDialog}
          onPickLinkCard={onPickLinkCard}
        />
      )}
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
          <NoteEditorTitle
            key={note.id}
            initialValue={note.title}
            onCommit={handleTitleCommit}
            readOnly={!canEdit}
          />
          <NoteEditorMeta
            note={note}
            saving={bodyDirty || updateNote.isPending}
            canEdit={canEdit}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
            onShare={() => setShareOpen(true)}
          />
          {collab && <CollabAvatarStack provider={collab.provider} />}
          <NoteReferrers noteId={note.id} />
          <NoteEditorBody
            noteId={note.id}
            initialBody={note.body}
            canEdit={canEdit}
            onBodyChange={scheduleBodySave}
            onUploadImage={onUploadImage}
            onUploadFile={onUploadFile}
            onPickFile={onPickFile}
            onPickSnapshot={onPickSnapshot}
            onPickLinkCard={onPickLinkCard}
            onPickCalcSnapshot={onPickCalcSnapshot}
            registerEditor={setEditor}
            onRequestLinkDialog={openLinkDialog}
            collab={collab}
            collabUser={collabUser}
          />
          <NoteAttachments noteId={note.id} canEdit={canEdit} />
        </div>
      </div>
      <DataSnapshotPicker
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        onInsert={handleInsertSnapshot}
      />
      <CalcSnapshotPicker
        open={calcSnapshotOpen}
        onOpenChange={setCalcSnapshotOpen}
        onInsert={handleInsertCalcSnapshot}
      />
      <LinkCardPicker
        open={linkCardOpen}
        onClose={() => setLinkCardOpen(false)}
        onInsert={handleInsertLinkCard}
      />
      <LinkDialog
        open={linkDialogOpen}
        editor={editor}
        onClose={() => setLinkDialogOpen(false)}
      />
      <ShareDialog
        noteId={note.id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}
