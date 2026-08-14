const API_URL = process.env.NEXT_PUBLIC_API_URL

export type CreateShareDocInput = {
    doc_id: number;
    user_id: number;
    share_type: string;
}

export type SuccessResponse = {
    success: boolean
}

export async function createOrUpdateShareDoc(
  data: CreateShareDocInput
): Promise<SuccessResponse> {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}/doc-share`, {
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

export type ShareDocResponseExpanded = {
    doc_id: number;
    user_id: number;
    permission: "read" | "write";

    username: string;
}

export async function getShareDocs(
  doc_id: number | string
): Promise<ShareDocResponseExpanded[]> {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}/doc-shares?doc_id=${doc_id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error("Network error")
  }

  return res.json()
}

export type DeleteShareDocInput = {
    doc_id: number;
    user_id: number;
}

export async function deleteShareDoc(
  data: DeleteShareDocInput
): Promise<SuccessResponse> {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}/doc-share`, {
    method: "DELETE",
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

