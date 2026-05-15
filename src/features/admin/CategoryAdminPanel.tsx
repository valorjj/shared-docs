import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Label,
  Skeleton,
  Stack,
} from '../../components/ui'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import {
  CATEGORY_KIND_LABELS,
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryKind,
  type CategoryRow,
} from '../../api/categoryAdmin'
import styles from './CategoryAdminPanel.module.css'

type Props = { kind: CategoryKind }

export default function CategoryAdminPanel({ kind }: Props) {
  const { data, isLoading, isError, refetch } = useAdminCategories(kind)
  const create = useCreateCategory(kind)
  const update = useUpdateCategory(kind)
  const del = useDeleteCategory(kind)

  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState<CategoryRow | null>(null)

  const sorted = data ? [...data].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id) : []

  const moveOrder = (row: CategoryRow, direction: -1 | 1) => {
    const idx = sorted.findIndex((r) => r.id === row.id)
    const swap = sorted[idx + direction]
    if (!swap) return
    // Swap the two rows' sortOrder values. PATCH /admin/<kind>-categories/:id
    // takes the full payload (name is required), so spread the rest as-is.
    update.mutate({
      id: row.id,
      payload: { name: row.name, color: row.color, icon: row.icon, sortOrder: swap.sortOrder, active: row.active },
    })
    update.mutate({
      id: swap.id,
      payload: { name: swap.name, color: swap.color, icon: swap.icon, sortOrder: row.sortOrder, active: swap.active },
    })
  }

  const toggleActive = (row: CategoryRow) => {
    update.mutate({
      id: row.id,
      payload: { name: row.name, color: row.color, icon: row.icon, sortOrder: row.sortOrder, active: !row.active },
    })
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{CATEGORY_KIND_LABELS[kind]} 카테고리</h2>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          카테고리 추가
        </Button>
      </header>

      {isLoading && (
        <ul className={styles.list} aria-busy="true" aria-label="카테고리 불러오는 중">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className={styles.skeletonRow}>
              <Skeleton width={56} height={14} />
              <Skeleton width={16} height={16} radius="pill" />
              <Skeleton width="55%" height={14} />
              <Skeleton width={88} height={12} />
              <Skeleton width={48} height={12} />
            </li>
          ))}
        </ul>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState variant="inline" title="등록된 카테고리가 없어요" />
      )}

      {sorted.length > 0 && (
        <ul className={styles.list}>
          {sorted.map((row, idx) => (
            <CategoryRowItem
              key={row.id}
              row={row}
              isFirst={idx === 0}
              isLast={idx === sorted.length - 1}
              onMoveUp={() => moveOrder(row, -1)}
              onMoveDown={() => moveOrder(row, 1)}
              onToggleActive={() => toggleActive(row)}
              onCommit={(payload) => update.mutate({ id: row.id, payload })}
              onDelete={() => setDeleting(row)}
            />
          ))}
        </ul>
      )}

      {addOpen && (
        <AddRow
          existingNames={new Set((data ?? []).map((r) => r.name))}
          nextOrder={Math.max(0, ...sorted.map((r) => r.sortOrder)) + 1}
          onCancel={() => setAddOpen(false)}
          onSubmit={(payload) => {
            create.mutate(payload, { onSuccess: () => setAddOpen(false) })
          }}
          busy={create.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `"${deleting.name}" 카테고리를 삭제할까요?` : ''}
        description="이 카테고리를 쓰던 항목은 그대로 남지만, 카테고리 이름은 데이터에 박혀 있게 됩니다. 이름을 바꾸려면 삭제 대신 편집을 사용하세요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={() => {
          if (!deleting) return
          del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </section>
  )
}

function CategoryRowItem({
  row,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onCommit,
  onDelete,
}: {
  row: CategoryRow
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleActive: () => void
  onCommit: (payload: { name: string; color: string | null; icon: string | null; sortOrder: number; active: boolean }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(row.name)
  const [color, setColor] = useState(row.color ?? '')

  const isDirty = name.trim() !== row.name || (color || null) !== (row.color || null)

  const commit = () => {
    if (!isDirty) return
    const trimmed = name.trim()
    if (!trimmed) {
      setName(row.name)
      return
    }
    onCommit({
      name: trimmed,
      color: color.trim() || null,
      icon: row.icon,
      sortOrder: row.sortOrder,
      active: row.active,
    })
  }

  return (
    <li className={`${styles.row}${row.active ? '' : ` ${styles.inactive}`}`}>
      <div className={styles.orderColumn}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="위로"
          title="위로"
        >
          <ChevronUp size={14} strokeWidth={2} aria-hidden="true" />
        </button>
        <span className={styles.orderValue}>{row.sortOrder}</span>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="아래로"
          title="아래로"
        >
          <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <span className={styles.swatch} style={{ background: color || 'transparent' }} aria-hidden="true" />

      <input
        className={styles.nameInput}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.currentTarget as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') {
            setName(row.name)
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
        maxLength={64}
      />

      <input
        className={styles.colorInput}
        type="text"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={commit}
        placeholder="#hex"
        aria-label="색상 hex"
        maxLength={16}
      />

      <label className={styles.activeToggle}>
        <input
          type="checkbox"
          checked={row.active}
          onChange={onToggleActive}
        />
        <span>{row.active ? '활성' : '비활성'}</span>
      </label>

      <button
        type="button"
        className={`${styles.iconBtn} ${styles.deleteBtn}`}
        onClick={onDelete}
        aria-label="삭제"
        title="삭제"
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  )
}

function AddRow({
  existingNames,
  nextOrder,
  busy,
  onSubmit,
  onCancel,
}: {
  existingNames: Set<string>
  nextOrder: number
  busy: boolean
  onSubmit: (p: { name: string; color: string | null; sortOrder: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setErr('이름을 입력해 주세요.')
    if (existingNames.has(trimmed)) return setErr('같은 이름의 카테고리가 이미 있어요.')
    onSubmit({ name: trimmed, color: color.trim() || null, sortOrder: nextOrder })
  }

  return (
    <form className={styles.addForm} onSubmit={submit}>
      <Stack gap={2}>
        <div className={styles.addRow}>
          <Field>
            <Label htmlFor="cat-add-name">이름</Label>
            <Input
              id="cat-add-name"
              type="text"
              placeholder="예: 카페"
              value={name}
              onChange={(e) => { setName(e.target.value); setErr(null) }}
              autoFocus
              maxLength={64}
              required
            />
          </Field>
          <Field>
            <Label htmlFor="cat-add-color" optional>색상 hex</Label>
            <Input
              id="cat-add-color"
              type="text"
              placeholder="#3d7e4f"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              maxLength={16}
            />
          </Field>
        </div>
        {err && <p className={styles.error}>{err}</p>}
        <div className={styles.addActions}>
          <Button variant="ghost" type="button" onClick={onCancel} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? '추가 중…' : '추가'}
          </Button>
        </div>
      </Stack>
    </form>
  )
}
