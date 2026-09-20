"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api-fetch"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type Document = {
  id: number
  owner_id: number
  owner: unknown
  owner_username: string

  title: string
  blocks?: { content: string }[]

  created_at: string
  updated_at: string

  permission?: string
}

export function useDocuments() {
  const router = useRouter()

  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const loadDocs = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.replace("/signin")
      return
    }

    try {
      const res = await apiFetch(`${API_URL}/my-docs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error("Failed to fetch documents")
      }

      const data = await res.json()
      setDocs(data["docs"] as Document[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [router])

  // Refetching goes through loadDocs. The first load runs here instead so that it can be cancelled on unmount.
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/signin")
      return
    }

    let active = true
    apiFetch(`${API_URL}/my-docs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch documents")
        const data = await res.json()
        if (active) setDocs(data["docs"] as Document[])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [router])

  function removeDoc(docId: number) {
    setDocs((prev) => prev.filter((doc) => doc.id !== docId))
  }

  function renameDocLocally(docId: number, title: string) {
    setDocs((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, title } : doc)))
  }

  return { docs, loading, removeDoc, renameDocLocally, refetch: loadDocs }
}


export function useSharedDocuments() {
  const router = useRouter()

  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDocs() {
      const token = localStorage.getItem("token")

      if (!token) {
        router.replace("/signin")
        return
      }

      try {
        const res = await apiFetch(`${API_URL}/shared-docs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          throw new Error("Failed to fetch documents")
        }

        const data = await res.json()
        setDocs(data["docs"] as Document[])
      } catch {
      } finally {
        setLoading(false)
      }
    }

    loadDocs()
  }, [router])

  function renameDocLocally(docId: number, title: string) {
    setDocs((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, title } : doc)))
  }

  return { docs, loading, renameDocLocally }
}