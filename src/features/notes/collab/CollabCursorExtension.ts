import { Extension } from '@tiptap/core'
import { yCursorPlugin } from '@tiptap/y-tiptap'
import type { WebsocketProvider } from 'y-websocket'

export type CollabCursorOptions = {
  provider: WebsocketProvider | null
  user: { name: string; color: string }
}

/**
 * Stands in for @tiptap/extension-collaboration-cursor, which hasn't shipped
 * a release compatible with @tiptap/extension-collaboration's move to
 * @tiptap/y-tiptap (its last release still depends on the unrelated
 * y-prosemirror package). Wires cursor decorations directly against
 * y-tiptap's own yCursorPlugin — the same binding Collaboration already uses
 * under the hood, so there's exactly one Yjs↔ProseMirror binding active.
 */
export const CollabCursor = Extension.create<CollabCursorOptions>({
  name: 'collabCursor',

  addOptions() {
    return {
      provider: null,
      user: { name: '', color: '' },
    }
  },

  addProseMirrorPlugins() {
    if (!this.options.provider) return []
    this.options.provider.awareness.setLocalStateField('user', this.options.user)
    return [yCursorPlugin(this.options.provider.awareness)]
  },
})
