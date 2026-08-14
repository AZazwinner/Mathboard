"use client"

import { useEffect, useState } from "react"
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useMotionValue,
  useSpring,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import { Button } from "@/components/ui/button"
import { Sigma, FileText, Users, Share2, RotateCcw } from "lucide-react"
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
    icon: FileText,
  },
  {
    title: "Real-time collaboration",
    description: "Edit the same proof together and see collaborators' cursors as they write.",
    icon: Users,
  },
  {
    title: "Share with a link",
    description: "Invite people to read or edit a document. No exports, no attachments.",
    icon: Share2,
  },
]

const NAV_LINKS = [
  { key: "features", label: "Features", href: "#features" },
  { key: "docs", label: "Docs", href: "/docs" },
]

const ACCENT = "#F1F1EF"

// Shared motion variants - a spring-based fade+rise for individual
// elements (a slight organic overshoot instead of a flat ease-out), and a
// stagger wrapper that cascades `fadeUp` children a beat apart.
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 20, mass: 0.9 },
  },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 24 },
  },
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

// Nudges its contents a few px toward the cursor within its own bounds,
// spring-back on leave - monochrome, position-only, no color/glow. A no-op
// wrapper when the user has requested reduced motion.
function Magnetic({
  children,
  strength = 0.3,
  maxOffset = 8,
  className,
}: {
  children: React.ReactNode
  strength?: number
  maxOffset?: number
  className?: string
}) {
  // Branching the returned element type on reduceMotion would mismatch
  // between server render (matchMedia unavailable -> always "false") and
  // an actual reduced-motion client, so instead the JSX stays identical
  // and only the mousemove handler's effect is gated.
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 })
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - (rect.left + rect.width / 2)
    const relY = e.clientY - (rect.top + rect.height / 2)
    x.set(Math.max(-maxOffset, Math.min(maxOffset, relX * strength)))
    y.set(Math.max(-maxOffset, Math.min(maxOffset, relY * strength)))
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}

// Spring scale on hover/tap - wraps a CTA button without touching the
// shared Button component itself.
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

