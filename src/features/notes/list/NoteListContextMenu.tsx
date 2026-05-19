import { useState, type FormEvent } from 'react'
import {
  Copy,
  Link as LinkIcon,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import {
  Button,
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  Field,
  Input,
  Label,
  Modal,
  Stack,
} from '../../../components/ui'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useCreateNote, useDeleteNote, useUpdateNote } from '../api'
import { noteDisplayTitle } from '../shared/notePreview'
import type { Note } from '../types'

export type NoteListContextMenuState = {
  note: Note
  x: number
  y: number
} | null

type Props = {
  state: NoteListContextMenuState
  onClose: () => void
  onAfterDuplicate?: (newNoteId: number) => void
  onAfterDelete?: (deletedNoteId: number) => void
}

/**
 * Right-click menu for memo rows in the sidebar list. Owns the rename
 * modal + trash confirm dialog so callers only manage menu position +
 * the active row. Mutations are wired here so the menu stays decoupled
 * from `NoteWorkspace`'s editor-side flow.
 */
export default function NoteListContextMenu({
  state,
  onClose,
  onAfterDuplicate,
  onAfterDelete,
}: Props) {
  const updateNote = useUpdateNote()
  const createNote = useCreateNote()
  const deleteNote = useDeleteNote()

  // The rename modal and confirm dialog need to keep a reference to the
  // selected note even after the context menu closes (which clears
  // `state`), so we snapshot the row into local state when each opens.
  const [renameTarget, setRenameTarget] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)

  if (!state && !renameTarget && !deleteTarget) return null

  const note = state?.note

  const togglePin = () => {
    if (!note) return
    updateNote.mutate({ id: note.id, payload: { pinned: !note.pinned } })
    onClose()
  }

  const startRename = () => {
    if (!note) return
    setRenameTarget(note)
    onClose()
  }

  const duplicate = () => {
    if (!note) return
    const base = noteDisplayTitle(note.title, note.body)
    const copyTitle = note.title ? `${note.title} 복사` : `${base} 복사`
    createNote.mutate(
      { title: copyTitle, body: note.body, pinned: false },
      { onSuccess: (n) => onAfterDuplicate?.(n.id) },
    )
    onClose()
  }

  const copyLink = async () => {
    if (!note) return
    const href = `${window.location.origin}/?note=${note.id}`
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      // Clipboard write denied — silently no-op; rare on https + user gesture.
    }
    onClose()
  }

  const askDelete = () => {
    if (!note) return
    setDeleteTarget(note)
    onClose()
  }

  return (
    <>
      <ContextMenu
        open={state !== null}
        position={state ? { x: state.x, y: state.y } : null}
        onClose={onClose}
        ariaLabel="메모 메뉴"
      >
        {note?.pinned ? (
          <ContextMenuItem icon={<PinOff size={14} />} onSelect={togglePin}>
            고정 해제
          </ContextMenuItem>
        ) : (
          <ContextMenuItem icon={<Pin size={14} />} onSelect={togglePin}>
            고정
          </ContextMenuItem>
        )}
        <ContextMenuItem icon={<Pencil size={14} />} onSelect={startRename}>
          제목 변경
        </ContextMenuItem>
        <ContextMenuItem icon={<Copy size={14} />} onSelect={duplicate}>
          복제
        </ContextMenuItem>
        <ContextMenuItem icon={<LinkIcon size={14} />} onSelect={copyLink}>
          링크 복사
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem icon={<Trash2 size={14} />} destructive onSelect={askDelete}>
          휴지통으로 이동
        </ContextMenuItem>
      </ContextMenu>

      <RenameModal
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={(title) => {
          if (!renameTarget) return
          updateNote.mutate({
            id: renameTarget.id,
            payload: { title: title.trim() || null },
          })
          setRenameTarget(null)
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="휴지통으로 이동할까요?"
        description={
          deleteTarget && (
            <span>
              <strong>{noteDisplayTitle(deleteTarget.title, deleteTarget.body)}</strong>{' '}
              메모를 휴지통으로 옮겨요. 휴지통에서 언제든 복원할 수 있어요.
            </span>
          )
        }
        confirmLabel="휴지통으로 이동"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return
          const id = deleteTarget.id
          deleteNote.mutate(id, { onSuccess: () => onAfterDelete?.(id) })
          setDeleteTarget(null)
        }}
      />
    </>
  )
}

function RenameModal({
  target,
  onClose,
  onSubmit,
}: {
  target: Note | null
  onClose: () => void
  onSubmit: (title: string) => void
}) {
  return target ? (
    <RenameModalInner target={target} onClose={onClose} onSubmit={onSubmit} />
  ) : null
}

function RenameModalInner({
  target,
  onClose,
  onSubmit,
}: {
  target: Note
  onClose: () => void
  onSubmit: (title: string) => void
}) {
  const [title, setTitle] = useState(target.title ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(title)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="제목 변경"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" type="submit" form="rename-note-form">
            저장
          </Button>
        </>
      }
    >
      <form id="rename-note-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="rename-note-title" optional>제목</Label>
            <Input
              id="rename-note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 없음"
              autoFocus
              autoComplete="off"
              maxLength={300}
            />
          </Field>
        </Stack>
      </form>
    </Modal>
  )
}
