




const DEFAULT_TIMEOUT_MS = 15000

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
}
