"use client"

import { useState } from "react"
import { motion, MotionConfig, type Variants } from "framer-motion"
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

const NAV_LINKS = [
  { key: "features", label: "Features", href: "#features" },
  { key: "docs", label: "Docs", href: "/docs" },
]

// Shared motion variants - a fade+rise for individual elements, and a
// stagger wrapper that cascades any `fadeUp` children a beat apart instead
// of having them all pop in at once.
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
}

const demoStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

// Scroll-triggered reveal for below-the-fold content - fires once, a bit
// before the element is fully in view, and never re-triggers on scroll-back.
function Reveal({
  children,
  className,
  variants = fadeUp,
}: {
  children: React.ReactNode
  className?: string
  variants?: Variants
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
    >
      {children}
    </motion.div>
  )
}

// Wraps a CTA button with a soft spring scale on hover/tap, without
// changing anything about the Button component itself.
function AnimatedButton({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      className="inline-block"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.span>
  )
}

export default function HomePage() {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-neutral-900">
        {/* NAV */}
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2 text-[15px] font-medium">
              <Sigma className="h-4 w-4" />
              mathboard
            </div>

            <nav className="hidden items-center gap-8 text-sm text-neutral-500 sm:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  className="relative py-1 hover:text-neutral-900"
                  onMouseEnter={() => setHoveredLink(link.key)}
                  onMouseLeave={() => setHoveredLink(null)}
                  onFocus={() => setHoveredLink(link.key)}
                  onBlur={() => setHoveredLink(null)}
                >
                  {link.label}
                  {hoveredLink === link.key && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-0 -bottom-0.5 h-px bg-neutral-900"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/signin" className="text-sm text-neutral-500 hover:text-neutral-900">
                Sign in
              </Link>
              <AnimatedButton>
                <Link href="/signin">
                  <Button size="sm" className="bg-neutral-900 text-white hover:bg-neutral-900/90">
                    Get started
                  </Button>
                </Link>
              </AnimatedButton>
            </div>
          </div>
        </header>

        {/* HERO - animates on load, it's already in view */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mx-auto max-w-3xl px-6 pt-24 pb-14 text-center"
        >
          <motion.p variants={fadeUp} className="text-sm text-neutral-500">
            Now in beta
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="mt-4 text-[2.75rem] leading-[1.1] font-semibold tracking-tight text-neutral-900 sm:text-6xl"
          >
            Write math like it&apos;s a document.
          </motion.h1>

          <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
            A collaborative LaTeX editor that renders as you type — built for
            proofs, papers, and problem sets.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-2">
            <AnimatedButton>
              <Link href="/signin">
                <Button size="lg" className="bg-neutral-900 px-5 text-white hover:bg-neutral-900/90">
                  Get started
                </Button>
              </Link>
            </AnimatedButton>
            <Button size="lg" variant="ghost" className="text-neutral-600 hover:text-neutral-900">
              View demo
            </Button>
          </motion.div>
        </motion.section>

        {/* HERO VISUAL - an actual rendered document, not a placeholder */}
        <section className="mx-auto max-w-4xl px-6 pb-28">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={cardReveal}
            className="overflow-hidden rounded-xl border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <span className="ml-3 text-xs text-neutral-400">cauchy-schwarz.tex</span>
            </div>

            {/* the rendered panel settles in just after the source - a small
                nod to "renders as you type" instead of both halves popping
                in together */}
            <motion.div
              variants={demoStagger}
              className="grid divide-y divide-neutral-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
            >
              <motion.pre
                variants={fadeUp}
                className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-neutral-500"
              >
                {DEMO_SOURCE}
              </motion.pre>
              <motion.div variants={fadeUp} className="p-6">
                <LatexRenderer content={DEMO_SOURCE} />
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        {/* FEATURES */}
        <section id="features" className="border-t border-neutral-200">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <Reveal>
              <h2 className="text-2xl font-semibold text-neutral-900">
                Built for writing math, not fighting a compiler.
              </h2>
            </Reveal>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={staggerContainer}
              className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-3"
            >
              {FEATURES.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp}>
                  <h3 className="font-medium text-neutral-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-neutral-200">
          <Reveal variants={staggerContainer} className="mx-auto max-w-3xl px-6 py-24 text-center">
            <motion.h2 variants={fadeUp} className="text-2xl font-semibold text-neutral-900">
              Start writing mathematics like a document.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-neutral-500">
              No compile step. No friction. Just LaTeX that feels modern.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 inline-block">
              <AnimatedButton>
                <Link href="/docs">
                  <Button size="lg" className="bg-neutral-900 px-6 text-white hover:bg-neutral-900/90">
                    Launch Mathboard
                  </Button>
                </Link>
              </AnimatedButton>
            </motion.div>
          </Reveal>
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
    </MotionConfig>
  )
}
