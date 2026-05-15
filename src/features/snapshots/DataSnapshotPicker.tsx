import * as Dialog from '@radix-ui/react-dialog'
import { useMemo, useState } from 'react'
import { Cake, ChevronLeft, ListTodo, ShoppingBag, ArrowLeftRight, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../components/ui'
import { currentMonthString, monthBounds } from '../../lib/format'
import { useAnniversaries } from '../anniversaries/api'
import { usePurchaseCategories, usePurchases } from '../purchases/api'
import { useSettlements } from '../purchases/settlementApi'
import { useTodoCategories, useTodos } from '../todos/api'
import {
  computeAnniversarySnapshot,
  computePurchaseTotal,
  computeSettlementSnapshot,
  computeTodoSubset,
} from './compute'
import { sourceLinkFor } from './sourceLink'
import {
  SNAPSHOT_KIND_HINTS,
  SNAPSHOT_KIND_LABELS,
  type AnniversaryFilter,
  type PurchaseTotalFilter,
  type SettlementFilter,
  type SnapshotAttrs,
  type SnapshotFrozen,
  type SnapshotKind,
  type TodoSubsetFilter,
} from './types'
import styles from './DataSnapshotPicker.module.css'

const KIND_ICONS: Record<SnapshotKind, typeof ShoppingBag> = {
  'purchase-total': ShoppingBag,
  settlement: ArrowLeftRight,
  'todo-subset': ListTodo,
  anniversary: Cake,
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (attrs: SnapshotAttrs) => void
}

/**
 * Two-step picker. Step 1: pick the snapshot kind. Step 2: pick the
 * kind-specific filter and see a live preview. Insert commits the
 * frozen payload to the editor via `onInsert`.
 */
export default function DataSnapshotPicker({ open, onOpenChange, onInsert }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          {open && <PickerBody onClose={() => onOpenChange(false)} onInsert={onInsert} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PickerBody({
  onClose,
  onInsert,
}: {
  onClose: () => void
  onInsert: (attrs: SnapshotAttrs) => void
}) {
  const [step, setStep] = useState<'kind' | 'filter'>('kind')
  const [kind, setKind] = useState<SnapshotKind>('purchase-total')

  return (
    <div className={styles.body}>
      <header className={styles.header}>
        {step === 'filter' ? (
          <button
            type="button"
            className={styles.headerBack}
            onClick={() => setStep('kind')}
            aria-label="이전"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        ) : (
          <span className={styles.headerSpacer} />
        )}
        <Dialog.Title className={styles.title}>
          {step === 'kind' ? '데이터 스냅샷' : SNAPSHOT_KIND_LABELS[kind]}
        </Dialog.Title>
        <Dialog.Close asChild>
          <button type="button" className={styles.headerClose} aria-label="닫기">
            <X size={16} strokeWidth={2} />
          </button>
        </Dialog.Close>
      </header>

      {step === 'kind' ? (
        <KindGrid
          onPick={(k) => {
            setKind(k)
            setStep('filter')
          }}
        />
      ) : (
        <FilterPanel
          kind={kind}
          onCancel={onClose}
          onInsert={(attrs) => {
            onInsert(attrs)
            onClose()
          }}
        />
      )}
    </div>
  )
}

function KindGrid({ onPick }: { onPick: (k: SnapshotKind) => void }) {
  const kinds: SnapshotKind[] = ['purchase-total', 'settlement', 'todo-subset', 'anniversary']
  return (
    <div className={styles.kindGrid}>
      {kinds.map((k) => {
        const Icon = KIND_ICONS[k]
        return (
          <button
            type="button"
            key={k}
            className={styles.kindCard}
            onClick={() => onPick(k)}
          >
            <span className={styles.kindIcon} aria-hidden="true">
              <Icon size={20} strokeWidth={1.6} />
            </span>
            <span className={styles.kindLabel}>{SNAPSHOT_KIND_LABELS[k]}</span>
            <span className={styles.kindHint}>{SNAPSHOT_KIND_HINTS[k]}</span>
          </button>
        )
      })}
    </div>
  )
}

function FilterPanel({
  kind,
  onCancel,
  onInsert,
}: {
  kind: SnapshotKind
  onCancel: () => void
  onInsert: (attrs: SnapshotAttrs) => void
}) {
  switch (kind) {
    case 'purchase-total':
      return <PurchasePanel onCancel={onCancel} onInsert={onInsert} />
    case 'settlement':
      return <SettlementPanel onCancel={onCancel} onInsert={onInsert} />
    case 'todo-subset':
      return <TodoPanel onCancel={onCancel} onInsert={onInsert} />
    case 'anniversary':
      return <AnniversaryPanel onCancel={onCancel} onInsert={onInsert} />
  }
}

// ── Purchase ──────────────────────────────────────────────────────────
function PurchasePanel({
  onCancel,
  onInsert,
}: {
  onCancel: () => void
  onInsert: (attrs: SnapshotAttrs) => void
}) {
  const [filter, setFilter] = useState<PurchaseTotalFilter>(() => ({
    month: currentMonthString(),
    category: 'ALL',
  }))
  const range = useMemo(() => monthBounds(filter.month), [filter.month])
  const purchases = usePurchases(range)
  const categories = usePurchaseCategories()
  const frozen = useMemo<SnapshotFrozen>(
    () => computePurchaseTotal(filter, purchases.data ?? []),
    [filter, purchases.data],
  )
  const ready = !purchases.isLoading

  return (
    <FormShell
      onCancel={onCancel}
      onInsert={() =>
        onInsert({
          kind: 'purchase-total',
          filter,
          frozen,
          sourceLink: sourceLinkFor('purchase-total', filter),
        })
      }
      insertDisabled={!ready}
      preview={<PreviewCard frozen={frozen} />}
    >
      <Field label="월">
        <input
          type="month"
          className={styles.input}
          value={filter.month}
          onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value || currentMonthString() }))}
        />
      </Field>
      <Field label="카테고리">
        <select
          className={styles.select}
          value={filter.category ?? 'ALL'}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="ALL">전체</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </Field>
    </FormShell>
  )
}

