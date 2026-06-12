import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowRight,
  Cake,
  ChefHat,
  CircleDot,
  CreditCard,
  FileText,
  Link2,
  ListTree,
  Sheet as SheetIcon,
  SquareCheck,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { apiClient } from '../../../api/client'
import { Button } from '../../../components/ui'
import type { EntityKind } from './extensions/EntityLink'
import styles from './EntityNavigateDialog.module.css'

type EntityPreview = {
  kind: EntityKind
  id: number
  title: string
  hint?: string | null
  snippet?: string | null
  planId?: number | null
}

type Props = {
  open: boolean
  kind: EntityKind | null
  id: number | null
  onClose: () => void
}

/**
 * Click-confirm dialog for entity-link chips. Mirrors `LinkNavigateDialog`'s
 * shape (Bear-minimal, hairline borders, no shadow on the body card) but
 * fetches a per-entity preview from `/api/search/entities/{kind}/{id}`
 * so the user sees what they're about to open — title, hint, snippet —
 * before committing. Cmd/Ctrl-click on the chip skips this dialog and
 * navigates directly (handled in `EntityLinkChip`).
 */
export default function EntityNavigateDialog({ open, kind, id, onClose }: Props) {
  return open && kind != null && id != null ? (
    <EntityNavigateDialogInner kind={kind} id={id} onClose={onClose} />
  ) : null
}

function EntityNavigateDialogInner({
  kind,
  id,
  onClose,
}: {
  kind: EntityKind
  id: number
  onClose: () => void
}) {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['entity-preview', kind, id],
    queryFn: async () => {
      const { data } = await apiClient.get<EntityPreview>(
        `/api/search/entities/${kind}/${id}`,
      )
      return data
    },
    staleTime: 30 * 1000,
    retry: false,
  })

  const open_ = () => {
    navigate(navTarget(kind, id, data?.planId ?? null))
    onClose()
  }

  const Icon = iconFor(kind)

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby="entity-nav-desc">
          <Dialog.Title className={styles.title}>이 항목을 열까요?</Dialog.Title>
          <div id="entity-nav-desc" className={styles.body}>
            <div className={styles.header}>
              <span className={styles.iconWrap} aria-hidden="true">
                <Icon size={14} strokeWidth={1.75} />
              </span>
              <span className={styles.kindLabel}>{kindLabel(kind)}</span>
              {data?.hint && <span className={styles.hint}>{data.hint}</span>}
            </div>
            <div className={styles.heading}>
              {isLoading
                ? '불러오는 중…'
                : isError
                  ? '미리보기를 불러오지 못했어요'
                  : (data?.title ?? '제목 없음')}
            </div>
            {data?.snippet && <div className={styles.snippet}>{data.snippet}</div>}
          </div>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <Button variant="ghost">취소</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              onClick={open_}
              disabled={isLoading && (kind === 'subplan' || kind === 'option')}
              leading={<ArrowRight size={14} strokeWidth={2} />}
            >
              열기
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function iconFor(kind: EntityKind): LucideIcon {
  switch (kind) {
    case 'note': return FileText
    case 'sheet': return SheetIcon
    case 'purchase': return CreditCard
    case 'todo': return SquareCheck
    case 'anniversary': return Cake
    case 'recipe': return ChefHat
    case 'link': return Link2
    case 'plan': return Vote
    case 'subplan': return ListTree
    case 'option': return CircleDot
  }
}

function kindLabel(kind: EntityKind): string {
  switch (kind) {
    case 'note': return '메모'
    case 'sheet': return '시트'
    case 'purchase': return '구매'
    case 'todo': return '할 일'
    case 'anniversary': return '기념일'
    case 'recipe': return '레시피'
    case 'link': return '링크'
    case 'plan': return '계획'
    case 'subplan': return '안건'
    case 'option': return '선택지'
  }
}

function navTarget(kind: EntityKind, id: number, planId: number | null): string {
  switch (kind) {
    case 'note': return `/?note=${id}`
    case 'sheet': return `/sheets?sheet=${id}`
    case 'purchase': return `/data/purchases?row=${id}`
    case 'todo': return `/data/todos?id=${id}`
    case 'anniversary': return `/data/anniversaries?id=${id}`
    case 'recipe': return `/data/recipes/${id}`
    case 'link': return `/data/links?id=${id}`
    case 'plan': return `/decisions/${id}`
    case 'subplan': return planId != null ? `/decisions/${planId}?subplan=${id}` : '/decisions'
    case 'option': return planId != null ? `/decisions/${planId}?option=${id}` : '/decisions'
  }
}
