"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { AuthCard } from "./AuthCard"
import { AuthLayout } from "./AuthLayout"
import { useAuth } from "@/hooks/useAuth"
import { safeRedirect } from "@/lib/safe-redirect"
import { useEffect } from "react"

export default function SignInPage() {
  const params = useSearchParams()
  const router = useRouter()

  const redirectTo = safeRedirect(params?.get("redirect"))
  const initialMode = params?.get("mode") === "signin" ? "signin" : "signup"

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
    <AuthLayout>
      <AuthCard handleRedirect={handleRedirect} paramMode={initialMode}/>
    </AuthLayout>
  )
}