import { useMemo } from 'react'
import { useNotes } from '../notes/api'
import { useSheets } from '../sheets/api'
import type { Note } from '../notes/types'
import type { SheetSummary } from '../sheets/types'
import { stripHtmlToText } from './stripHtml'

export type SearchResult =
  | {
      kind: 'note'
      id: number
      title: string
      snippet: string
      pinned: boolean
      updatedAt: string
      /** 'title' or 'body' — drives a small label on the row. */
      matchedField: 'title' | 'body'
    }
  | {
      kind: 'sheet'
      id: number
      title: string
      snippet: string
      pinned: boolean
      updatedAt: string
      matchedField: 'title'
    }

const MAX_RESULTS = 24
const SNIPPET_LEN = 90

/**
 * Client-side search across cached notes + sheets.
 *
 * Notes are searched on title + plain-text body. Sheets are searched on
 * title only — the list summary endpoint doesn't carry cell data, and
 * fan-out fetching every sheet just to search would be wasteful. (Server-
 * side full-text is the v2 if this ever feels limiting.)
 *
 * Ranking is intentionally simple: title matches first, then body
 * matches, pinned breaks ties, then updatedAt desc.
 */
export function useSearchResults(query: string): {
  results: SearchResult[]
  isLoading: boolean
} {
  const notesQuery = useNotes()
  const sheetsQuery = useSheets()
  const trimmed = query.trim()

  const results = useMemo<SearchResult[]>(() => {
    if (trimmed === '') return []
    const needle = trimmed.toLowerCase()
    const notes = notesQuery.data ?? []
    const sheets = sheetsQuery.data ?? []

    const titleHits: SearchResult[] = []
    const bodyHits: SearchResult[] = []

    for (const n of notes) {
      const title = (n.title ?? '').trim()
      if (title.toLowerCase().includes(needle)) {
        titleHits.push(makeNoteResult(n, 'title', title || '(제목 없음)'))
        continue
      }
      const text = stripHtmlToText(n.body)
      if (text.toLowerCase().includes(needle)) {
        bodyHits.push(makeNoteResult(n, 'body', title || '(제목 없음)', text, needle))
      }
    }

    for (const s of sheets) {
      const title = (s.title ?? '').trim()
      if (title.toLowerCase().includes(needle)) {
        titleHits.push(makeSheetResult(s, title || '(제목 없음)'))
      }
    }

    titleHits.sort(sortPinnedThenRecent)
    bodyHits.sort(sortPinnedThenRecent)
    return [...titleHits, ...bodyHits].slice(0, MAX_RESULTS)
  }, [trimmed, notesQuery.data, sheetsQuery.data])

  return {
    results,
    isLoading: notesQuery.isLoading || sheetsQuery.isLoading,
  }
}

function makeNoteResult(
  n: Note,
  matched: 'title' | 'body',
  displayTitle: string,
  bodyText?: string,
  needle?: string,
): SearchResult {
  const snippet =
    matched === 'body' && bodyText && needle
      ? sliceAround(bodyText, needle, SNIPPET_LEN)
      : truncate(bodyText ?? stripHtmlToText(n.body), SNIPPET_LEN)
  return {
    kind: 'note',
    id: n.id,
    title: displayTitle,
    snippet,
    pinned: n.pinned,
    updatedAt: n.updatedAt,
    matchedField: matched,
  }
}

function makeSheetResult(s: SheetSummary, displayTitle: string): SearchResult {
  return {
    kind: 'sheet',
    id: s.id,
    title: displayTitle,
    snippet: '',
    pinned: s.pinned,
    updatedAt: s.updatedAt,
    matchedField: 'title',
  }
}

function sortPinnedThenRecent(a: SearchResult, b: SearchResult): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return b.updatedAt.localeCompare(a.updatedAt)
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

function sliceAround(text: string, needle: string, len: number): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(needle)
  if (idx < 0) return truncate(text, len)
  const half = Math.floor((len - needle.length) / 2)
  const start = Math.max(0, idx - half)
  const end = Math.min(text.length, idx + needle.length + half)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return prefix + text.slice(start, end).trim() + suffix
}
