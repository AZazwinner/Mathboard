import LatexRenderer from "@/components/LatexRenderer"
import { Logo } from "@/components/Logo"
import Link from "next/link"

const SHOWCASE = String.raw`## Cauchy–Schwarz

$$\left(\sum_i u_i v_i\right)^2 \;\leq\; \left(\sum_i u_i^2\right)\left(\sum_i v_i^2\right)$$

with equality iff $u$ and $v$ are linearly dependent.`


export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r p-10 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 text-foreground/5 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px]"
        />

        <Link href="/" className="relative flex items-center gap-2 text-sm font-medium">
          <Logo className="h-4 w-4" />
          mathboard
        </Link>

        <div className="relative rounded-lg border bg-card p-6 shadow-sm">
          <LatexRenderer content={SHOWCASE} />
        </div>

        <p className="font-heading relative max-w-sm text-xl text-muted-foreground">
          Pick up where your last proof left off.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  )
}
