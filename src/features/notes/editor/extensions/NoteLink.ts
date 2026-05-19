import { InputRule, mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import NoteLinkChip from './NoteLinkChip'

export type NoteLinkLookupItem = {
  id: number
  title: string | null
  updatedAt: string
}

export interface NoteLinkOptions {
  /** Live source for the `[[title]]` input rule's lookup. */
  itemsRef: { current: NoteLinkLookupItem[] }
  /** Id of the note being edited — excluded so a note can't `[[link]]` to itself. */
  currentNoteIdRef: { current: number | null }
}

/**
 * Inline atom node referencing another memo by id. Renders as a pill chip
 * via a React node view that reads the target's title *live* from the
 * notes cache — rename a referenced note and every chip in every memo
 * updates on next render. The chip falls back to a tombstone style when
 * the target has been soft-deleted.
 *
 * Persisted HTML shape: `<span data-type="note-link" data-id="N">title</span>`.
 * The backend's `NoteLinkIndexer` parses this exact selector to populate the
 * `note_links` join table. The inner text is only a fallback for SSR /
 * non-rich-view contexts; the React view ignores it.
 *
 * Phase 0 of cross-entity linking: a `kind` attribute is now stored on
 * the node (default 'note'). It is *not* written to the wire format yet —
 * `data-type="note-link"` stays the canonical selector for the backend
 * indexer. Phase 1 will widen render/parse to `data-type="entity-link"`
 * + `data-kind` once the backend's indexer is generalized.
 */
export type EntityKind = 'note' // | 'sheet' | 'purchase' | 'todo' | ...
/** Bracketed input pattern. Inner text 1-80 chars, no brackets/newlines.
 *  The `]$` anchor fires the rule when the user types the second `]`. */
const BRACKET_PATTERN = /\[\[([^[\]\n]{1,80})\]\]$/

export const NoteLink = Node.create<NoteLinkOptions>({
  name: 'noteLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      itemsRef: { current: [] },
      currentNoteIdRef: { current: null },
    }
  },

  addAttributes() {
    return {
      noteId: {
        default: null as number | null,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute('data-id')
          if (!raw) return null
          const n = Number(raw)
          return Number.isFinite(n) ? n : null
        },
        renderHTML: (attrs) => {
          if (attrs.noteId == null) return {}
          return { 'data-id': String(attrs.noteId) }
        },
      },
      // Stored on the node but not yet written to the wire — see the
      // header comment. Defaulting to 'note' makes Phase 1 a one-line
      // serialization flip on this attribute.
      kind: {
        default: 'note' as EntityKind,
        parseHTML: () => 'note' as EntityKind,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="note-link"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const fallback = node.attrs.noteId != null ? `메모 #${node.attrs.noteId}` : '메모'
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'note-link' }),
      fallback,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkChip)
  },

  addInputRules() {
    const opts = this.options
    const type = this.type
    return [
      new InputRule({
        find: BRACKET_PATTERN,
        handler: ({ state, range, match }) => {
          const inner = match[1]?.trim()
          if (!inner) return null
          const currentId = opts.currentNoteIdRef.current
          const target = resolveByTitle(opts.itemsRef.current, inner, currentId)
          if (!target) return null
          const node = type.create({ noteId: target.id })
          state.tr.replaceWith(range.from, range.to, node)
        },
      }),
    ]
  },
})

function resolveByTitle(
  items: NoteLinkLookupItem[],
  query: string,
  excludeId: number | null,
): NoteLinkLookupItem | null {
  const q = query.toLowerCase()
  // Last-edited wins on ties — case-insensitive equality only (avoid
  // accidental partial-match linkification).
  const matches = items
    .filter((n) => n.id !== excludeId && (n.title ?? '').trim().toLowerCase() === q)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return matches[0] ?? null
}
