import type { Metadata } from "next"


export const metadata: Metadata = {
  title: "Your documents — Mathboard",
  robots: { index: false, follow: false },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
