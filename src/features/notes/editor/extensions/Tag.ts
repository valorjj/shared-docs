import { InputRule, Mark, markPasteRule, mergeAttributes } from '@tiptap/core'

/**
 * Inline Bear-style `#tag` mark.
 *
 * The matched text *includes* the `#` so when extracting later we can keep
 * the leading hash as part of the tag identity (Bear does the same).
 *
 * Allowed characters after `#`: any Unicode letter or number, plus `-` and `_`.
 * Korean characters are letters per Unicode property, so `#여행` works.
 *
 * Why trailing-whitespace trigger: a `$`-anchored mark-rule re-fires on every
 * keystroke (each new letter still matches `#word$`), and the cascading
 * addMark / removeStoredMark transactions can drop or shift the typed
 * character. Waiting for the user to commit the tag with a space gives one
 * predictable mark transaction per tag — the same UX Bear uses.
 */
const TAG_REGEX_INPUT = /(?:^|\s)(#[\p{L}\p{N}_-]+)(\s)$/u
const TAG_REGEX_PASTE = /(?:^|\s)(#[\p{L}\p{N}_-]+)(?=\s|$)/gu

export const Tag = Mark.create({
  name: 'tag',
  inclusive: false,
  spanning: false,

  parseHTML() {
    return [{ tag: 'span[data-type="tag"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'tag', class: 'memo-tag' }),
      0,
    ]
  },

  addInputRules() {
    const type = this.type
    return [
      new InputRule({
        find: TAG_REGEX_INPUT,
        handler: ({ state, range, match }) => {
          const fullMatch = match[0]
          const tag = match[1]
          if (!tag) return null
          const tagStart = range.from + fullMatch.indexOf(tag)
          const tagEnd = tagStart + tag.length
          const tr = state.tr
          tr.addMark(tagStart, tagEnd, type.create())
          tr.removeStoredMark(type)
        },
      }),
    ]
  },

  addPasteRules() {
    return [markPasteRule({ find: TAG_REGEX_PASTE, type: this.type })]
  },
})
