import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

export type MentionItem = {
  id: number
  title: string | null
  updatedAt: string
}

export type MentionState = {
  items: MentionItem[]
  selected: number
  command: (item: MentionItem) => void
  clientRect: (() => DOMRect | null) | null
  query: string
}

export type MentionKeyHandler = (event: KeyboardEvent) => boolean

export interface MentionOptions {
  /**
   * Live, read-on-keystroke source of mention candidates. Stored as a ref
   * so the Suggestion plugin (created once at editor mount) always sees
   * fresh data when the user types `@`.
   */
  itemsRef: { current: MentionItem[] }
  /** The note currently being edited — excluded to forbid self-references. */
  currentNoteIdRef: { current: number | null }
  onOpen: (state: MentionState) => void
  onUpdate: (state: MentionState) => void
  onClose: () => void
  keyHandlerRef: { current: MentionKeyHandler | null }
}

/**
 * `@`-mention popover that inserts a `noteLink` atom node into the editor.
 * Mirrors the structure of {@link SlashCommand} so the two suggestions
 * share their popup-state plumbing pattern.
 */
export const MentionCommand = Extension.create<MentionOptions>({
  name: 'noteMention',

  addOptions() {
    return {
      itemsRef: { current: [] },
      currentNoteIdRef: { current: null },
      onOpen: () => {},
      onUpdate: () => {},
      onClose: () => {},
      keyHandlerRef: { current: null },
    }
  },

  addProseMirrorPlugins() {
    const opts = this.options
    return [
      Suggestion<MentionItem>({
        editor: this.editor,
        char: '@',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: 'noteLink', attrs: { noteId: props.id } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        items: ({ query }) => {
          const q = query.toLowerCase().trim()
          const currentId = opts.currentNoteIdRef.current
          const source = opts.itemsRef.current.filter((n) => n.id !== currentId)
          const filtered = q
            ? source.filter((n) => (n.title ?? '').toLowerCase().includes(q))
            : source
          return filtered
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 8)
        },
        render: () => ({
          onStart: (props) => {
            opts.onOpen({
              items: props.items,
              selected: 0,
              command: (item) => props.command(item),
              clientRect: props.clientRect ?? null,
              query: props.query,
            })
          },
          onUpdate: (props) => {
            opts.onUpdate({
              items: props.items,
              selected: 0,
              command: (item) => props.command(item),
              clientRect: props.clientRect ?? null,
              query: props.query,
            })
          },
          onKeyDown: ({ event }) => opts.keyHandlerRef.current?.(event) ?? false,
          onExit: () => opts.onClose(),
        }),
      }),
    ]
  },
})
