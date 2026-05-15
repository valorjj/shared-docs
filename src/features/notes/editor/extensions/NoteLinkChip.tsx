import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trash2 } from 'lucide-react'
import { useNotes, useTombstoneNote } from '../../api'
import styles from './NoteLinkChip.module.css'

/**
 * Inline pill that resolves a `noteLink` atom node into a live title
 * read from the `useNotes()` cache. If the id isn't in the active list
 * (because the target has been soft-deleted), falls back to a lazy
 * `?includeDeleted=true` fetch and renders a tombstone pill instead.
 */
export default function NoteLinkChip({ node }: NodeViewProps) {
  const noteId = node.attrs.noteId as number | null
  const navigate = useNavigate()
  const { data: notes } = useNotes()
  const active = noteId != null ? notes?.find((n) => n.id === noteId) : undefined
  const shouldHydrateTombstone =
    noteId != null && notes !== undefined && active === undefined
  const tombstone = useTombstoneNote(shouldHydrateTombstone ? noteId : null)

  if (noteId == null) {
    return (
      <NodeViewWrapper as="span" className={styles.broken} contentEditable={false}>
        <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
        깨진 링크
      </NodeViewWrapper>
    )
  }

  // Active note found in the list cache.
  if (active) {
    return (
      <NodeViewWrapper as="span" className={styles.chip} contentEditable={false}>
        <button
          type="button"
          className={styles.button}
          onClick={(e) => {
            e.preventDefault()
            navigate(`/?note=${noteId}`)
          }}
          title={active.title ?? '제목 없음'}
        >
          <FileText size={12} strokeWidth={2} aria-hidden="true" />
          {active.title ?? '제목 없음'}
        </button>
      </NodeViewWrapper>
    )
  }

  // Notes list still loading — render a quiet placeholder so the chip
  // doesn't jump from a tombstone to a normal pill on first paint.
  if (notes === undefined) {
    return (
      <NodeViewWrapper as="span" className={styles.loading} contentEditable={false}>
        메모 …
      </NodeViewWrapper>
    )
  }

  // List loaded, id missing — fall through to the tombstone branch.
  if (tombstone.isLoading) {
    return (
      <NodeViewWrapper as="span" className={styles.loading} contentEditable={false}>
        메모 …
      </NodeViewWrapper>
    )
  }

  const ghost = tombstone.data
  const ghostTitle = ghost?.title ?? `메모 #${noteId}`
  return (
    <NodeViewWrapper as="span" className={styles.tombstone} contentEditable={false}>
      <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
      <span className={styles.tombstoneTitle}>{ghostTitle}</span>
      <span className={styles.tombstoneLabel}>삭제됨</span>
    </NodeViewWrapper>
  )
}
