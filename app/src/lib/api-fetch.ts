// A plain fetch() has no timeout - a hung connection (a dead server mid-request,
// a proxy/tunnel that swallows a response) leaves the promise pending forever,
// which stalls any UI waiting on it with no error to show and no way out.
// Wraps every API call in a bounded timeout so a hang becomes a normal
// rejected promise instead.
const DEFAULT_TIMEOUT_MS = 15000

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
}
