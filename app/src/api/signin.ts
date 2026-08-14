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
  const res = await fetch(`${API_URL}/create-user`, {
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
  const res = await fetch(`${API_URL}/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  console.log({res})

  if (!res.ok) {
    throw new Error("Network error")
  }

  return res.json()
}