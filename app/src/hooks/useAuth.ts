"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { clearAuthToken } from "@/lib/auth-token"
import { apiFetch } from "@/lib/api-fetch"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type User = {
  id: number
  username: string
  email: string
}

export function useAuth() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("token")

      if (!token) {
        router.replace("/signin")
        setLoading(false)
        return
      }

      let res: Response
      try {
        res = await apiFetch(`${API_URL}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.")
        setLoading(false)
        return
      }

      if (res.status === 401 || res.status === 403) {
        clearAuthToken()
        router.replace("/signin")
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError("Couldn't load your account. Try again.")
        setLoading(false)
        return
      }

      const data: User = await res.json()
      setUser(data)
      setLoading(false)
    }

    loadUser()
  }, [router])

  return { user, loading, error }
}