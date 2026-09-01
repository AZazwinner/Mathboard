"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "../signin/AuthLayout"
import { forgotPassword } from "@/api/signin"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [devResetLink, setDevResetLink] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)

    async function handleSubmit() {
        if (!email.trim()) return
        setLoading(true)
        setError(null)

        try {
            const res = await forgotPassword(email.trim())
            setSubmitted(true)
            setDevResetLink(res.dev_reset_link ?? null)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong - please try again")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout>
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-1">
                    <CardTitle className="font-heading text-3xl font-normal">Reset your password</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        We&apos;ll send a reset link to your email
                    </p>
                </CardHeader>

                <CardContent className="space-y-4">
                    {submitted ? (
                        <div className="space-y-4">
                            <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                                If an account exists for <span className="font-medium text-foreground">{email}</span>,
                                a password reset link has been sent.
                            </div>

                            {devResetLink && (
                                <div className="space-y-2 rounded-md border border-dashed p-4 text-sm">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Dev mode - no email provider configured
                                    </p>
                                    <p className="text-muted-foreground">
                                        Use this link directly instead of checking an inbox:
                                    </p>
                                    <Link href={devResetLink} className="block break-all text-primary underline">
                                        {devResetLink}
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="forgot-email">Email</Label>
                                <Input
                                    id="forgot-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                    placeholder="you@example.com"
                                />
                            </div>

                            {error && <div className="text-sm text-red-500">{error}</div>}

                            <Button className="w-full py-4" onClick={handleSubmit} disabled={loading || !email.trim()}>
                                {loading ? "Sending…" : "Send reset link"}
                            </Button>
                        </>
                    )}

                    <div className="text-center text-xs text-muted-foreground">
                        <Link href="/signin?mode=signin" className="underline hover:text-foreground">
                            Back to sign in
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </AuthLayout>
    )
}
