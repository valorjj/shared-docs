import { useEffect, useState, type FormEvent } from 'react'
import {
  useCreateTodo,
  useTodoCategories,
  useUpdateTodo,
  type Todo,
  type TodoPayload,
} from './api'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Todo | null
}

const emptyState: TodoPayload = {
  task: '',
  due: null,
  category: '',
  note: '',
}

export default function TodoForm({ open, onClose, initial }: Props) {
  const { data: categories } = useTodoCategories()
  const create = useCreateTodo()
  const update = useUpdateTodo()

  const [form, setForm] = useState<TodoPayload>(emptyState)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        task: initial.task,
        due: initial.due,
        category: initial.category,
        note: initial.note ?? '',
      })
    } else {
      setForm({ ...emptyState, category: categories?.[0]?.name ?? '' })
    }
  }, [open, initial, categories])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

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
    <>
      <div className="tform-backdrop" onClick={onClose} />
      <div className="tform" role="dialog" aria-modal="true" aria-label={isEdit ? '할 일 수정' : '할 일 추가'}>
        <header className="tform__header">
          <h2 className="tform__title">{isEdit ? '할 일 수정' : '할 일 추가'}</h2>
          <button type="button" className="tform__close" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <form className="tform__body" onSubmit={handleSubmit}>
          <label className="tform__field">
            <span className="tform__label">할 일</span>
            <input
              type="text"
              className="tform__input"
              placeholder="예: 청소기 사기"
              value={form.task}
              onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))}
              maxLength={300}
              required
              autoFocus
            />
          </label>

          <label className="tform__field">
            <span className="tform__label">카테고리</span>
            <select
              className="tform__input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
            >
              <option value="" disabled>선택…</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.icon ? `${c.icon} ` : ''}{c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="tform__field">
            <span className="tform__label">마감일 <span className="tform__optional">(선택)</span></span>
            <input
              type="date"
              className="tform__input"
              value={form.due ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, due: e.target.value || null }))}
            />
          </label>

          <label className="tform__field">
            <span className="tform__label">메모 <span className="tform__optional">(선택)</span></span>
            <textarea
              className="tform__input tform__textarea"
              rows={3}
              value={form.note ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              maxLength={1000}
            />
          </label>

          {error && (
            <p className="tform__error">
              {error instanceof Error ? error.message : '저장에 실패했습니다.'}
            </p>
          )}

          <div className="tform__actions">
            <button type="button" className="tform__btn tform__btn--ghost" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button type="submit" className="tform__btn tform__btn--primary" disabled={busy}>
              {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
