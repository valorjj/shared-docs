import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Input, Textarea, Button } from '../../components/ui'
import type { TitleDescPayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  entityLabel: string                 // '계획' | '안건' | '선택지'
  initial?: { title: string; description: string | null } | null
  busy?: boolean
  onSubmit: (payload: TitleDescPayload) => void
}

export default function TitleDescModal(props: Props) {
  return (
    <TitleDescModalInner
      key={props.open ? (props.initial ? `edit-${props.initial.title}` : 'new') : 'closed'}
      {...props}
    />
  )
}

function TitleDescModalInner({ open, onClose, entityLabel, initial, busy, onSubmit }: Props) {
  const isEdit = initial != null
  const [title, setTitle] = useState(() => initial?.title ?? '')
  const [description, setDescription] = useState(() => initial?.description ?? '')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onSubmit({ title: t, description: description.trim() || undefined })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${entityLabel} ${isEdit ? '수정' : '추가'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="titledesc-form" disabled={busy || !title.trim()}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form id="titledesc-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="td-title">제목</Label>
          <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 maxLength={200} autoFocus placeholder={`${entityLabel} 제목`} />
        </Field>
        <Field>
          <Label htmlFor="td-desc" optional>설명</Label>
          <Textarea id="td-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000} rows={3} />
        </Field>
      </form>
    </Modal>
  )
}
