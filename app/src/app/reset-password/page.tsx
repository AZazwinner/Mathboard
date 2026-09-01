import { Suspense } from "react"
import type { Metadata } from "next"
import ResetPasswordPage from "./ResetPasswordPage"

// Reached only via a one-time emailed link with a reset token in the query string, so noindex it.
export const metadata: Metadata = {
  title: "Reset password — Mathboard",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <ResetPasswordPage />
    </Suspense>
  )
}
