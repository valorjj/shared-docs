import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useNavigate } from 'react-router-dom'
import {
  Cake,
  ChefHat,
  CreditCard,
  FileText,
  Link2,
  Sheet as SheetIcon,
  SquareCheck,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useNotes, useTombstoneNote } from '../../api'
import { useSheets } from '../../../sheets/api'
import type { EntityKind } from './EntityLink'
import styles from './EntityLinkChip.module.css'

/**
 * React node view for the `entityLink` atom node. Switches on `kind`
 * for the icon and the navigation target. Title resolution:
 *
 *   - `note`  → live from `useNotes()` cache, tombstone fallback via
 *               `useTombstoneNote()` (the same path the old note-only
 *               chip used).
 *   - `sheet` → live from `useSheets()` cache.
 *   - others  → render the stored `data-title` attr (snapshot at insert).
 *               Renames in the source feature won't auto-propagate, but
 *               adding live lookups would need per-feature detail
 *               endpoints we don't have yet.
 */
export default function EntityLinkChip({ node }: NodeViewProps) {
  const kind = (node.attrs.kind as EntityKind | undefined) ?? 'note'
  const entityId = node.attrs.entityId as number | null
  const storedTitle = (node.attrs.title as string | null) ?? null
  const navigate = useNavigate()

  // ── live caches for the two kinds that have list-query coverage ──
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

  // ── note: live cache → tombstone → loading ──
  if (kind === 'note') {
    if (activeNote) {
      return (
        <NodeViewWrapper as="span" className={styles.chip} contentEditable={false} data-type="entity-link">
          <button
            type="button"
            className={styles.button}
            onClick={(e) => {
              e.preventDefault()
              navigate(`/?note=${entityId}`)
            }}
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
    const ghostTitle = tombstone.data?.title ?? storedTitle ?? `메모 #${entityId}`
    return (
      <NodeViewWrapper as="span" className={styles.tombstone} contentEditable={false} data-type="entity-link">
        <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
        <span className={styles.tombstoneTitle}>{ghostTitle}</span>
        <span className={styles.tombstoneLabel}>삭제됨</span>
      </NodeViewWrapper>
    )
  }

  // ── sheet: live cache → static fallback ──
  if (kind === 'sheet') {
    const title = activeSheet?.title ?? storedTitle ?? `시트 #${entityId}`
    const navHref = navTarget(kind, entityId)
    const deleted = sheetsQuery.data !== undefined && activeSheet === undefined
    if (deleted) {
      return (
        <NodeViewWrapper as="span" className={styles.tombstone} contentEditable={false} data-type="entity-link">
          <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
          <span className={styles.tombstoneTitle}>{title}</span>
          <span className={styles.tombstoneLabel}>삭제됨</span>
        </NodeViewWrapper>
      )
    }
    return (
      <NodeViewWrapper as="span" className={styles.chip} contentEditable={false} data-type="entity-link">
        <button
          type="button"
          className={styles.button}
          onClick={(e) => {
            e.preventDefault()
            navigate(navHref)
          }}
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
        onClick={(e) => {
          e.preventDefault()
          navigate(navTarget(kind, entityId))
        }}
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
  }
}

function navTarget(kind: EntityKind, id: number): string {
  switch (kind) {
    case 'note': return `/?note=${id}`
    case 'sheet': return `/sheets?sheet=${id}`
    case 'purchase': return `/data/purchases?row=${id}`
    case 'todo': return `/data/todos?id=${id}`
    case 'anniversary': return `/data/anniversaries?id=${id}`
    case 'recipe': return `/data/recipes/${id}`
    case 'link': return `/data/links?id=${id}`
  }
}
