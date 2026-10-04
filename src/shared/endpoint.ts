/**
 * The custom provider's endpoint URLs: what the player typed made sendable, and the check that
 * it is a URL fetch can speak to (http or https).
 */

/** The typed URL as the adapters use it: trimmed, no trailing slash, no pasted `/chat/completions`. */
export function normalizeEndpoint(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '')
    .replace(/\/+$/, '')
}

/** The typed images URL as the adapters use it: {@link normalizeEndpoint}, and no pasted `/images`. */
export function normalizeImageEndpoint(raw: string): string {
  return normalizeEndpoint(raw).replace(/\/images$/, '').replace(/\/+$/, '')
}

/** Whether two typed URLs name one origin, so a key typed for one may be sent to the other. */
export function sameEndpointHost(a: string, b: string): boolean {
  try {
    return new URL(normalizeEndpoint(a)).origin === new URL(normalizeEndpoint(b)).origin
  } catch {
    return false
  }
}

/** The sentence saying why the URL cannot be sent to, or null when it can; `what` names the field. */
export function endpointProblem(raw: string, what = 'endpoint URL'): string | null {
  const url = normalizeEndpoint(raw)
  if (!url) return `Enter the ${what}.`
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return `The ${what} is not a valid URL.`
  }
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return null
  return `The ${what} must start with http:// or https://.`
}
