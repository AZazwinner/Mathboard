import type { Metadata } from "next"

// noindex, since robots.txt's Disallow only stops crawling, not indexing a URL already known from elsewhere.
export const metadata: Metadata = {
  title: "Your documents — Mathboard",
  robots: { index: false, follow: false },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
