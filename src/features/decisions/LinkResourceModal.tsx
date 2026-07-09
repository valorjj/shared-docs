import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Input, Button } from '../../components/ui'
import type { CreateLinkResourcePayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  busy?: boolean
  onSubmit: (payload: CreateLinkResourcePayload) => void
}

export default function LinkResourceModal(props: Props) {
  return <LinkResourceModalInner key={props.open ? 'open' : 'closed'} {...props} />
}

function LinkResourceModalInner({ open, onClose, busy, onSubmit }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    onSubmit({ url: trimmedUrl, title: title.trim() || undefined })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="링크 추가"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="link-resource-form" disabled={busy || !url.trim()}>
            {busy ? '추가 중…' : '추가'}
          </Button>
        </>
      }
    >
      <form id="link-resource-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="resource-url">URL</Label>
          <Input id="resource-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                 maxLength={2048} autoFocus placeholder="https://…" />
        </Field>
        <Field>
          <Label htmlFor="resource-title" optional>제목</Label>
          <Input id="resource-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 maxLength={300} placeholder="예: 유튜브 후기 영상" />
        </Field>
      </form>
    </Modal>
  )
}
