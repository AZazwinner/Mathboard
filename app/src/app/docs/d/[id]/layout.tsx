import type { Metadata } from "next"


export const metadata: Metadata = {
  title: "Document — Mathboard",
}

export default function DocLayout({ children }: { children: React.ReactNode }) {
  return children
}
