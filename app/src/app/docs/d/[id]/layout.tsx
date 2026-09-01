import type { Metadata } from "next"

// Overrides the parent /docs layout's title; its noindex is still inherited since we don't redeclare `robots`.
export const metadata: Metadata = {
  title: "Document — Mathboard",
}

export default function DocLayout({ children }: { children: React.ReactNode }) {
  return children
}
