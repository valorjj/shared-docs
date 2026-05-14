import { useState, type FormEvent } from 'react'
import {
  Button,
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
  useCreateTodo,
  useTodoCategories,
  useUpdateTodo,
  type Todo,
  type TodoCategory,
  type TodoPayload,
} from './api'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Todo | null
  initialDate?: string
}

export default function TodoForm({ open, onClose, initial, initialDate }: Props) {
  return (
    <TodoFormInner
      key={open ? (initial?.id ?? `new-${initialDate ?? ''}`) : 'closed'}
      open={open}
      onClose={onClose}
      initial={initial ?? null}
      initialDate={initialDate}
    />
  )
}

function TodoFormInner({
  open,
  onClose,
  initial,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  initial: Todo | null
  initialDate?: string
}) {
  const { data: categories } = useTodoCategories()
  const create = useCreateTodo()
  const update = useUpdateTodo()

  const [form, setForm] = useState<TodoPayload>(() =>
    makeInitialForm(initial, categories, initialDate),
  )

  const isEdit = !!initial
  const busy = create.isPending || update.isPending
  const error = create.error ?? update.error

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload: TodoPayload = {
      task: form.task.trim(),
      due: form.due || null,
      category: form.category.trim(),
      note: form.note?.trim() || null,
    }
    if (!payload.task || !payload.category) return

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
      title={isEdit ? '할 일 수정' : '할 일 추가'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" type="submit" form="todo-form" disabled={busy}>
            {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
          </Button>
        </>
      }
    >
      <form id="todo-form" onSubmit={handleSubmit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="tform-task">할 일</Label>
            <Input
              id="tform-task"
              type="text"
              placeholder="예: 청소기 사기"
              value={form.task}
              onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))}
              maxLength={300}
              required
              autoFocus
            />
          </Field>

          <Field>
            <Label htmlFor="tform-category">카테고리</Label>
            <Select
              id="tform-category"
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
            <Label htmlFor="tform-due" optional>마감일</Label>
            <Input
              id="tform-due"
              type="date"
              value={form.due ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, due: e.target.value || null }))}
            />
          </Field>

          <Field>
            <Label htmlFor="tform-note" optional>메모</Label>
            <Textarea
              id="tform-note"
              rows={3}
              value={form.note ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              maxLength={1000}
            />
          </Field>

          {error && (
            <ErrorText>{error instanceof Error ? error.message : '저장에 실패했습니다.'}</ErrorText>
          )}
        </Stack>
      </form>
    </Modal>
  )
}

function makeInitialForm(
  initial: Todo | null,
  categories: TodoCategory[] | undefined,
  initialDate?: string,
): TodoPayload {
  if (initial) {
    return {
      task: initial.task,
      due: initial.due,
      category: initial.category,
      note: initial.note ?? '',
    }
  }
  return {
    task: '',
    due: initialDate ?? null,
    category: categories?.[0]?.name ?? '',
    note: '',
  }
}
