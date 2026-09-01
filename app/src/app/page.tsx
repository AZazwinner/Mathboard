"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import { Button } from "@/components/ui/button"
import { Sigma, RotateCcw, Link2, Check, Menu, X } from "lucide-react"
import Link from "next/link"
import LatexRenderer from "@/components/LatexRenderer"

const DEMO_LINE_A = String.raw`## Cauchy–Schwarz

For vectors $u, v \in \mathbb{R}^n$:

`

const DEMO_LINE_B = String.raw`$$\left(\sum_i u_i v_i\right)^2 \;\leq\; \left(\sum_i u_i^2\right)\left(\sum_i v_i^2\right)$$

with equality iff $u$ and $v$ are linearly dependent.`

const DEMO_SOURCE = DEMO_LINE_A + DEMO_LINE_B

const AUTHOR_A = { name: "Ada", color: "#5B6EBA" }
const AUTHOR_B = { name: "Gauss", color: "#BA7A4F" }

const HEADLINE_WORDS = ["document", "proof", "paper", "problem set"]

const FEATURES = [
  {
    title: "Renders as you type",
    description: "Every block compiles the moment you finish typing it, right in the document.",
    Visual: RenderToggleIcon,
  },
  {
    title: "Real-time collaboration",
    description: "Edit the same proof together and see collaborators' cursors as they write.",
    Visual: CollabCursorsIcon,
  },
  {
    title: "Share with a link",
    description: "Send a link and the other person can read or edit the document right away.",
    Visual: ShareLinkIcon,
  },
]

const NAV_LINKS = [
  { key: "features", label: "Features", href: "#features" },
  { key: "docs", label: "Docs", href: "/docs" },
]

const ACCENT = "#F1F1EF"

// Stable references: framer-motion's viewport tracking is keyed off object identity, so an inline literal would reset "once" tracking on every re-render.
const VIEWPORT_ONCE = { once: true, margin: "-80px" } as const
const VIEWPORT_ONCE_TIGHT = { once: true, margin: "-40px" } as const

// Faint graph-paper texture behind the page.
const GRID_BACKGROUND: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
}

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
      viewport={VIEWPORT_ONCE}
      variants={variants}
    >
      {children}
    </motion.div>
  )
}

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

function WordRotator({ words, interval = 3000 }: { words: string[]; interval?: number }) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [striking, setStriking] = useState(false)

  useEffect(() => {
    if (reduceMotion) return
    const t = setTimeout(() => setStriking(true), interval)
    return () => clearTimeout(t)
  }, [index, interval, reduceMotion])

  useEffect(() => {
    if (!striking) return
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % words.length)
      setStriking(false)
    }, 380)
    return () => clearTimeout(t)
  }, [striking, words.length])

  if (reduceMotion) {
    return (
      <span className="underline decoration-dotted decoration-neutral-300 underline-offset-4">
        {words[0]}
      </span>
    )
  }

  return (
    <span className="relative inline-block">
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative inline-block underline decoration-dotted decoration-neutral-300 underline-offset-4"
      >
        {words[index]}
        {striking && (
          <motion.span
            className="absolute left-0 top-[0.72em] h-[2px] bg-red-400/70"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          />
        )}
      </motion.span>
    </span>
  )
}

function PresenceDot() {
  const reduceMotion = useReducedMotion()
  return (
    <span className="relative mr-1.5 inline-flex h-1.5 w-1.5 shrink-0">
      {!reduceMotion && (
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-neutral-500"
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.8, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neutral-500" />
    </span>
  )
}

function DrawUnderline({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <motion.svg
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-1 left-0 h-2 w-full text-neutral-300"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE_TIGHT}
      >
        <motion.path
          d="M1,4 Q50,7 99,3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            visible: {
              pathLength: 1,
              opacity: 1,
              transition: { duration: 0.6, ease: "easeInOut", delay: 0.3 },
            },
          }}
        />
      </motion.svg>
    </span>
  )
}

