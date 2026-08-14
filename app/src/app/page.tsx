import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight, Sigma, FileText, Users, Sparkles } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Sigma className="h-5 w-5" />
            mathboard
          </div>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="/docs" className="hover:text-foreground">Docs</a>
          </nav>

          <Link href="/signin">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Now in beta
        </div>

        <h1 className="mt-6 text-5xl font-bold tracking-tight">
          Google Docs for <span className="text-primary">LaTeX</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Write, collaborate, and render beautiful mathematical documents in real time.
          Mathboard brings modern collaboration to LaTeX editing.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signin">
            <Button size="lg">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="lg">
            View demo
          </Button>
        </div>

        <div className="mt-12 rounded-xl border bg-muted/30 p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">
            Live preview coming soon
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">
            hi
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold">
            Built for modern math writing
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card className="p-6">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold">Real-time LaTeX editor</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Instant rendering with zero refresh friction.
              </p>
            </Card>

            <Card className="p-6">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold">Collaborative editing</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Work together on proofs and papers in real time.
              </p>
            </Card>

            <Card className="p-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold">Smart rendering</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Clean, fast MathJax/KaTeX output for every expression.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold">
          Start writing mathematics like a document.
        </h2>
        <p className="mt-4 text-muted-foreground">
          No compile step. No friction. Just LaTeX that feels modern.
        </p>

        <Link href="/docs">
          <Button size="lg" className="mt-8">
            Launch Mathboard
          </Button>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-8 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} mathboard</div>
          <div className="flex gap-4">
            <a href="#">GitHub</a>
            <a href="#">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  )
}