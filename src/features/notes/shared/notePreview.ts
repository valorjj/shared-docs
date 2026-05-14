const HTML_TAG_RE = /<[^>]+>/g
const WS_RE = /\s+/g

/** Strip HTML to a single-line plain-text excerpt. */
export function notePreview(html: string, maxLen = 140): string {
  if (!html) return ''
  const text = html.replace(HTML_TAG_RE, ' ').replace(WS_RE, ' ').trim()
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

/** Derive a display title — explicit title, or first non-empty line of body, or fallback. */
export function noteDisplayTitle(
  title: string | null,
  body: string,
  fallback = '제목 없음',
): string {
  const t = title?.trim()
  if (t) return t
  const text = body.replace(HTML_TAG_RE, ' ').replace(WS_RE, ' ').trim()
  if (!text) return fallback
  return text.slice(0, 60)
}
