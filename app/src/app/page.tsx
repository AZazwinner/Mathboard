import { Button } from "@/components/ui/button"
import { Sigma } from "lucide-react"
import Link from "next/link"
import LatexRenderer from "@/components/LatexRenderer"

const DEMO_SOURCE = String.raw`## Cauchy–Schwarz

For vectors $u, v \in \mathbb{R}^n$:

$$\left(\sum_i u_i v_i\right)^2 \;\leq\; \left(\sum_i u_i^2\right)\left(\sum_i v_i^2\right)$$

with equality iff $u$ and $v$ are linearly dependent.`

const FEATURES = [
  {
    title: "Renders as you type",
    description: "Every block compiles live — no separate preview pane, no build step.",
  },
  {
    title: "Real-time collaboration",
    description: "Edit the same proof together and see collaborators' cursors as they write.",
  },
  {
    title: "Share with a link",
    description: "Invite people to read or edit a document. No exports, no attachments.",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* NAV */}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Sigma className="h-4 w-4" />
            mathboard
          </div>

          <nav className="hidden items-center gap-8 text-sm text-neutral-500 sm:flex">
            <a href="#features" className="hover:text-neutral-900">Features</a>
            <a href="/docs" className="hover:text-neutral-900">Docs</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/signin" className="text-sm text-neutral-500 hover:text-neutral-900">
              Sign in
            </Link>
            <Link href="/signin">
              <Button size="sm" className="bg-neutral-900 text-white hover:bg-neutral-900/90">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-14 text-center">
        <p className="text-sm text-neutral-500">Now in beta</p>

        <h1 className="mt-4 text-[2.75rem] leading-[1.1] font-semibold tracking-tight text-neutral-900 sm:text-6xl">
          Write math like it&apos;s a document.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
          A collaborative LaTeX editor that renders as you type — built for
          proofs, papers, and problem sets.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2">
          <Link href="/signin">
            <Button size="lg" className="bg-neutral-900 px-5 text-white hover:bg-neutral-900/90">
              Get started
            </Button>
          </Link>
          <Button size="lg" variant="ghost" className="text-neutral-600 hover:text-neutral-900">
            View demo
          </Button>
        </div>
      </section>

      {/* HERO VISUAL - an actual rendered document, not a placeholder */}
      <section className="mx-auto max-w-4xl px-6 pb-28">
        <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="ml-3 text-xs text-neutral-400">cauchy-schwarz.tex</span>
          </div>

          <div className="grid divide-y divide-neutral-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-neutral-500">
              {DEMO_SOURCE}
            </pre>
            <div className="p-6">
              <LatexRenderer content={DEMO_SOURCE} />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-neutral-200">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-2xl font-semibold text-neutral-900">
            Built for writing math, not fighting a compiler.
          </h2>

          <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <h3 className="font-medium text-neutral-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-2xl font-semibold text-neutral-900">
            Start writing mathematics like a document.
          </h2>
          <p className="mt-3 text-neutral-500">
            No compile step. No friction. Just LaTeX that feels modern.
          </p>

          <Link href="/docs">
            <Button size="lg" className="mt-8 bg-neutral-900 px-6 text-white hover:bg-neutral-900/90">
              Launch Mathboard
            </Button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8 text-sm text-neutral-400">
          <div>© {new Date().getFullYear()} mathboard</div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-neutral-600">GitHub</a>
            <a href="#" className="hover:text-neutral-600">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
