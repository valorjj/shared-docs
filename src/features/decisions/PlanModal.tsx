import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Input, Textarea, Button } from '../../components/ui'
import type { CreatePlanPayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  initial?: { title: string; description: string | null; groupLabel: string | null } | null
  groupOptions?: string[]   // existing group labels, for the datalist
  busy?: boolean
  onSubmit: (payload: CreatePlanPayload) => void
}

export default function PlanModal(props: Props) {
  return (
    <PlanModalInner
      key={props.open ? (props.initial ? `edit-${props.initial.title}` : 'new') : 'closed'}
      {...props}
    />
  )
}

function PlanModalInner({ open, onClose, initial, groupOptions = [], busy, onSubmit }: Props) {
  const isEdit = initial != null
  const [title, setTitle] = useState(() => initial?.title ?? '')
  const [description, setDescription] = useState(() => initial?.description ?? '')
  const [group, setGroup] = useState(() => initial?.groupLabel ?? '')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onSubmit({
      title: t,
      description: description.trim() || undefined,
      // Send '' (not undefined) when cleared on edit, so the backend unsets the group.
      groupLabel: isEdit ? group.trim() : (group.trim() || undefined),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`계획 ${isEdit ? '수정' : '추가'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="plan-form" disabled={busy || !title.trim()}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="plan-title">제목</Label>
          <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 maxLength={200} autoFocus placeholder="계획 제목" />
        </Field>
        <Field>
          <Label htmlFor="plan-desc" optional>설명</Label>
          <Textarea id="plan-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000} rows={3} />
        </Field>
        <Field>
          <Label htmlFor="plan-group" optional>그룹</Label>
          <Input id="plan-group" value={group} onChange={(e) => setGroup(e.target.value)}
                 maxLength={100} list="plan-group-options" placeholder="예: 2026 상반기" />
          <datalist id="plan-group-options">
            {groupOptions.map((g) => <option key={g} value={g} />)}
          </datalist>
        </Field>
      </form>
    </Modal>
  )
}