// Reveals `text` a few characters at a time via requestAnimationFrame,
// restarting whenever `playToken` changes (scroll-into-view or replay
// click both just increment the token). Reduced-motion users get the full
// text immediately instead of a forced multi-second reveal.
function useTypewriter(text: string, playToken: number) {
  const reduceMotion = useReducedMotion()
  const [typedLength, setTypedLength] = useState(0)

  useEffect(() => {
    if (playToken === 0) return

    if (reduceMotion) {
      setTypedLength(text.length)
      return
    }

    setTypedLength(0)
    let raf = 0
    let last = performance.now()
    let acc = 0
    let count = 0
    const CHARS_PER_SECOND = 220

    const tick = (now: number) => {
      acc += ((now - last) / 1000) * CHARS_PER_SECOND
      last = now
      const whole = Math.floor(acc)
      if (whole > 0) {
        acc -= whole
        count = Math.min(text.length, count + whole)
        setTypedLength(count)
      }
      if (count < text.length) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, playToken, reduceMotion])

  return { typed: text.slice(0, typedLength), done: typedLength >= text.length }
}

// The hero's live demo: types the LaTeX source out, then morphs in the
// actual rendered output a beat later - dramatizing "renders as you type"
// through the motion itself instead of a flat scroll-reveal. Replayable
// via the icon that appears on hover.
function DemoCard() {
  const [playToken, setPlayToken] = useState(0)
  const [showRender, setShowRender] = useState(false)
  const { typed, done } = useTypewriter(DEMO_SOURCE, playToken)

  useEffect(() => {
    if (!done) {
      setShowRender(false)
      return
    }
    const t = setTimeout(() => setShowRender(true), 250)
    return () => clearTimeout(t)
  }, [done])

  const replay = () => {
    setShowRender(false)
    setPlayToken((t) => t + 1)
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={cardReveal}
      onViewportEnter={() => setPlayToken((t) => t + 1)}
      className="group relative overflow-hidden rounded-[6px] border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-[#FAFAF9] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="ml-3 text-xs text-neutral-400">cauchy-schwarz.tex</span>
        <button
          type="button"
          onClick={replay}
          aria-label="Replay animation"
          className="ml-auto rounded-[4px] p-1 text-neutral-400 opacity-0 transition-opacity duration-200 hover:bg-neutral-200/60 hover:text-neutral-600 group-hover:opacity-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2">
        <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-neutral-500">
          {typed}
          {!done && (
            <motion.span
              className="ml-[1px] inline-block h-[1em] w-[2px] translate-y-[2px] bg-neutral-900"
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
            />
          )}
        </pre>

        <div className="min-h-[168px] border-t border-neutral-200 sm:border-t-0 sm:border-l">
          <AnimatePresence mode="wait">
            {showRender && (
              <motion.div
                key={playToken}
                initial={{ opacity: 0, scale: 0.94, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="p-6"
              >
                <LatexRenderer content={DEMO_SOURCE} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
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

            <nav className="hidden items-center gap-1 text-sm text-neutral-500 sm:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  className="relative z-0 rounded-[6px] px-3 py-1.5 hover:text-neutral-900"
                  onMouseEnter={() => setHoveredLink(link.key)}
                  onMouseLeave={() => setHoveredLink(null)}
                  onFocus={() => setHoveredLink(link.key)}
                  onBlur={() => setHoveredLink(null)}
                >
                  {hoveredLink === link.key && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-[6px]"
                      style={{ backgroundColor: ACCENT }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative">{link.label}</span>
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/signin" className="text-sm text-neutral-500 hover:text-neutral-900">
                Sign in
              </Link>
              <Magnetic maxOffset={6} strength={0.3}>
                <AnimatedButton>
                  <Link href="/signin">
                    <Button size="sm" className="rounded-[6px] bg-neutral-900 text-white hover:bg-neutral-900/90">
                      Get started
                    </Button>
                  </Link>
                </AnimatedButton>
              </Magnetic>
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
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center rounded-[6px] px-3 py-1 text-sm text-neutral-600"
            style={{ backgroundColor: ACCENT }}
          >
            Now in beta
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="mt-5 text-[2.75rem] leading-[1.1] font-semibold tracking-tight text-neutral-900 sm:text-6xl"
          >
            Write math like it&apos;s a document.
          </motion.h1>

          <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
            A collaborative LaTeX editor that renders as you type — built for
            proofs, papers, and problem sets.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-2">
            <Magnetic maxOffset={8} strength={0.35}>
              <AnimatedButton>
                <Link href="/signin">
                  <Button size="lg" className="rounded-[6px] bg-neutral-900 px-5 text-white hover:bg-neutral-900/90">
                    Get started
                  </Button>
                </Link>
              </AnimatedButton>
            </Magnetic>
            <Magnetic maxOffset={8} strength={0.35}>
              <AnimatedButton>
                <Button size="lg" variant="ghost" className="rounded-[6px] text-neutral-600 hover:text-neutral-900">
                  View demo
                </Button>
              </AnimatedButton>
            </Magnetic>
          </motion.div>
        </motion.section>

        {/* HERO VISUAL - an actual rendered document, not a placeholder */}
        <section className="mx-auto max-w-4xl px-6 pb-28">
          <DemoCard />
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
              className="mt-12 grid gap-6 sm:grid-cols-3"
            >
              {FEATURES.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp} className="h-full">
                  <Magnetic
                    maxOffset={5}
                    strength={0.2}
                    className="group block h-full rounded-[6px] border border-neutral-200 p-6 transition-colors duration-300 hover:bg-[#F1F1EF]"
                  >
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-neutral-200 bg-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <feature.icon className="h-4 w-4 text-neutral-900" />
                    </div>
                    <h3 className="mt-4 font-medium text-neutral-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                      {feature.description}
                    </p>
                  </Magnetic>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-neutral-200">
          <Reveal
            variants={staggerContainer}
            className="relative z-0 mx-auto max-w-3xl px-6 py-24 text-center"
          >
            <motion.div
              variants={{
                hidden: { scaleY: 0 },
                visible: {
                  scaleY: 1,
                  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              style={{ transformOrigin: "center", backgroundColor: ACCENT }}
              className="absolute inset-x-6 inset-y-6 -z-10 rounded-[6px] sm:inset-x-12"
            />

            <motion.h2 variants={fadeUp} className="text-2xl font-semibold text-neutral-900">
              Start writing mathematics like a document.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-neutral-500">
              No compile step. No friction. Just LaTeX that feels modern.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 inline-block">
              <Magnetic maxOffset={8} strength={0.35}>
                <AnimatedButton>
                  <Link href="/docs">
                    <Button size="lg" className="rounded-[6px] bg-neutral-900 px-6 text-white hover:bg-neutral-900/90">
                      Launch Mathboard
                    </Button>
                  </Link>
                </AnimatedButton>
              </Magnetic>
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
