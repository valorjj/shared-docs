import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import LinkCardView from './LinkCardView'

export type LinkCardAttrs = {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  faviconUrl: string | null
  siteName: string | null
  /** ISO timestamp captured at insertion / refresh. */
  capturedAt: string
}

/**
 * Tiptap block node embedding a frozen link preview (OG metadata) into
 * a memo body. Same architecture as `DataSnapshot` — values are frozen
 * at insertion so old memos don't silently mutate when the linked page
 * changes; a refresh action recaptures.
 *
 * Persisted HTML shape:
 *   <div data-type="link-card"
 *        data-url="…"
 *        data-title="…"
 *        data-description="…"
 *        data-image-url="…"
 *        data-favicon-url="…"
 *        data-site-name="…"
 *        data-captured-at="…"></div>
 */
export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') ?? '',
        renderHTML: (attrs) => ({ 'data-url': String(attrs.url ?? '') }),
      },
      title: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-title'),
        renderHTML: (attrs) =>
          attrs.title == null ? {} : { 'data-title': String(attrs.title) },
      },
      description: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-description'),
        renderHTML: (attrs) =>
          attrs.description == null
            ? {}
            : { 'data-description': String(attrs.description) },
      },
      imageUrl: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-image-url'),
        renderHTML: (attrs) =>
          attrs.imageUrl == null ? {} : { 'data-image-url': String(attrs.imageUrl) },
      },
      faviconUrl: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-favicon-url'),
        renderHTML: (attrs) =>
          attrs.faviconUrl == null ? {} : { 'data-favicon-url': String(attrs.faviconUrl) },
      },
      siteName: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-site-name'),
        renderHTML: (attrs) =>
          attrs.siteName == null ? {} : { 'data-site-name': String(attrs.siteName) },
      },
      capturedAt: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-captured-at') ?? '',
        renderHTML: (attrs) => ({ 'data-captured-at': String(attrs.capturedAt ?? '') }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="link-card"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'link-card' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView)
  },
})