function RenderToggleIcon() {
  const reduceMotion = useReducedMotion()
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => setRendered((r) => !r), 2000)
    return () => clearInterval(id)
  }, [reduceMotion])

  return (
    <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-neutral-200 bg-white">
      <AnimatePresence mode="wait">
        {rendered ? (
          <motion.span
            key="rendered"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.25 }}
            className="font-serif text-[15px] italic text-neutral-900"
          >
            ∑x²
          </motion.span>
        ) : (
          <motion.span
            key="source"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.25 }}
            className="font-mono text-[9px] text-neutral-500"
          >
            \sum x^2
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function CollabCursorsIcon() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-[6px] border border-neutral-200 bg-white">
      {!reduceMotion ? (
        <>
          <motion.span
            className="absolute top-2 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: AUTHOR_A.color }}
            animate={{ x: [4, 20, 4] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute bottom-2 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: AUTHOR_B.color }}
            animate={{ x: [20, 4, 20] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : (
        <>
          <span
            className="absolute top-2 left-2 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: AUTHOR_A.color }}
          />
          <span
            className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: AUTHOR_B.color }}
          />
        </>
      )}
    </div>
  )
}

function ShareLinkIcon() {
  const reduceMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => setCopied((c) => !c), 2400)
    return () => clearInterval(id)
  }, [reduceMotion])

  return (
    <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-neutral-200 bg-white">
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <Check className="h-4 w-4 text-neutral-900" />
          </motion.span>
        ) : (
          <motion.span
            key="link"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <Link2 className="h-4 w-4 text-neutral-900" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function AuthorLane({
  author,
  full,
  typed,
  done,
}: {
  author: { name: string; color: string }
  full: string
  typed: string
  done: boolean
}) {
  return (
    <div className="p-5">
      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: author.color }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
        {author.name}
      </div>
      {/* Untyped remainder stays `invisible` (not absent) so the pane's height is fixed to the final text from the first frame. */}
      <pre className="scrollbar-custom overflow-x-auto font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-neutral-500">
        {typed}
        {!done && (
          <motion.span
            className="ml-[1px] inline-block h-[1em] w-[2px] translate-y-[2px]"
            style={{ backgroundColor: author.color }}
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
          />
        )}
        <span className="invisible">{full.slice(typed.length)}</span>
      </pre>
    </div>
  )
}

// Reveals `text` a few characters at a time, restarting whenever `playToken` changes.
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
    const CHARS_PER_SECOND = 150

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

type DemoHandle = { replay: () => void }

// Exposes `replay` via ref so the hero's "View demo" button can trigger it from outside the component tree.
const CollabDemoCard = forwardRef<DemoHandle>(function CollabDemoCard(_props, ref) {
  const [playToken, setPlayToken] = useState(0)
  const [showRender, setShowRender] = useState(false)
  const a = useTypewriter(DEMO_LINE_A, playToken)
  const b = useTypewriter(DEMO_LINE_B, playToken)
  const bothDone = a.done && b.done

  useEffect(() => {
    if (!bothDone) {
      setShowRender(false)
      return
    }
    const t = setTimeout(() => setShowRender(true), 300)
    return () => clearTimeout(t)
  }, [bothDone])

  const replay = () => {
    setShowRender(false)
    setPlayToken((t) => t + 1)
  }

  useImperativeHandle(ref, () => ({ replay }))

  // Uses a ref instead of `viewport.once` since this component re-renders on every typed character.
  const hasAutoPlayed = useRef(false)

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={cardReveal}
      onViewportEnter={() => {
        if (hasAutoPlayed.current) return
        hasAutoPlayed.current = true
        setPlayToken((t) => t + 1)
      }}
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

      <div className="grid divide-y divide-neutral-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <AuthorLane author={AUTHOR_A} full={DEMO_LINE_A} typed={a.typed} done={a.done} />
        <AuthorLane author={AUTHOR_B} full={DEMO_LINE_B} typed={b.typed} done={b.done} />
      </div>

      <div className="min-h-[168px] border-t border-neutral-200">
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
    </motion.div>
  )
})

