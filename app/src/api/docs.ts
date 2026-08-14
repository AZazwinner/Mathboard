const API_URL = process.env.NEXT_PUBLIC_API_URL

export type CreateDocInput = {
    template?: string
    title?: string
}

export type CreateDocResponse = {
    doc_id: string
}

export async function createDoc(
  data: CreateDocInput
): Promise<CreateDocResponse> {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}/docs/new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    throw new Error("Network error")
  }

  return res.json()
}

export type DocumentResponse = {
  id: number
  title: string
  text: string
}

export type DocumentBlock = {
  id: string
  doc_id: number
  position: number
  type: string
  content: string
  updated_at: string
}

export type DocumentResponsePermission = {
  id: number
  owner_id: number
  owner: any

  title: string
  text: string
  blocks: DocumentBlock[]

  created_at: string
  updated_at: string

  permission: "read" | "write" | "owner"
  owner_username: string
}