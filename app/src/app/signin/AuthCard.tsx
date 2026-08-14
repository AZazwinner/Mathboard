"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAccountHandler, signinHandler } from "./handlers"
import { setAuthToken } from "@/lib/auth-token"
import { useState } from "react"

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

    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSignUp() {
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
                <CardTitle className="text-2xl">Create account for Mathboard</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Continue to your LaTeX workspace
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
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

                <Button className="w-full py-4" onClick={handleSignUp}>
                    Create Account
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                    No account? You’ll be able to sign up soon.
                </div>

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

        console.log({result})

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
                <CardTitle className="text-2xl">Sign in to Mathboard</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Continue to your LaTeX workspace
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Username/email</Label>
                    <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
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

                <Button className="w-full py-4" onClick={handleSignin}>
                    Sign in
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                    No account? You’ll be able to sign up soon.
                </div>

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