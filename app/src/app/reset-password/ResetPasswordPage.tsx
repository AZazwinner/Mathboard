"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "../signin/AuthLayout"
import { resetPassword } from "@/api/signin"

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordPage() {
    const router = useRouter()
    const params = useSearchParams()
    const token = params?.get("token") ?? ""

    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    const passwordValid = password.length >= MIN_PASSWORD_LENGTH
    const matches = password === confirm
    const canSubmit = Boolean(token) && passwordValid && matches

    async function handleSubmit() {
        if (!canSubmit) return
        setLoading(true)
        setError(null)

        try {
            const res = await resetPassword(token, password)
            if (!res.success) {
                setError("This reset link is invalid or has expired - request a new one.")
                return
            }
            setDone(true)
            setTimeout(() => router.push("/signin?mode=signin"), 1500)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong - please try again")
        } finally {
            setLoading(false)
        }
    }

    if (!token) {
        return (
            <AuthLayout>
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center space-y-1">
                        <CardTitle className="font-heading text-3xl font-normal">Invalid reset link</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
                        <p>This link is missing its reset token.</p>
                        <Link href="/forgot-password" className="underline hover:text-foreground">
                            Request a new reset link
                        </Link>
                    </CardContent>
                </Card>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout>
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-1">
                    <CardTitle className="font-heading text-3xl font-normal">Set a new password</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    {done ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                            Password updated - redirecting to sign in…
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="reset-password">New password</Label>
                                <Input
                                    id="reset-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    aria-invalid={password !== "" && !passwordValid}
                                />
                                {password !== "" && !passwordValid && (
                                    <p className="text-xs text-red-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reset-confirm">Confirm password</Label>
                                <Input
                                    id="reset-confirm"
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                    placeholder="••••••••"
                                    aria-invalid={confirm !== "" && !matches}
                                />
                                {confirm !== "" && !matches && (
                                    <p className="text-xs text-red-500">Passwords don&apos;t match.</p>
                                )}
                            </div>

                            {error && <div className="text-sm text-red-500">{error}</div>}

                            <Button className="w-full py-4" onClick={handleSubmit} disabled={loading || !canSubmit}>
                                {loading ? "Updating…" : "Update password"}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </AuthLayout>
    )
}
