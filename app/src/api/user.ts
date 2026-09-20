import { apiFetch } from "@/lib/api-fetch"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type UserPublicResponse = {
    id: number
    authuser_id: number
    authuser: unknown
}

export type GetUserResponse = {
    success: boolean
    user?: UserPublicResponse
}

/**
 * A one-minute credential for opening the live-editing WebSocket. Browsers can't put a header on a WebSocket, so
 * the credential goes in the URL and ends up in server logs: a ticket that has already expired is harmless there,
 * where the login token would not be. A backend that predates tickets answers 404, so fall back to the token.
 */
export async function fetchWsTicket(): Promise<string> {
  const token = localStorage.getItem("token")
  if (!token) throw new Error("Not signed in")

  const res = await apiFetch(`${API_URL}/ws-ticket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404 || res.status === 405) return token
  if (!res.ok) throw new Error(`Could not get a WebSocket ticket (${res.status})`)

  const body: { ticket: string } = await res.json()
  return body.ticket
}

/**
 * Tells the server to revoke this account's login tokens on every device. Fire and forget: the caller clears the
 * local copy straight away, so this must not delay or block signing out, and a failure still leaves the browser signed out.
 */
export function revokeSessionOnServer(): void {
  const token = localStorage.getItem("token")
  if (!token) return

  apiFetch(`${API_URL}/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {})
}

export async function getUserByUsername(
  username: string
): Promise<GetUserResponse> {
  const token = localStorage.getItem("token")

  const res = await apiFetch(`${API_URL}/user?username=${username}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  })

  if (!res.ok) {
    throw new Error("Network error")
  }

  return res.json()
}