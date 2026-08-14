import { Suspense } from "react"
import SigninPage from "./SigninPage"

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <SigninPage />
    </Suspense>
  )
}