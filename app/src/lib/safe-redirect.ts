const PLACEHOLDER_ORIGIN = "https://redirect.invalid"

/**
 * Turns a `?redirect=` value into a path on this site, or `fallback` if it points anywhere else.
 *
 * Resolving it against a placeholder origin and comparing origins is more reliable than string checks: browsers
 * strip tabs and newlines and treat `\` like `/`, so `/\evil.com` and `/<tab>/evil.com` both mean `//evil.com`.
 * `javascript:` and `data:` values have an opaque origin and fail the same comparison.
 */
export function safeRedirect(value: string | null | undefined, fallback = "/docs"): string {
  if (!value) return fallback
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN)
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
