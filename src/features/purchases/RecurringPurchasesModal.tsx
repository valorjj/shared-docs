import { useState, type FormEvent } from 'react'
import { Trash2, Pencil, RotateCcw, Power } from 'lucide-react'
import {
  Button,
  ErrorText,
  Field,
  IconButton,
  Input,
  Label,
  Modal,
  Row,
  Select,
  Stack,
  Tabs,
} from '../../components/ui'
import { formatMoney } from '../../lib/format'
import { useAuth } from '../../auth/useAuth'
import {
  SPLIT_META,
  SPLIT_MODES,
  SUPPORTED_CURRENCIES,
  usePurchaseCategories,
  type SplitMode,
} from './api'
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurringPurchases,
  useUpdateRecurring,
  type CreateRecurringPayload,
  type RecurringPurchase,
} from './recurringApi'
import './purchases.css'

type Props = {
  open: boolean
  onClose: () => void
}

type FormState = CreateRecurringPayload & { active: boolean }

const emptyForm: FormState = {
  category: '',
  item: '',
  store: '',
  amount: 0,
  currency: 'KRW',
  note: '',
  splitMode: 'SHARED',
  dayOfMonth: 1,
  active: true,
}

export default function RecurringPurchasesModal({ open, onClose }: Props) {
  return open ? <RecurringPurchasesModalInner onClose={onClose} /> : null
}

