import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import type { EntityKind } from './EntityLink'

/** Distinct plugin key — see the equivalent comment in SlashCommand.ts.
 *  Two suggestion plugins sharing the default key crash the editor at
 *  mount with "Adding different instances of a keyed plugin (suggestion$)". */
const MENTION_PLUGIN_KEY = new PluginKey('mentionCommand$')

/**
 * Picked item shape — mirrors backend's `EntityHit`. The popup fetches
 * its own results from `/api/search/entities`; this extension only owns
 * the trigger char + the command that inserts the chosen entity.
 */
export type MentionItem = {
  kind: EntityKind
  id: number
  title: string
  hint?: string | null
}

export type MentionState = {
  /** Selected index — owned by the popup, not by the suggestion plugin. */
  selected: number
  command: (item: MentionItem) => void
  clientRect: (() => DOMRect | null) | null
  query: string
}

export type MentionKeyHandler = (event: KeyboardEvent) => boolean

export interface MentionOptions {
  /** Id of the note being edited — popup excludes self-mentions. */
  currentNoteIdRef: { current: number | null }
  onOpen: (state: MentionState) => void
  onUpdate: (state: MentionState) => void
  onClose: () => void
  keyHandlerRef: { current: MentionKeyHandler | null }
}

/**
 * `@`-mention popover that inserts an `entityLink` atom node into the
 * editor. Items are fetched from the backend by the popup component
 * (see `MentionMenuPopup`) — this extension's `items` callback always
 * returns `[]` because the popup owns the data flow.
 *
 * The `command` callback receives whichever `MentionItem` the popup
 * passed to `state.command(...)`. Insert builds the entity-link node
 * with `kind` / `entityId` / `title` attrs so the chip can resolve
 * without an extra fetch.
 */
export const MentionCommand = Extension.create<MentionOptions>({
  name: 'entityMention',

  addOptions() {
    return {
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
        pluginKey: MENTION_PLUGIN_KEY,
        char: '@',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'entityLink',
                attrs: {
                  kind: props.kind,
                  entityId: props.id,
                  title: props.title,
                },
              },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        // Items fetched server-side by the popup. Return [] here so the
        // Suggestion plugin doesn't filter or limit anything — the popup
        // is the single source of truth for what's displayed.
        items: () => [],
        render: () => ({
          onStart: (props) => {
            opts.onOpen({
              selected: 0,
              command: (item) => props.command(item),
              clientRect: props.clientRect ?? null,
              query: props.query,
            })
          },
          onUpdate: (props) => {
            opts.onUpdate({
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
