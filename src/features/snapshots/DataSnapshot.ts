import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import DataSnapshotCard from './DataSnapshotCard'

type SerializedAttrs = Record<string, unknown>

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/**
 * Tiptap block node that embeds a frozen data slice (`/data` source +
 * filter + captured payload) into a memo body. The internals are an
 * atom — Tiptap doesn't try to edit inside the card; the user can
 * delete the whole card with Backspace or via the card's kebab menu.
 *
 * On the wire (HTML) we serialize the JSON-shaped attrs as string
 * `data-*` attributes so the body round-trips through the backend's
 * LONGTEXT column without any custom encoding.
 */
export const DataSnapshot = Node.create({
  name: 'dataSnapshot',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: 'purchase-total',
        parseHTML: (el) => el.getAttribute('data-kind') ?? 'purchase-total',
        renderHTML: (attrs: SerializedAttrs) => ({ 'data-kind': String(attrs.kind ?? '') }),
      },
      filter: {
        default: {},
        parseHTML: (el) => parseJson(el.getAttribute('data-filter'), {}),
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-filter': JSON.stringify(attrs.filter ?? {}),
        }),
      },
      frozen: {
        default: { label: '', primary: '', capturedAt: '' },
        parseHTML: (el) =>
          parseJson(el.getAttribute('data-frozen'), { label: '', primary: '', capturedAt: '' }),
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-frozen': JSON.stringify(attrs.frozen ?? {}),
        }),
      },
      sourceLink: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-source-link') ?? '',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-source-link': String(attrs.sourceLink ?? ''),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="data-snapshot"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'data-snapshot' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataSnapshotCard)
  },
})
