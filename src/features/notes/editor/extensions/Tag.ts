import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'

/**
 * Inline Bear-style `#tag` mark.
 *
 * The matched text *includes* the `#` so when extracting later we can keep
 * the leading hash as part of the tag identity (Bear does the same).
 *
 * Allowed characters after `#`: any Unicode letter or number, plus `-` and `_`.
 * Tag ends at the first whitespace or end-of-line. Korean characters are
 * letters per Unicode property, so `#여행` works.
 */
const TAG_REGEX_INPUT = /(?:^|\s)(#[\p{L}\p{N}_-]+)$/u
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
    return [markInputRule({ find: TAG_REGEX_INPUT, type: this.type })]
  },

  addPasteRules() {
    return [markPasteRule({ find: TAG_REGEX_PASTE, type: this.type })]
  },
})