export default function HomePage() {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const demoRef = useRef<DemoHandle>(null)
  const demoSectionRef = useRef<HTMLDivElement>(null)

  const handleViewDemo = () => {
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    demoRef.current?.replay()
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-neutral-900" style={GRID_BACKGROUND}>
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
              <Link href="/signin?mode=signin" className="text-sm text-neutral-500 hover:text-neutral-900">
                Sign in
              </Link>
              <AnimatedButton>
                <Link href="/signin">
                  <Button size="sm" className="rounded-[6px] bg-neutral-900 text-white hover:bg-neutral-900/90">
                    Get started
                  </Button>
                </Link>
              </AnimatedButton>
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileNavOpen}
                className="rounded-[6px] p-1.5 text-neutral-500 hover:bg-[#FAFAF9] hover:text-neutral-900 sm:hidden"
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {mobileNavOpen && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden border-t border-neutral-200 sm:hidden"
              >
                <div className="flex flex-col px-6 py-2">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.key}
                      href={link.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-[6px] px-2 py-2.5 text-sm text-neutral-600 hover:bg-[#FAFAF9] hover:text-neutral-900"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        {/* HERO */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mx-auto max-w-4xl px-6 pt-24 pb-14 text-center"
        >
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center rounded-[6px] px-3 py-1 text-sm text-neutral-600"
            style={{ backgroundColor: ACCENT }}
          >
            <PresenceDot />
            Now in beta
          </motion.p>

          {/* min-height reserves two lines below ~1024px, where the longest word wraps. */}
          <div className="mt-5 flex min-h-[7.15rem] items-center justify-center sm:min-h-[9.9rem] lg:min-h-[4.95rem]">
            <motion.h1
              variants={fadeUp}
              className="font-heading text-[3.25rem] leading-[1.1] font-normal tracking-tight text-neutral-900 sm:text-7xl"
            >
              Write math like it&apos;s a <WordRotator words={HEADLINE_WORDS} />.
            </motion.h1>
          </div>

          <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
            Write LaTeX with someone else and watch it render as you type. Built
            for proofs, papers, and problem sets.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-2">
            <AnimatedButton>
              <Link href="/signin">
                <Button size="lg" className="rounded-[6px] bg-neutral-900 px-5 text-white hover:bg-neutral-900/90">
                  Get started
                </Button>
              </Link>
            </AnimatedButton>
            <AnimatedButton>
              <Button
                size="lg"
                variant="ghost"
                onClick={handleViewDemo}
                className="rounded-[6px] text-neutral-600 hover:text-neutral-900"
              >
                View demo
              </Button>
            </AnimatedButton>
          </motion.div>
        </motion.section>

        {/* HERO VISUAL */}
        <section ref={demoSectionRef} id="demo" className="mx-auto max-w-4xl px-6 pb-28">
          <CollabDemoCard ref={demoRef} />
        </section>

        {/* FEATURES */}
        <section id="features" className="border-t border-neutral-200">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <Reveal>
              <h2 className="font-heading text-3xl font-normal text-neutral-900">
                Focus on the math. Mathboard handles the rendering.
              </h2>
            </Reveal>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT_ONCE}
              variants={staggerContainer}
              className="mt-12 grid gap-6 sm:grid-cols-3"
            >
              {FEATURES.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp} className="h-full">
                  <div className="h-full rounded-[6px] border border-neutral-200 p-6 transition-colors duration-300 hover:border-neutral-300 hover:bg-[#FAFAF9]">
                    <feature.Visual />
                    <h3 className="mt-4 font-medium text-neutral-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                      {feature.description}
                    </p>
                  </div>
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

            <motion.h2 variants={fadeUp} className="font-heading text-3xl font-normal text-neutral-900">
              Start writing <DrawUnderline>mathematics</DrawUnderline> like a document.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-neutral-500">
              Type LaTeX and watch it render instantly, without a separate compile step.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 inline-block">
              <AnimatedButton>
                <Link href="/docs">
                  <Button size="lg" className="rounded-[6px] bg-neutral-900 px-6 text-white hover:bg-neutral-900/90">
                    Launch Mathboard
                  </Button>
                </Link>
              </AnimatedButton>
            </motion.div>
          </Reveal>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-neutral-200">
          <div className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-neutral-400">
            © {new Date().getFullYear()} mathboard
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
