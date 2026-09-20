"use client"

import { useCallback, useEffect, useState } from "react"
import { getTrash, type TrashedDocument } from "@/api/docs"

export function useTrash() {
  const [docs, setDocs] = useState<TrashedDocument[]>([])
  const [loading, setLoading] = useState(true)

  const loadTrash = useCallback(async () => {
    try {
      const res = await getTrash()
      setDocs(res.docs)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getTrash()
      .then((res) => {
        if (active) setDocs(res.docs)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function removeDocLocally(docId: number) {
    setDocs((prev) => prev.filter((doc) => doc.id !== docId))
  }

  return { docs, loading, removeDocLocally, refetch: loadTrash }
}
