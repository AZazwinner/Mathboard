"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { clearAuthToken } from "@/lib/auth-token"

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

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("token")

      if (!token) {
        router.replace("/signin")
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          throw new Error("Unauthorized")
        }

        const data: User = await res.json()
        setUser(data)
      } catch (err) {
        clearAuthToken()
        router.replace("/signin")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  return { user, loading }
}