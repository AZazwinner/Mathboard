"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { AuthCard } from "./AuthCard"
import { useAuth } from "@/hooks/useAuth"
import { useEffect } from "react"

export default function SignInPage() {
  const params = useSearchParams()
  const router = useRouter()

  const redirectTo = params?.get("redirect") || "/docs"

  const handleRedirect = () => {
    router.push(redirectTo)
  }

  const { user, loading } = useAuth()
  useEffect(() => {
    if (!loading && user) {
      handleRedirect();
    }
  }, [user, loading])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      {<AuthCard handleRedirect={handleRedirect} paramMode="signin"/>}
    </div>
  )
}