import Link from "next/link"
import { Sigma } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Page not found — Mathboard",
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
      <Sigma className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  )
}
