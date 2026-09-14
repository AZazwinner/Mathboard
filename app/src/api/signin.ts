import { apiFetch } from "@/lib/api-fetch"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type CreateUserInput = {
  username: string
  email: string
  password: string
}

export type CreateUserResponse = {
  code: number
  user?: any
  token?: string
}

export async function createUser(data: CreateUserInput): Promise<CreateUserResponse> {
  const res = await apiFetch(`${API_URL}/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    throw new Error("Network error")
  }

  return res.json()
}

export type SigninUserInput = {
    username: string
    password: string
}

export type SigninUserResponse = {
    user: any
    token?: string
}

export async function signinUser(data: SigninUserInput): Promise<SigninUserResponse> {
  const res = await apiFetch(`${API_URL}/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {

    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || "Network error")
  }

  return res.json()
}

export type ForgotPasswordResponse = {
  success: boolean

  dev_reset_link?: string
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const res = await apiFetch(`${API_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || "Network error")
  }

  return res.json()
}

export type ResetPasswordResponse = { success: boolean }

export async function resetPassword(token: string, password: string): Promise<ResetPasswordResponse> {
  const res = await apiFetch(`${API_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || "Network error")
  }

  return res.json()
}