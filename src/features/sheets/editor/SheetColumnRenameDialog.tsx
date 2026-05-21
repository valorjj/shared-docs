import { useState, type FormEvent } from 'react'
import {
  Button,
  Field,
  Input,
  Label,
  Modal,
  Stack,
} from '../../../components/ui'

type Props = {
  open: boolean
  currentName: string
  onSubmit: (name: string) => void
  onClose: () => void
}

/**
 * Replaces `window.prompt('열 이름', …)` for header rename. The OS
 * prompt looks foreign next to the rest of the app's Bear-minimal
 * surfaces, and Safari/Chrome on Mac render it differently — this
 * keeps the affordance on-brand.
 *
 * Wrapper + keyed inner pattern so `currentName` doesn't leak into
 * state across opens.
 */
export default function SheetColumnRenameDialog({ open, currentName, onSubmit, onClose }: Props) {
  return open ? (
    <RenameDialogInner key={currentName} currentName={currentName} onSubmit={onSubmit} onClose={onClose} />
  ) : null
}

function RenameDialogInner({
  currentName,
  onSubmit,
  onClose,
}: {
  currentName: string
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(currentName)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed !== currentName) onSubmit(trimmed)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="열 이름 변경"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            type="submit"
            form="sheet-col-rename-form"
            disabled={!name.trim() || name.trim() === currentName}
          >
            저장
          </Button>
        </>
      }
    >
      <form id="sheet-col-rename-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="sheet-col-rename-input">열 이름</Label>
            <Input
              id="sheet-col-rename-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={200}
              required
            />
          </Field>
        </Stack>
      </form>
    </Modal>
  )
}
