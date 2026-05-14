/**
 * HTML → plain text for search/snippet purposes. We can't trust user-pasted
 * markup, but DOMParser sandboxes script execution and we never inject the
 * result back into the DOM — only feed it to `String.prototype.indexOf` and
 * slice it for display.
 */
export function stripHtmlToText(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    // SSR / test fallback: strip tags with a regex. Good enough for matching.
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
