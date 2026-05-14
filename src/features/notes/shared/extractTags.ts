import type { Note } from '../types'

/** Pull every `#tag` mark text out of a note body HTML string. */
export function extractTags(html: string): string[] {
  if (!html || typeof DOMParser === 'undefined') return []
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return []
  }
  const out = new Set<string>()
  doc.querySelectorAll('span[data-type="tag"]').forEach((el) => {
    const text = (el.textContent ?? '').trim()
    if (text.startsWith('#') && text.length > 1) out.add(text)
  })
  return Array.from(out)
}

export type TagWithCount = { tag: string; count: number }

/** Sort by count desc, then alphabetically for stability. */
export function buildTagCounts(notes: Note[]): TagWithCount[] {
  const counts = new Map<string, number>()
  for (const n of notes) {
    for (const t of extractTags(n.body)) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag))
}

/** Does this note's body contain the given tag mark? */
export function noteHasTag(note: Note, tag: string): boolean {
  return extractTags(note.body).includes(tag)
}
