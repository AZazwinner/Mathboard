"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Logo } from "@/components/Logo"
import { Button } from "@/components/ui/button"


export default function DocError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
            <Logo className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold">Something went wrong</h1>
                <p className="max-w-sm text-muted-foreground">
                    This document hit an error while rendering. Your edits are saved -
                    try again, or head back to your documents.
                </p>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" onClick={() => reset()}>
                    Try again
                </Button>
                <Button asChild>
                    <Link href="/docs">Back to documents</Link>
                </Button>
            </div>
        </div>
    )
}
