"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type Document = {
  id: number
  owner_id: number
  owner: any
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
      const res = await fetch(`${API_URL}/my-docs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error("Failed to fetch documents")
      }

      const data = await res.json()
      setDocs(data["docs"] as Document[])
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

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
        const res = await fetch(`${API_URL}/shared-docs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          throw new Error("Failed to fetch documents")
        }

        const data = await res.json()
        setDocs(data["docs"] as Document[])
      } catch (err) {
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