// ── Settlement ────────────────────────────────────────────────────────
function SettlementPanel({
  onCancel,
  onInsert,
}: {
  onCancel: () => void
  onInsert: (attrs: SnapshotAttrs) => void
}) {
  const { user } = useAuth()
  const [filter, setFilter] = useState<SettlementFilter>(() => ({ month: currentMonthString() }))
  const range = useMemo(() => monthBounds(filter.month), [filter.month])
  const purchases = usePurchases(range)
  const settlements = useSettlements(filter.month)
  const frozen = useMemo<SnapshotFrozen>(
    () => computeSettlementSnapshot(filter, purchases.data ?? [], settlements.data ?? [], user?.userId),
    [filter, purchases.data, settlements.data, user?.userId],
  )
  const ready = !purchases.isLoading && !settlements.isLoading

  return (
    <FormShell
      onCancel={onCancel}
      onInsert={() =>
        onInsert({
          kind: 'settlement',
          filter,
          frozen,
          sourceLink: sourceLinkFor('settlement', filter),
        })
      }
      insertDisabled={!ready}
      preview={<PreviewCard frozen={frozen} />}
    >
      <Field label="월">
        <input
          type="month"
          className={styles.input}
          value={filter.month}
          onChange={(e) => setFilter({ month: e.target.value || currentMonthString() })}
        />
      </Field>
    </FormShell>
  )
}