function RecurringPurchasesModalInner({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { data: templates } = useRecurringPurchases()
  const { data: categories } = usePurchaseCategories()
  const create = useCreateRecurring()
  const update = useUpdateRecurring()
  const del = useDeleteRecurring()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm,
    category: categories?.[0]?.name ?? '',
  }))
  const [showForm, setShowForm] = useState(false)

  const busy = create.isPending || update.isPending
  const error = create.error ?? update.error

  const startNew = () => {
    setEditingId(null)
    setForm({ ...emptyForm, category: categories?.[0]?.name ?? '' })
    setShowForm(true)
  }

  const startEdit = (t: RecurringPurchase) => {
    setEditingId(t.id)
    setForm({
      category: t.category,
      item: t.item,
      store: t.store ?? '',
      amount: t.amount,
      currency: t.currency,
      note: t.note ?? '',
      splitMode: t.splitMode,
      dayOfMonth: t.dayOfMonth,
      active: t.active,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload = {
      category: form.category.trim(),
      item: form.item.trim(),
      store: form.store?.trim() || null,
      amount: form.amount,
      currency: form.currency.toUpperCase(),
      note: form.note?.trim() || null,
      splitMode: form.splitMode,
      dayOfMonth: form.dayOfMonth,
    }
    if (!payload.item || !payload.category || payload.amount < 0) return

    if (editingId != null) {
      update.mutate(
        { id: editingId, payload: { ...payload, active: form.active } },
        { onSuccess: closeForm },
      )
    } else {
      create.mutate(payload, { onSuccess: closeForm })
    }
  }

  const handleDelete = (t: RecurringPurchase) => {
    if (t.createdBy.userId !== user?.userId && !isAdmin) return
    if (!confirm(`"${t.item}" 반복 항목을 삭제할까요?`)) return
    del.mutate(t.id)
  }

  const handleToggleActive = (t: RecurringPurchase) => {
    if (t.createdBy.userId !== user?.userId && !isAdmin) return
    update.mutate({
      id: t.id,
      payload: {
        category: t.category,
        item: t.item,
        store: t.store,
        amount: t.amount,
        currency: t.currency,
        note: t.note,
        splitMode: t.splitMode,
        dayOfMonth: t.dayOfMonth,
        active: !t.active,
      },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="반복 항목 관리"
      footer={<Button variant="ghost" onClick={onClose}>닫기</Button>}
    >
      <Stack gap={3}>
        <div className="recurring__intro">
          매월 자동으로 구매 내역에 추가될 항목입니다. 매월 지정한 날짜에 한 번씩만 생성됩니다.
        </div>

        {!showForm && (
          <Button variant="primary" size="sm" onClick={startNew}>
            + 새 반복 항목
          </Button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="recurring__form">
            <Stack gap={2}>
              <Row gap={2} align="end">
                <Field className="recurring__form-grow">
                  <Label htmlFor="rec-item">항목</Label>
                  <Input
                    id="rec-item"
                    type="text"
                    placeholder="예: 월세, 넷플릭스"
                    value={form.item}
                    onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
                    required
                    autoFocus
                  />
                </Field>
                <Field className="recurring__form-day">
                  <Label htmlFor="rec-day">매월</Label>
                  <Input
                    id="rec-day"
                    type="number"
                    min="1"
                    max="28"
                    value={form.dayOfMonth}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dayOfMonth: Math.max(1, Math.min(28, Number(e.target.value) || 1)) }))
                    }
                    required
                  />
                </Field>
              </Row>

              <Field>
                <Label htmlFor="rec-category">카테고리</Label>
                <Select
                  id="rec-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  required
                >
                  <option value="" disabled>선택…</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </Select>
              </Field>

              <Row gap={2} align="end">
                <Field className="recurring__form-grow">
                  <Label htmlFor="rec-amount">금액</Label>
                  <Input
                    id="rec-amount"
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
                <Field className="recurring__form-currency">
                  <Label htmlFor="rec-currency">통화</Label>
                  <Select
                    id="rec-currency"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
              </Row>

              <Field>
                <Label>나눔</Label>
                <Tabs<SplitMode>
                  items={SPLIT_MODES.map((m) => ({
                    key: m,
                    label: `${SPLIT_META[m].emoji} ${SPLIT_META[m].label}`,
                  }))}
                  value={form.splitMode}
                  onChange={(splitMode) => setForm((f) => ({ ...f, splitMode }))}
                />
              </Field>

              <Field>
                <Label htmlFor="rec-store" optional>상점</Label>
                <Input
                  id="rec-store"
                  type="text"
                  placeholder="예: 임대인"
                  value={form.store ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
                  maxLength={100}
                />
              </Field>

              {error && (
                <ErrorText>
                  {error instanceof Error ? error.message : '저장에 실패했습니다.'}
                </ErrorText>
              )}

              <Row gap={2} justify="end">
                <Button variant="ghost" size="sm" onClick={closeForm} disabled={busy}>
                  취소
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={busy}>
                  {busy ? '저장 중…' : editingId != null ? '저장' : '추가'}
                </Button>
              </Row>
            </Stack>
          </form>
        )}

        {templates && templates.length === 0 && !showForm && (
          <p className="recurring__empty">아직 등록된 반복 항목이 없어요.</p>
        )}

        {templates && templates.length > 0 && (
          <ul className="recurring__list">
            {templates.map((t) => {
              const canManage = t.createdBy.userId === user?.userId || isAdmin
              return (
                <li
                  key={t.id}
                  className={`recurring__item${t.active ? '' : ' recurring__item--inactive'}`}
                >
                  <div className="recurring__item-body">
                    <div className="recurring__item-line">
                      <span className="recurring__item-name">{t.item}</span>
                      <span className="recurring__item-amount">
                        {formatMoney(t.amount, t.currency)}
                      </span>
                    </div>
                    <div className="recurring__item-meta">
                      <span>매월 {t.dayOfMonth}일</span>
                      <span>·</span>
                      <span>{t.category}</span>
                      <span>·</span>
                      <span title={SPLIT_META[t.splitMode].hint}>
                        {SPLIT_META[t.splitMode].emoji} {SPLIT_META[t.splitMode].label}
                      </span>
                      {!t.active && (
                        <>
                          <span>·</span>
                          <span className="recurring__item-tag">비활성</span>
                        </>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Row gap={1}>
                      <IconButton
                        label={t.active ? '비활성화' : '활성화'}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(t)}
                      >
                        {t.active
                          ? <Power size={14} strokeWidth={2} />
                          : <RotateCcw size={14} strokeWidth={2} />}
                      </IconButton>
                      <IconButton label="편집" variant="ghost" size="sm" onClick={() => startEdit(t)}>
                        <Pencil size={14} strokeWidth={2} />
                      </IconButton>
                      <IconButton label="삭제" variant="danger" size="sm" onClick={() => handleDelete(t)}>
                        <Trash2 size={14} strokeWidth={2} />
                      </IconButton>
                    </Row>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Stack>
    </Modal>
  )
}
