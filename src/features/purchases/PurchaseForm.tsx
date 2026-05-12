import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import {
  SUPPORTED_CURRENCIES,
  useCreatePurchase,
  usePurchaseCategories,
  useUpdatePurchase,
  todayString,
  type Purchase,
  type PurchasePayload,
} from './api'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Purchase | null
}

const emptyState: PurchasePayload = {
  date: todayString(),
  category: '',
  item: '',
  store: '',
  amount: 0,
  currency: 'KRW',
  note: '',
}

export default function PurchaseForm({ open, onClose, initial }: Props) {
  const { data: categories } = usePurchaseCategories()
  const create = useCreatePurchase()
  const update = useUpdatePurchase()

  const [form, setForm] = useState<PurchasePayload>(emptyState)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        date: initial.date,
        category: initial.category,
        item: initial.item,
        store: initial.store ?? '',
        amount: initial.amount,
        currency: initial.currency,
        note: initial.note ?? '',
      })
    } else {
      setForm({
        ...emptyState,
        category: categories?.[0]?.name ?? '',
      })
    }
  }, [open, initial, categories])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
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
    const payload: PurchasePayload = {
      ...form,
      item: form.item.trim(),
      store: form.store?.trim() || null,
      note: form.note?.trim() || null,
      currency: form.currency.toUpperCase(),
    }
    if (!payload.category || !payload.item) return

    if (isEdit && initial) {
      update.mutate(
        { id: initial.id, payload },
        { onSuccess: onClose },
      )
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <>
      <div className="pform-backdrop" onClick={onClose} />
      <div className="pform" role="dialog" aria-modal="true" aria-label={isEdit ? '구매 수정' : '구매 추가'}>
        <header className="pform__header">
          <h2 className="pform__title">{isEdit ? '구매 수정' : '구매 추가'}</h2>
          <button type="button" className="pform__close" onClick={onClose} aria-label="닫기">
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <form className="pform__body" onSubmit={handleSubmit}>
          <label className="pform__field">
            <span className="pform__label">날짜</span>
            <input
              type="date"
              className="pform__input"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>

          <label className="pform__field">
            <span className="pform__label">카테고리</span>
            <select
              className="pform__input"
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

          <label className="pform__field">
            <span className="pform__label">항목</span>
            <input
              type="text"
              className="pform__input"
              placeholder="예: 장보기"
              value={form.item}
              onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              maxLength={200}
              required
            />
          </label>

          <label className="pform__field">
            <span className="pform__label">상점 <span className="pform__optional">(선택)</span></span>
            <input
              type="text"
              className="pform__input"
              placeholder="예: 이마트"
              value={form.store ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
              maxLength={100}
            />
          </label>

          <div className="pform__field pform__field--row">
            <label className="pform__amount">
              <span className="pform__label">금액</span>
              <input
                type="number"
                className="pform__input"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                required
              />
            </label>
            <label className="pform__currency">
              <span className="pform__label">통화</span>
              <select
                className="pform__input"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="pform__field">
            <span className="pform__label">메모 <span className="pform__optional">(선택)</span></span>
            <textarea
              className="pform__input pform__textarea"
              rows={3}
              value={form.note ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              maxLength={1000}
            />
          </label>

          {error && (
            <p className="pform__error">
              {error instanceof Error ? error.message : '저장에 실패했습니다.'}
            </p>
          )}

          <div className="pform__actions">
            <button type="button" className="pform__btn pform__btn--ghost" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button type="submit" className="pform__btn pform__btn--primary" disabled={busy}>
              {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