// ── Todos ─────────────────────────────────────────────────────────────
function TodoPanel({
  onCancel,
  onInsert,
}: {
  onCancel: () => void
  onInsert: (attrs: SnapshotAttrs) => void
}) {
  const [filter, setFilter] = useState<TodoSubsetFilter>({ status: 'open', category: 'ALL' })
  const todos = useTodos('all')
  const categories = useTodoCategories()
  const frozen = useMemo<SnapshotFrozen>(
    () => computeTodoSubset(filter, todos.data ?? []),
    [filter, todos.data],
  )
  const ready = !todos.isLoading

  return (
    <FormShell
      onCancel={onCancel}
      onInsert={() =>
        onInsert({
          kind: 'todo-subset',
          filter,
          frozen,
          sourceLink: sourceLinkFor('todo-subset', filter),
        })
      }
      insertDisabled={!ready}
      preview={<PreviewCard frozen={frozen} />}
    >
      <Field label="상태">
        <select
          className={styles.select}
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as TodoSubsetFilter['status'] }))}
        >
          <option value="open">남은 일</option>
          <option value="done">완료된 일</option>
          <option value="all">전체</option>
        </select>
      </Field>
      <Field label="카테고리">
        <select
          className={styles.select}
          value={filter.category ?? 'ALL'}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="ALL">전체</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </Field>
    </FormShell>
  )
}

// ── Anniversaries ─────────────────────────────────────────────────────
function AnniversaryPanel({
  onCancel,
  onInsert,
}: {
  onCancel: () => void
  onInsert: (attrs: SnapshotAttrs) => void
}) {
  const [filter, setFilter] = useState<AnniversaryFilter>({ window: 'upcoming-30' })
  const list = useAnniversaries()
  const frozen = useMemo<SnapshotFrozen>(
    () => computeAnniversarySnapshot(filter, list.data ?? []),
    [filter, list.data],
  )
  const ready = !list.isLoading

  return (
    <FormShell
      onCancel={onCancel}
      onInsert={() =>
        onInsert({
          kind: 'anniversary',
          filter,
          frozen,
          sourceLink: sourceLinkFor('anniversary', filter),
        })
      }
      insertDisabled={!ready}
      preview={<PreviewCard frozen={frozen} />}
    >
      <Field label="기간">
        <select
          className={styles.select}
          value={filter.window}
          onChange={(e) => setFilter({ window: e.target.value as AnniversaryFilter['window'] })}
        >
          <option value="upcoming-30">다가오는 30일</option>
          <option value="past-year">지난 1년</option>
          <option value="all">전체</option>
        </select>
      </Field>
    </FormShell>
  )
}

// ── Shared sub-pieces ─────────────────────────────────────────────────
function FormShell({
  children,
  preview,
  onCancel,
  onInsert,
  insertDisabled,
}: {
  children: React.ReactNode
  preview: React.ReactNode
  onCancel: () => void
  onInsert: () => void
  insertDisabled: boolean
}) {
  return (
    <div className={styles.form}>
      <div className={styles.fields}>{children}</div>
      <div className={styles.previewLabel}>미리보기</div>
      <div className={styles.previewSlot}>{preview}</div>
      <footer className={styles.formFooter}>
        <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button variant="primary" size="sm" onClick={onInsert} disabled={insertDisabled}>
          삽입
        </Button>
      </footer>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function PreviewCard({ frozen }: { frozen: SnapshotFrozen }) {
  // Use the same Bear-card geometry as the real node view, but inert
  // (no menu, no refresh footer) so the picker stays focused on the
  // filter form. Useful as a sanity-check before the user clicks 삽입.
  return (
    <div className={styles.preview}>
      <span className={styles.previewAccent} aria-hidden="true" />
      <div className={styles.previewBody}>
        <div className={styles.previewTopline}>{frozen.label}</div>
        <div className={styles.previewPrimary}>{frozen.primary}</div>
        {frozen.secondary && <div className={styles.previewSecondary}>{frozen.secondary}</div>}
      </div>
    </div>
  )
}

// Re-export so the picker can be lazy-loaded.
DataSnapshotPicker.displayName = 'DataSnapshotPicker'
