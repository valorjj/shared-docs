import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import {
  useAnniversaryCategories,
  useCreateAnniversary,
  useUpdateAnniversary,
  type Anniversary,
  type AnniversaryPayload,
} from './api'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Anniversary | null
}

const empty: AnniversaryPayload = {
  name: '',
  date: '',
  recurring: true,
  category: '',
  gift: '',
  note: '',
}

export default function AnniversaryForm({ open, onClose, initial }: Props) {
  const { data: categories } = useAnniversaryCategories()
  const create = useCreateAnniversary()
  const update = useUpdateAnniversary()

  const [form, setForm] = useState<AnniversaryPayload>(empty)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name,
        date: initial.date,
        recurring: initial.recurring,
        category: initial.category,
        gift: initial.gift ?? '',
        note: initial.note ?? '',
      })
    } else {
      setForm({ ...empty, category: categories?.[0]?.name ?? '' })
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
    <>
      <div className="aform-backdrop" onClick={onClose} />
      <div className="aform" role="dialog" aria-modal="true">
        <header className="aform__header">
          <h2 className="aform__title">{isEdit ? '기념일 수정' : '기념일 추가'}</h2>
          <button type="button" className="aform__close" onClick={onClose} aria-label="닫기">
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <form className="aform__body" onSubmit={submit}>
          <label className="aform__field">
            <span className="aform__label">이름</span>
            <input
              type="text"
              className="aform__input"
              placeholder="예: 결혼기념일"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={120}
              required
              autoFocus
            />
          </label>

          <label className="aform__field">
            <span className="aform__label">날짜</span>
            <input
              type="date"
              className="aform__input"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>

          <label className="aform__field aform__field--inline">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
            />
            <span>매년 반복</span>
          </label>

          <label className="aform__field">
            <span className="aform__label">카테고리</span>
            <select
              className="aform__input"
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

          <label className="aform__field">
            <span className="aform__label">선물 <span className="aform__optional">(선택)</span></span>
            <input
              type="text"
              className="aform__input"
              placeholder="예: 꽃다발, 저녁 예약"
              value={form.gift ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, gift: e.target.value }))}
              maxLength={200}
            />
          </label>

          <label className="aform__field">
            <span className="aform__label">메모 <span className="aform__optional">(선택)</span></span>
            <textarea
              className="aform__input aform__textarea"
              rows={3}
              value={form.note ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              maxLength={1000}
            />
          </label>

          {error && (
            <p className="aform__error">
              {error instanceof Error ? error.message : '저장에 실패했습니다.'}
            </p>
          )}

          <div className="aform__actions">
            <button type="button" className="aform__btn aform__btn--ghost" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button type="submit" className="aform__btn aform__btn--primary" disabled={busy}>
              {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
