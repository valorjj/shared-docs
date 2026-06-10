import { useCallback, useEffect, useRef, useState } from 'react'
import NoteEditorBody from '../notes/editor/NoteEditorBody'
import { useSharedNote, useUpdateSharedNote } from './api'
import styles from './SharedNoteView.module.css'

type Props = { noteId: number }
const SAVE_MS = 600

export default function SharedNoteView({ noteId }: Props) {
  const shared = useSharedNote(noteId)
  const update = useUpdateSharedNote(noteId)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = useRef<{ title?: string; body?: string } | null>(null)
  const [title, setTitle] = useState<string | null>(null)

  const canEdit = shared.data?.effectivePermission === 'EDIT'

  const scheduleSave = useCallback(
    (patch: { title?: string; body?: string }) => {
      if (!canEdit) return
      pendingPatch.current = { ...pendingPatch.current, ...patch }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const p = pendingPatch.current
        pendingPatch.current = null
        if (p) update.mutate(p)
      }, SAVE_MS)
    },
    [canEdit, update],
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
      <NoteEditorBody
        noteId={note.id}
        initialBody={note.body}
        canEdit={canEdit}
        minimal
        onBodyChange={(html) => scheduleSave({ body: html })}
        registerEditor={() => {}}
        onRequestLinkDialog={() => {}}
      />
    </div>
  )
}
