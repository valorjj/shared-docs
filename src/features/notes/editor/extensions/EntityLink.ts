import { InputRule, mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import EntityLinkChip from './EntityLinkChip'

/** Indexable entity kinds. Mirrors `EntityKind` on the backend. Calendar
 *  is deliberately absent — calendar deep-links are plain anchors, not
 *  entity-link chips, because calendar events have no stable identity. */
export type EntityKind =
  | 'note'
  | 'sheet'
  | 'purchase'
  | 'todo'
  | 'anniversary'
  | 'recipe'
  | 'link'

export const ENTITY_KINDS: readonly EntityKind[] = [
  'note', 'sheet', 'purchase', 'todo', 'anniversary', 'recipe', 'link',
] as const

export type NoteLinkLookupItem = {
  id: number
  title: string | null
  updatedAt: string
}

export interface EntityLinkOptions {
  /** Live source for the `[[title]]` input rule's lookup. Note-only;
   *  bracket shorthand exists for memos because that's the original
   *  Bear pattern, but other kinds always go through `@`.
   *  Default `null` — see SlashCommand for the mergeDeep caveat. */
  itemsRef: { current: NoteLinkLookupItem[] } | null
  /** Id of the note being edited — excluded so a note can't `[[link]]` to itself. */
  currentNoteIdRef: { current: number | null } | null
}

/**
 * Inline atom node referencing any indexable entity (note / sheet /
 * purchase / todo / anniversary / recipe / link) by id. Renders as a
 * pill chip via a React node view that reads the target's title *live*
 * from the matching list cache. Falls back to a tombstone style when
 * the target has been deleted.
 *
 * Wire format:
 *   <span data-type="entity-link" data-kind="note" data-id="42"></span>
 *
 * Backward-compat: legacy memos serialized with the older `data-type=
 * "note-link"` selector are still parsed (kind defaulted to 'note'),
 * and the backend's `EntityRefIndexer` reads both selectors. On the
 * next save, the body re-serializes into the new format.
 */
const BRACKET_PATTERN = /\[\[([^[\]\n]{1,80})\]\]$/

export const EntityLink = Node.create<EntityLinkOptions>({
  name: 'entityLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      itemsRef: null,
      currentNoteIdRef: null,
    }
  },

  addAttributes() {
    return {
      kind: {
        default: 'note' as EntityKind,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute('data-kind')?.trim()?.toLowerCase()
          if (raw && (ENTITY_KINDS as readonly string[]).includes(raw)) {
            return raw as EntityKind
          }
          // Legacy span[data-type="note-link"] has no data-kind — treat as note.
          return 'note' as EntityKind
        },
        renderHTML: (attrs) => ({ 'data-kind': String(attrs.kind ?? 'note') }),
      },
      entityId: {
        default: null as number | null,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute('data-id')
          if (!raw) return null
          const n = Number(raw)
          return Number.isFinite(n) ? n : null
        },
        renderHTML: (attrs) => {
          if (attrs.entityId == null) return {}
          return { 'data-id': String(attrs.entityId) }
        },
      },
      // Stored title — used as a static fallback for kinds without a
      // list-query cache (purchase/todo/anniversary/recipe/link).
      // For note/sheet the chip prefers the live cached title and falls
      // back to this only if the target was deleted.
      title: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-title'),
        renderHTML: (attrs) =>
          attrs.title == null ? {} : { 'data-title': String(attrs.title) },
      },
    }
  },

  parseHTML() {
    return [
      // New canonical selector.
      { tag: 'span[data-type="entity-link"]' },
      // Legacy — pre-Phase 1 memos serialize as note-link.
      { tag: 'span[data-type="note-link"]' },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const kind = (node.attrs.kind as EntityKind | undefined) ?? 'note'
    const id = node.attrs.entityId as number | null
    const fallback = id != null ? `${kindLabel(kind)} #${id}` : kindLabel(kind)
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'entity-link' }),
      fallback,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntityLinkChip)
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
          const items = opts.itemsRef?.current
          if (!items) return null
          const currentId = opts.currentNoteIdRef?.current ?? null
          const target = resolveByTitle(items, inner, currentId)
          if (!target) return null
          const node = type.create({ kind: 'note', entityId: target.id })
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
  const matches = items
    .filter((n) => n.id !== excludeId && (n.title ?? '').trim().toLowerCase() === q)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return matches[0] ?? null
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
