import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { ErrorState, IconButton, Skeleton } from '../../components/ui'
import NoteEditorBody from '../notes/editor/NoteEditorBody'
import { useUpdateNote } from '../notes/api'
import { ApiError } from '../../api/client'
import Comments from '../../components/Comments'
import { useDiscussionNote } from './api'
import styles from './DiscussionPane.module.css'

type Props = { planId: number; onClose: () => void }

const SAVE_MS = 600

function EditorSection({ note, onClose }: { note: { id: number; title: string | null; body: string }; onClose: () => void }) {
  const update = useUpdateNote()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = useRef<{ body?: string } | null>(null)

  const scheduleSave = useCallback((patch: { body?: string }) => {
    pendingPatch.current = { ...pendingPatch.current, ...patch }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const p = pendingPatch.current
      pendingPatch.current = null
      if (p) update.mutate({ id: note.id, payload: p })
    }, SAVE_MS)
  }, [note.id, update])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const p = pendingPatch.current
      pendingPatch.current = null
      if (p) update.mutate({ id: note.id, payload: p })
    }
  }, [note.id, update])

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.title}>{note.title || '논의'}</h2>
        <IconButton label="닫기" variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
      <div className={styles.editorWrap}>
        <NoteEditorBody
          noteId={note.id}
          initialBody={note.body}
          canEdit
          minimal
          onBodyChange={(html) => scheduleSave({ body: html })}
          registerEditor={() => {}}
          onRequestLinkDialog={() => {}}
        />
      </div>
      <div className={styles.commentsWrap}>
        <Comments pageId={`note-${note.id}`} title="댓글" />
      </div>
    </>
  )
}

export default function DiscussionPane({ planId, onClose }: Props) {
  const { data: note, isLoading, isError, error, refetch } = useDiscussionNote(planId, true)

  if (isLoading) {
    return (
      <div className={styles.pane}>
        <Skeleton height={32} radius="var(--r-sm)" />
      </div>
    )
  }

  if (isError) {
    const isPrivate =
      error instanceof ApiError &&
      (error.status === 409 && error.body?.type?.includes('discussion-note-private'))
    if (isPrivate) {
      return (
        <div className={styles.pane}>
          <div className={styles.header}>
            <h2 className={styles.title}>논의</h2>
            <IconButton label="닫기" variant="ghost" size="sm" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>
          <p className={styles.privateMsg}>논의 노트가 비공개로 전환되어 있어요.</p>
        </div>
      )
    }
    return (
      <div className={styles.pane}>
        <div className={styles.header}>
          <h2 className={styles.title}>논의</h2>
          <IconButton label="닫기" variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  if (!note) return null

  return (
    <div className={styles.pane}>
      {/* key = note.id so Tiptap re-mounts cleanly if the note is re-created */}
      <EditorSection key={note.id} note={note} onClose={onClose} />
    </div>
  )
}
