"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAccountHandler, signinHandler } from "./handlers"
import { setAuthToken } from "@/lib/auth-token"
import { useState } from "react"
import Link from "next/link"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export const CreateAccount = ({
    handleRedirect,
    setMode
}: {
    handleRedirect: () => void
    setMode: (arg0: Mode) => void
}) => {
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [touched, setTouched] = useState({ username: false, email: false, password: false })

    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const emailValid = email === "" || EMAIL_PATTERN.test(email)
    const passwordValid = password === "" || password.length >= MIN_PASSWORD_LENGTH
    const canSubmit = username.trim() !== "" && EMAIL_PATTERN.test(email) && password.length >= MIN_PASSWORD_LENGTH

    const markTouched = (field: keyof typeof touched) => setTouched((prev) => ({ ...prev, [field]: true }))

    async function handleSignUp() {
        setTouched({ username: true, email: true, password: true })
        if (!canSubmit) return

        setLoading(true)

        const result = await createAccountHandler({
            username,
            email,
            password,
        })

        setLoading(false)

        if (!result.ok) {
            setError(result.error)
            return
        }

        setAuthToken(result.token)
        handleRedirect()
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-1">
                <CardTitle className="font-heading text-3xl font-normal">Create account for Mathboard</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Pick up where your last proof left off
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input
                        id="signup-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onBlur={() => markTouched("username")}
                        aria-invalid={touched.username && username.trim() === ""}
                    />
                    {touched.username && username.trim() === "" && (
                        <p className="text-xs text-red-500">Username is required.</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                        id="signup-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => markTouched("email")}
                        placeholder="you@example.com"
                        aria-invalid={touched.email && !emailValid}
                    />
                    {touched.email && !emailValid && (
                        <p className="text-xs text-red-500">Enter a valid email address.</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => markTouched("password")}
                        placeholder="••••••••"
                        aria-invalid={touched.password && !passwordValid}
                    />
                    {touched.password && !passwordValid && (
                        <p className="text-xs text-red-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
                    )}
                </div>

                {error && (
                    <div className="text-sm text-red-500">
                        {error}
                    </div>
                )}

                <Button className="w-full py-4" onClick={handleSignUp} disabled={loading}>
                    {loading ? "Creating account…" : "Create Account"}
                </Button>

                <div className="text-center text-xs text-muted-foreground space-y-2">
                    <p>
                        Already have an account?{" "}
                        <button
                            className="underline hover:text-foreground"
                            onClick={() => setMode("signin")}
                        >
                            Sign in
                        </button>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export const Signin = ({
    handleRedirect,
    setMode
}: {
    handleRedirect: () => void
    setMode: (arg0: Mode) => void
}) => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSignin() {
        setLoading(true)

        const result = await signinHandler({
            username,
            password,
        })

        setLoading(false)

        if (!result.ok) {
            setError(result.error || "Incorrect credentials")
            return
        }

        setAuthToken(result.token)
        handleRedirect()
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-1">
                <CardTitle className="font-heading text-3xl font-normal">Sign in to Mathboard</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Pick up where your last proof left off
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="signin-username">Username/email</Label>
                    <Input
                        id="signin-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Password</Label>
                        <Link href="/forgot-password" className="text-xs text-muted-foreground underline hover:text-foreground">
                            Forgot password?
                        </Link>
                    </div>
                    <Input
                        id="signin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                    />
                </div>

                {error && (
                    <div className="text-sm text-red-500">
                        {error}
                    </div>
                )}

                <Button className="w-full py-4" onClick={handleSignin} disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                </Button>

                <div className="text-center text-xs text-muted-foreground space-y-2">
                    <p>
                        No account?{" "}
                        <button
                            className="underline hover:text-foreground"
                            onClick={() => setMode("signup")}
                        >
                            Create one
                        </button>
                    </p>

                </div>
            </CardContent>
        </Card>
    );
}

type Mode = "signin" | "signup"

export const AuthCard = ({
    handleRedirect,
    paramMode = "signup"
}: {
    handleRedirect: () => void
    paramMode?: Mode
}) => {
    const [mode, setMode] = useState<Mode>(paramMode)

    return mode === "signup"
        ? <CreateAccount handleRedirect={handleRedirect} setMode={setMode} />
        : <Signin handleRedirect={handleRedirect} setMode={setMode} />
}
