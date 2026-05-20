import { Extension } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import type { LucideIcon } from 'lucide-react'

/** Distinct plugin key — `@tiptap/suggestion` uses a single default key, so
 *  two extensions both calling `Suggestion()` without their own would
 *  collide at editor mount with "Adding different instances of a keyed
 *  plugin (suggestion$)". */
const SLASH_PLUGIN_KEY = new PluginKey('slashCommand$')

export type SlashItem = {
  id: string
  title: string
  hint?: string
  Icon: LucideIcon
  run: (editor: Editor, range: Range) => void
}

export type SlashState = {
  items: SlashItem[]
  selected: number
  command: (item: SlashItem) => void
  /** Tiptap-supplied position helper; bounding rect of the slash trigger. */
  clientRect: (() => DOMRect | null) | null
  query: string
}

export type SlashKeyHandler = (event: KeyboardEvent) => boolean

export interface SlashOptions {
  items: SlashItem[]
  onOpen: (state: SlashState) => void
  onUpdate: (state: SlashState) => void
  onClose: () => void
  keyHandlerRef: { current: SlashKeyHandler | null }
}

export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      items: [],
      onOpen: () => {},
      onUpdate: () => {},
      onClose: () => {},
      keyHandlerRef: { current: null },
    }
  },

  addProseMirrorPlugins() {
    const { items, onOpen, onUpdate, onClose, keyHandlerRef } = this.options
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: SLASH_PLUGIN_KEY,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          props.run(editor, range)
        },
        items: ({ query }) => {
          const q = query.toLowerCase()
          if (!q) return items.slice(0, 10)
          return items
            .filter(
              (i) =>
                i.title.toLowerCase().includes(q) ||
                (i.hint ?? '').toLowerCase().includes(q) ||
                i.id.toLowerCase().includes(q),
            )
            .slice(0, 10)
        },
        render: () => ({
          onStart: (props) => {
            onOpen({
              items: props.items,
              selected: 0,
              command: (item) => props.command(item),
              clientRect: props.clientRect ?? null,
              query: props.query,
            })
          },
          onUpdate: (props) => {
            onUpdate({
              items: props.items,
              selected: 0,
              command: (item) => props.command(item),
              clientRect: props.clientRect ?? null,
              query: props.query,
            })
          },
          onKeyDown: ({ event }) => {
            const handler = keyHandlerRef.current
            const handled = handler?.(event) ?? false
            // eslint-disable-next-line no-console
            console.log('[slash onKeyDown]', event.key, 'handler:', !!handler, 'handled:', handled)
            return handled
          },
          onExit: () => {
            onClose()
          },
        }),
      }),
    ]
  },
})
