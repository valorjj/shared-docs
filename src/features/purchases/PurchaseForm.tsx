import { useState, type FormEvent } from 'react'
import {
  Button,
  ErrorText,
  Field,
  Input,
  Label,
  Modal,
  Row,
  Select,
  Stack,
  Tabs,
  Textarea,
} from '../../components/ui'
import {
  SPLIT_META,
  SPLIT_MODES,
  SUPPORTED_CURRENCIES,
  useCreatePurchase,
  usePurchaseCategories,
  useUpdatePurchase,
  todayString,
  type Purchase,
  type PurchaseCategory,
  type PurchasePayload,
  type SplitMode,
} from './api'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Purchase | null
  initialDate?: string
}

export default function PurchaseForm({ open, onClose, initial, initialDate }: Props) {
  return (
    <PurchaseFormInner
      key={open ? (initial?.id ?? `new-${initialDate ?? ''}`) : 'closed'}
      open={open}
      onClose={onClose}
      initial={initial ?? null}
      initialDate={initialDate}
    />
  )
}

function PurchaseFormInner({
  open,
  onClose,
  initial,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  initial: Purchase | null
  initialDate?: string
}) {
  const { data: categories } = usePurchaseCategories()
  const create = useCreatePurchase()
  const update = useUpdatePurchase()

  const [form, setForm] = useState<PurchasePayload>(() =>
    makeInitialForm(initial, categories, initialDate),
  )

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
      update.mutate({ id: initial.id, payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '구매 수정' : '구매 추가'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" type="submit" form="purchase-form" disabled={busy}>
            {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
          </Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={handleSubmit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="pform-date">날짜</Label>
            <Input
              id="pform-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </Field>

          <Field>
            <Label htmlFor="pform-category">카테고리</Label>
            <Select
              id="pform-category"
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
            <Label htmlFor="pform-item">항목</Label>
            <Input
              id="pform-item"
              type="text"
              placeholder="예: 장보기"
              value={form.item}
              onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              maxLength={200}
              required
              autoFocus
            />
          </Field>

          <Field>
            <Label htmlFor="pform-store" optional>
              상점
            </Label>
            <Input
              id="pform-store"
              type="text"
              placeholder="예: 이마트"
              value={form.store ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
              maxLength={100}
            />
          </Field>

          <Field>
            <Label>나눔</Label>
            <Tabs<SplitMode>
              items={SPLIT_MODES.map((m) => {
                const { Icon, label } = SPLIT_META[m]
                return {
                  key: m,
                  label: (
                    <span className="purchase__split-tab">
                      <Icon size={14} strokeWidth={2} aria-hidden="true" />
                      <span>{label}</span>
                    </span>
                  ),
                }
              })}
              value={form.splitMode}
              onChange={(splitMode) => setForm((f) => ({ ...f, splitMode }))}
            />
          </Field>

          <Row gap={2} align="end">
            <Field className="pform__amount-field">
              <Label htmlFor="pform-amount">금액</Label>
              <Input
                id="pform-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                align="right"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                required
              />
            </Field>
            <Field className="pform__currency-field">
              <Label htmlFor="pform-currency">통화</Label>
              <Select
                id="pform-currency"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </Row>

          <Field>
            <Label htmlFor="pform-note" optional>
              메모
            </Label>
            <Textarea
              id="pform-note"
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
  initial: Purchase | null,
  categories: PurchaseCategory[] | undefined,
  initialDate?: string,
): PurchasePayload {
  if (initial) {
    return {
      date: initial.date,
      category: initial.category,
      item: initial.item,
      store: initial.store ?? '',
      amount: initial.amount,
      currency: initial.currency,
      note: initial.note ?? '',
      splitMode: initial.splitMode,
    }
  }
  return {
    date: initialDate ?? todayString(),
    category: categories?.[0]?.name ?? '',
    item: '',
    store: '',
    amount: 0,
    currency: 'KRW',
    note: '',
    splitMode: 'SHARED',
  }
}
