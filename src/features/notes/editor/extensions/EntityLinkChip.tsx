import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useNavigate } from 'react-router-dom'
import { type MouseEvent as ReactMouseEvent } from 'react'
import {
  Cake,
  ChefHat,
  CircleDot,
  CreditCard,
  FileText,
  Link2,
  ListTree,
  Sheet as SheetIcon,
  SquareCheck,
  Trash2,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { useNotes, useTombstoneNote } from '../../api'
import { useSheets } from '../../../sheets/api'
import { useEntityNavigate } from '../entityNavigateContext'
import type { EntityKind } from './EntityLink'
import styles from './EntityLinkChip.module.css'

/**
 * React node view for the `entityLink` atom node. Switches on `kind`
 * for the icon and the navigation target. Title resolution:
 *
 *   - `note`  → live from `useNotes()` cache, with a tombstone fallback
 *               via `useTombstoneNote()` that ONLY marks the chip as
 *               "삭제됨" when we have positive evidence of deletion
 *               (the tombstone fetch returned a row with deletedAt set).
 *               If the caller simply doesn't have read access, the chip
 *               falls back to the stored title without strikethrough —
 *               the recipient may still click through and let the
 *               target's own page show the access error.
 *   - `sheet` → same: live from `useSheets()` cache, otherwise the
 *               stored title. No sheet-tombstone endpoint exists so we
 *               can't ever assert "deleted" with confidence; treat
 *               missing-from-cache as "not in my workspace" instead.
 *   - others  → render the stored `data-title` attr (snapshot at insert).
 *
 * Before Phase B the assumption was "if it's not in my list, it must
 * be deleted" — true for a single-user app. Phase B's per-user privacy
 * filter broke that: a perfectly alive note shared from another user
 * never lands in the recipient's `useNotes()` list, so the old logic
 * marked it as "삭제됨" incorrectly.
 */
export default function EntityLinkChip({ node }: NodeViewProps) {
  const kind = (node.attrs.kind as EntityKind | undefined) ?? 'note'
  const entityId = node.attrs.entityId as number | null
  const storedTitle = (node.attrs.title as string | null) ?? null
  const planId = (node.attrs.planId as number | null) ?? null
  const navigate = useNavigate()
  const requestEntityNav = useEntityNavigate()

  const handleClick = (e: ReactMouseEvent, id: number) => {
    e.preventDefault()
    const bypass = e.metaKey || e.ctrlKey || e.shiftKey
    if (!bypass && requestEntityNav) {
      requestEntityNav(kind, id)
      return
    }
    navigate(navTarget(kind, id, planId))
  }

  const notesQuery = useNotes()
  const sheetsQuery = useSheets()
  const activeNote =
    kind === 'note' && entityId != null
      ? notesQuery.data?.find((n) => n.id === entityId)
      : undefined
  const activeSheet =
    kind === 'sheet' && entityId != null
      ? sheetsQuery.data?.find((s) => s.id === entityId)
      : undefined
  const noteTombstoneTarget =
    kind === 'note' && entityId != null && notesQuery.data !== undefined && activeNote === undefined
      ? entityId
      : null
  const tombstone = useTombstoneNote(noteTombstoneTarget)

  if (entityId == null) {
    return (
      <NodeViewWrapper as="span" className={styles.broken} contentEditable={false} data-type="entity-link">
        <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
        깨진 링크
      </NodeViewWrapper>
    )
  }

  const Icon = iconFor(kind)

  // ── note: live cache → confirmed tombstone → unknown (static fallback) ──
  if (kind === 'note') {
    if (activeNote) {
      return (
        <NodeViewWrapper as="span" className={styles.chip} contentEditable={false} data-type="entity-link">
          <button
            type="button"
            className={styles.button}
            onClick={(e) => handleClick(e, entityId)}
            title={activeNote.title ?? '제목 없음'}
          >
            <Icon size={12} strokeWidth={2} aria-hidden="true" />
            {activeNote.title ?? '제목 없음'}
          </button>
        </NodeViewWrapper>
      )
    }
    if (notesQuery.data === undefined || tombstone.isLoading) {
      return (
        <NodeViewWrapper as="span" className={styles.loading} contentEditable={false} data-type="entity-link">
          메모 …
        </NodeViewWrapper>
      )
    }
    // Positive evidence of deletion: the tombstone endpoint returned a
    // row whose deletedAt is set. Any other outcome (403 because we
    // can't read it, 404 because it really doesn't exist any more, or
    // a non-deleted row that simply wasn't in our active list) falls
    // through to the static-title chip below.
    const confirmedDeleted = tombstone.data?.deletedAt != null
    if (confirmedDeleted) {
      const ghostTitle = tombstone.data?.title ?? storedTitle ?? `메모 #${entityId}`
      return (
        <NodeViewWrapper as="span" className={styles.tombstone} contentEditable={false} data-type="entity-link">
          <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
          <span className={styles.tombstoneTitle}>{ghostTitle}</span>
          <span className={styles.tombstoneLabel}>삭제됨</span>
        </NodeViewWrapper>
      )
    }
    const title = storedTitle ?? `메모 #${entityId}`
    return (
      <NodeViewWrapper as="span" className={styles.chip} contentEditable={false} data-type="entity-link">
        <button
          type="button"
          className={styles.button}
          onClick={(e) => handleClick(e, entityId)}
          title={title}
        >
          <Icon size={12} strokeWidth={2} aria-hidden="true" />
          {title}
        </button>
      </NodeViewWrapper>
    )
  }

  // ── sheet: live cache → static fallback (no false tombstone) ──
  if (kind === 'sheet') {
    const title = activeSheet?.title ?? storedTitle ?? `시트 #${entityId}`
    return (
      <NodeViewWrapper as="span" className={styles.chip} contentEditable={false} data-type="entity-link">
        <button
          type="button"
          className={styles.button}
          onClick={(e) => handleClick(e, entityId)}
          title={title}
        >
          <Icon size={12} strokeWidth={2} aria-hidden="true" />
          {title}
        </button>
      </NodeViewWrapper>
    )
  }

  // ── others: stored title only ──
  const title = storedTitle ?? `${kindLabel(kind)} #${entityId}`
  return (
    <NodeViewWrapper as="span" className={styles.chip} contentEditable={false} data-type="entity-link">
      <button
        type="button"
        className={styles.button}
        onClick={(e) => handleClick(e, entityId)}
        title={title}
      >
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
        {title}
      </button>
    </NodeViewWrapper>
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
