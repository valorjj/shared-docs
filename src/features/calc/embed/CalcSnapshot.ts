import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CalcSnapshotCard from './CalcSnapshotCard'

type SerializedAttrs = Record<string, unknown>

/**
 * Tiptap block node embedding a frozen calculator-tape entry. Mirrors
 * the `DataSnapshot` atom 1:1 — same atom pattern, same `data-*` JSON
 * round-trip, same kebab-menu refresh. The frozen `input` and `result`
 * are stored as JSON strings so the body round-trips through the
 * backend's LONGTEXT column unchanged.
 *
 * If the source CalcEntry is later deleted, the card keeps showing
 * its frozen values; refresh switches to a tombstone state.
 */
export const CalcSnapshot = Node.create({
  name: 'calcSnapshot',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      entryId: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-entry-id') ?? '0'),
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-entry-id': String(attrs.entryId ?? 0),
        }),
      },
      mode: {
        default: 'BASIC',
        parseHTML: (el) => el.getAttribute('data-mode') ?? 'BASIC',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-mode': String(attrs.mode ?? 'BASIC'),
        }),
      },
      input: {
        default: '{}',
        parseHTML: (el) => el.getAttribute('data-input') ?? '{}',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-input': String(attrs.input ?? '{}'),
        }),
      },
      result: {
        default: '{}',
        parseHTML: (el) => el.getAttribute('data-result') ?? '{}',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-result': String(attrs.result ?? '{}'),
        }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') ?? '',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-label': String(attrs.label ?? ''),
        }),
      },
      capturedAt: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-captured-at') ?? '',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-captured-at': String(attrs.capturedAt ?? ''),
        }),
      },
      tombstone: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-tombstone') === 'true',
        renderHTML: (attrs: SerializedAttrs) => ({
          'data-tombstone': attrs.tombstone ? 'true' : 'false',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="calc-snapshot"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'calc-snapshot' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalcSnapshotCard)
  },
})
