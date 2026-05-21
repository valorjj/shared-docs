import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * In-note search via Tiptap decorations. The plugin state owns the
 * `query` and `activeIndex`; React-side UI (NoteSearchBar) reads
 * matches via the helper and drives updates by dispatching a
 * meta-tagged transaction.
 *
 * Decorations are inline; they paint two classes:
 *   .nm-search-match         — every match
 *   .nm-search-match-active  — the one currently navigated to
 *
 * Doc changes (typing while the search bar is open) re-run the find,
 * clamping `activeIndex` to the new match count.
 */
const META_KEY = 'noteSearch:set'

export const NoteSearchPluginKey = new PluginKey<SearchState>('noteSearch$')

export type SearchMatch = { from: number; to: number }

type SearchState = {
  query: string
  activeIndex: number
  matches: SearchMatch[]
  decorations: DecorationSet
}

export const NoteSearch = Extension.create({
  name: 'noteSearch',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: NoteSearchPluginKey,
        state: {
          init: () => ({
            query: '',
            activeIndex: 0,
            matches: [],
            decorations: DecorationSet.empty,
          }),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(META_KEY) as
              | { query?: string; activeIndex?: number }
              | undefined
            if (meta) {
              const nextQuery = meta.query !== undefined ? meta.query : prev.query
              const matches = nextQuery ? findMatches(newState.doc, nextQuery) : []
              const activeIndex =
                meta.activeIndex !== undefined
                  ? clampIndex(meta.activeIndex, matches.length)
                  : clampIndex(prev.activeIndex, matches.length)
              return {
                query: nextQuery,
                activeIndex,
                matches,
                decorations: buildDecorations(newState.doc, matches, activeIndex),
              }
            }
            if (tr.docChanged && prev.query) {
              // Re-find on edit. Active index sticks to its old slot
              // when possible — clamps if matches shrink.
              const matches = findMatches(newState.doc, prev.query)
              const activeIndex = clampIndex(prev.activeIndex, matches.length)
              return {
                query: prev.query,
                activeIndex,
                matches,
                decorations: buildDecorations(newState.doc, matches, activeIndex),
              }
            }
            return prev
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})

function findMatches(doc: PMNode, query: string): SearchMatch[] {
  if (!query) return []
  const lower = query.toLowerCase()
  const out: SearchMatch[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let idx = 0
    while (true) {
      const found = text.indexOf(lower, idx)
      if (found < 0) break
      out.push({ from: pos + found, to: pos + found + query.length })
      idx = found + query.length
    }
  })
  return out
}

function buildDecorations(
  doc: PMNode,
  matches: SearchMatch[],
  activeIndex: number,
): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty
  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === activeIndex ? 'nm-search-match nm-search-match-active' : 'nm-search-match',
    }),
  )
  return DecorationSet.create(doc, decos)
}

function clampIndex(idx: number, total: number): number {
  if (total === 0) return 0
  if (idx < 0) return 0
  if (idx >= total) return total - 1
  return idx
}

export function dispatchSearch(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  patch: { query?: string; activeIndex?: number },
): void {
  const tr = state.tr.setMeta(META_KEY, patch)
  dispatch?.(tr)
}

export function getSearchState(state: EditorState): SearchState | undefined {
  return NoteSearchPluginKey.getState(state)
}
