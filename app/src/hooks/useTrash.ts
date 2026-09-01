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
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  function removeDocLocally(docId: number) {
    setDocs((prev) => prev.filter((doc) => doc.id !== docId))
  }

  return { docs, loading, removeDocLocally, refetch: loadTrash }
}
