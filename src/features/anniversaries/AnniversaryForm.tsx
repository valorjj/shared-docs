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
  useAnniversaryCategories,
  useCreateAnniversary,
  useUpdateAnniversary,
  type Anniversary,
  type AnniversaryCategory,
  type AnniversaryPayload,
} from './api'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Anniversary | null
  initialDate?: string
}

export default function AnniversaryForm({ open, onClose, initial, initialDate }: Props) {
  return (
    <AnniversaryFormInner
      key={open ? (initial?.id ?? `new-${initialDate ?? ''}`) : 'closed'}
      open={open}
      onClose={onClose}
      initial={initial ?? null}
      initialDate={initialDate}
    />
  )
}

function AnniversaryFormInner({
  open,
  onClose,
  initial,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  initial: Anniversary | null
  initialDate?: string
}) {
  const { data: categories } = useAnniversaryCategories()
  const create = useCreateAnniversary()
  const update = useUpdateAnniversary()

  const [form, setForm] = useState<AnniversaryPayload>(() =>
    makeInitialForm(initial, categories, initialDate),
  )

  const isEdit = !!initial
  const busy = create.isPending || update.isPending
  const error = create.error ?? update.error

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload: AnniversaryPayload = {
      name: form.name.trim(),
      date: form.date,
      recurring: form.recurring,
      category: form.category.trim(),
      gift: form.gift?.trim() || null,
      note: form.note?.trim() || null,
    }
    if (!payload.name || !payload.date || !payload.category) return

    if (isEdit && initial) {
      update.mutate({ id: initial.id, payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '기념일 수정' : '기념일 추가'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" type="submit" form="anniv-form" disabled={busy}>
            {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
          </Button>
        </>
      }
    >
      <form id="anniv-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="aform-name">이름</Label>
            <Input
              id="aform-name"
              type="text"
              placeholder="예: 결혼기념일"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={120}
              required
              autoFocus
            />
          </Field>

          <Field>
            <Label htmlFor="aform-date">날짜</Label>
            <Input
              id="aform-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </Field>

          <Checkbox
            checked={form.recurring}
            onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
            label="매년 반복"
          />

          <Field>
            <Label htmlFor="aform-category">카테고리</Label>
            <Select
              id="aform-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
            >
              <option value="" disabled>
                선택…
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="aform-gift" optional>선물</Label>
            <Input
              id="aform-gift"
              type="text"
              placeholder="예: 꽃다발, 저녁 예약"
              value={form.gift ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, gift: e.target.value }))}
              maxLength={200}
            />
          </Field>

          <Field>
            <Label htmlFor="aform-note" optional>메모</Label>
            <Textarea
              id="aform-note"
              rows={3}
              value={form.note ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              maxLength={1000}
            />
          </Field>

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

function makeInitialForm(
  initial: Anniversary | null,
  categories: AnniversaryCategory[] | undefined,
  initialDate?: string,
): AnniversaryPayload {
  if (initial) {
    return {
      name: initial.name,
      date: initial.date,
      recurring: initial.recurring,
      category: initial.category,
      gift: initial.gift ?? '',
      note: initial.note ?? '',
    }
  }
  return {
    name: '',
    date: initialDate ?? '',
    recurring: true,
    category: categories?.[0]?.name ?? '',
    gift: '',
    note: '',
  }
}
