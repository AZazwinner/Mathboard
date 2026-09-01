import { Suspense } from "react"
import type { Metadata } from "next"
import SigninPage from "./SigninPage"

export const metadata: Metadata = {
  title: "Sign in — Mathboard",
  alternates: { canonical: "/signin" },
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <SigninPage />
    </Suspense>
  )
}