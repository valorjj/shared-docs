import { useState, type FormEvent } from 'react'
import {
  Button,
  Checkbox,
  ErrorText,
  Field,
  Input,
  Label,
  Modal,
  Select,
  Stack,
  Textarea,
} from '../../components/ui'
import {
  useUpdateUsefulLink,
  useUsefulLinkCategories,
  type UpdateUsefulLinkPayload,
  type UsefulLink,
} from './api'

type Props = {
  link: UsefulLink | null
  onClose: () => void
}

/**
 * Wrapper that keys the inner form on the link id so opening a different
 * link re-initializes the form state without a set-state-in-effect.
 */
export default function LinkEditModal({ link, onClose }: Props) {
  return link ? <LinkEditModalInner key={link.id} link={link} onClose={onClose} /> : null
}

function LinkEditModalInner({ link, onClose }: { link: UsefulLink; onClose: () => void }) {
  const { data: categories } = useUsefulLinkCategories()
  const update = useUpdateUsefulLink()

  const [title, setTitle] = useState(link.title ?? '')
  const [description, setDescription] = useState(link.description ?? '')
  const [note, setNote] = useState(link.note ?? '')
  const [category, setCategory] = useState(link.category)
  const [pinned, setPinned] = useState(link.pinned)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload: UpdateUsefulLinkPayload = {
      title: title.trim() || null,
      description: description.trim() || null,
      note: note.trim() || null,
      category,
      pinned,
    }
    update.mutate({ id: link.id, payload }, { onSuccess: onClose })
  }

  const busy = update.isPending
  const error = update.error

  return (
    <Modal
      open
      onClose={onClose}
      title="링크 편집"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="link-edit-form" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form id="link-edit-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label>URL</Label>
            <Input type="text" value={link.url} readOnly disabled />
          </Field>

          <Field>
            <Label htmlFor="link-edit-title" optional>제목</Label>
            <Input
              id="link-edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              placeholder={link.url}
            />
          </Field>

          <Field>
            <Label htmlFor="link-edit-desc" optional>설명</Label>
            <Textarea
              id="link-edit-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </Field>

          <Field>
            <Label htmlFor="link-edit-category">카테고리</Label>
            <Select
              id="link-edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="link-edit-note" optional>메모</Label>
            <Textarea
              id="link-edit-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="이 링크를 저장한 이유를 적어두면 나중에 찾기 쉬워요."
            />
          </Field>

          <Checkbox
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            label="목록 상단에 고정"
          />

          {error && (
            <ErrorText>
              {error instanceof Error ? error.message : '저장에 실패했습니다.'}
            </ErrorText>
          )}
        </Stack>
      </form>
    </Modal>
  )
}
