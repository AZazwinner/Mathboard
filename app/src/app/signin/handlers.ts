import { createUser, signinUser } from "@/api/signin";

export type CreateAccountResult =
  | { ok: true; token: string }
  | { ok: false; error: string }

export async function createAccountHandler(data: {
  username: string
  email: string
  password: string
}): Promise<CreateAccountResult> {
  let res
  try {
    res = await createUser(data)
  } catch {
    return { ok: false, error: "Network error - please try again" }
  }

  switch (res.code) {
    case 100:
      return {
        ok: true,
        token: res.token!,
      }

    case 10:
      return { ok: false, error: "Invalid username" }

    case 20:
      return { ok: false, error: "Invalid email" }

    case 30:
      return { ok: false, error: "Invalid password" }

    case 90:
      return { ok: false, error: "Account already exists" }

    default:
      return { ok: false, error: "Unknown error" }
  }
}

export type SigninResult = any;

export async function signinHandler(data: {
  username: string
  password: string
}): Promise<SigninResult> {
  let res
  try {
    res = await signinUser(data);
  } catch {
    return { ok: false, error: "Network error - please try again" }
  }

  if (res?.token) {
    return {
      ok: true,
      token: res.token
    }
  }

  return {
    ok: false
  }
}