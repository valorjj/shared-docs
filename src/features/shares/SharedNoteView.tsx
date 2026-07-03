import { useCallback, useEffect, useRef, useState } from 'react'
import NoteEditorBody from '../notes/editor/NoteEditorBody'
import { useSharedNote, useUpdateSharedNote } from './api'
import { useNoteCollaboration } from '../notes/collab/useNoteCollaboration'
import { collabColorForUser } from '../notes/collab/collabColor'
import CollabAvatarStack from '../notes/collab/CollabAvatarStack'
import { useAuth } from '../../auth/useAuth'
import styles from './SharedNoteView.module.css'

type Props = { noteId: number }
const SAVE_MS = 600

export default function SharedNoteView({ noteId }: Props) {
  const shared = useSharedNote(noteId)
  const update = useUpdateSharedNote(noteId)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = useRef<{ title?: string; body?: string } | null>(null)
  // Same overlapping-PATCH hazard as NoteEditor.tsx's autosave: without this,
  // a slow response plus another edit re-arming the debounce can fire a
  // second PATCH before the first returns, racing the row's optimistic lock.
  const savingInFlight = useRef(false)
  const flushRef = useRef<() => void>(() => {})
  const [title, setTitle] = useState<string | null>(null)

  const canEdit = shared.data?.effectivePermission === 'EDIT'
  // Backend gates the WS room the same way: workspace membership OR a
  // cross-workspace EDIT share — VIEW-only recipients never get a room, so
  // don't bother opening a socket for them.
  const { user } = useAuth()
  const collab = useNoteCollaboration(noteId, canEdit)
  const collabUser = user ? { name: user.name, color: collabColorForUser(user.userId) } : undefined

  const flush = useCallback(() => {
    const p = pendingPatch.current
    if (p === null) return
    if (savingInFlight.current) {
      // A save is already in flight — don't start a second one.
      saveTimer.current = setTimeout(() => flushRef.current(), SAVE_MS)
      return
    }
    pendingPatch.current = null
    savingInFlight.current = true
    update.mutate(p, {
      onSettled: () => {
        savingInFlight.current = false
      },
      onError: () => {
        // Lost a race (e.g. the note's other editor saved first). Requeue —
        // newer fields win over the failed ones — and retry.
        pendingPatch.current = { ...p, ...pendingPatch.current }
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => flushRef.current(), SAVE_MS)
      },
    })
  }, [update])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const scheduleSave = useCallback(
    (patch: { title?: string; body?: string }) => {
      if (!canEdit) return
      pendingPatch.current = { ...pendingPatch.current, ...patch }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => flushRef.current(), SAVE_MS)
    },
    [canEdit],
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const p = pendingPatch.current
      pendingPatch.current = null
      if (p && canEdit) update.mutate(p)
    }
  }, [noteId, canEdit, update])

  if (shared.isLoading) return <p className={styles.state}>불러오는 중…</p>
  if (shared.isError || !shared.data)
    return <p className={styles.state}>공유받은 항목을 찾을 수 없어요.</p>

  const note = shared.data.note
  const titleValue = title ?? note.title ?? ''

  return (
    <div className={styles.view}>
      {canEdit ? (
        <input
          className={styles.title}
          placeholder="제목 없음"
          value={titleValue}
          onChange={(e) => {
            setTitle(e.target.value)
            scheduleSave({ title: e.target.value })
          }}
        />
      ) : (
        <h1 className={styles.titleStatic}>{note.title || '제목 없음'}</h1>
      )}
      {!canEdit && <p className={styles.badge}>보기 전용</p>}
      {collab && <CollabAvatarStack provider={collab.provider} />}
      <NoteEditorBody
        noteId={note.id}
        initialBody={note.body}
        canEdit={canEdit}
        minimal
        onBodyChange={(html) => scheduleSave({ body: html })}
        registerEditor={() => {}}
        onRequestLinkDialog={() => {}}
        collab={collab}
        collabUser={collabUser}
      />
    </div>
  )
}
