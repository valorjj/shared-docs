/** Display-friendly hostname for a URL — strips `www.` and drops the
 *  scheme. Falls back to the input untouched if parsing fails. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
