"use client"

import { MATH_SYMBOLS, type MathSymbol } from "./math-symbols"

// Capped to avoid a wall of results for short queries; MATH_SYMBOLS is ordered by frequency of use.
const MAX_RESULTS = 8

export function filterMathSymbols(query: string): MathSymbol[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const matches = MATH_SYMBOLS.filter(
        (s) =>
            s.trigger.toLowerCase().startsWith(q) ||
            (s.aliases ?? []).some((a) => a.toLowerCase().startsWith(q))
    )
    return matches.slice(0, MAX_RESULTS)
}

export function MathSymbolMenu({
    left,
    top,
    items,
    activeIndex,
    onHover,
    onSelect,
}: {
    left: number
    top: number
    items: MathSymbol[]
    activeIndex: number
    onHover: (index: number) => void
    onSelect: (symbol: MathSymbol) => void
}) {
    return (
        <div
            style={{ left, top }}
            className="fixed z-50 mt-1 w-56 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
            // preserve the CodeMirror selection on click
            onMouseDown={(e) => e.preventDefault()}
        >
            {items.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matching symbols</div>
            ) : (
                items.map((item, i) => (
                    <button
                        key={item.trigger}
                        type="button"
                        onMouseEnter={() => onHover(i)}
                        onClick={() => onSelect(item)}
                        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${
                            i === activeIndex ? "bg-accent text-accent-foreground" : ""
                        }`}
                    >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted font-serif text-[15px] leading-none">
                            {item.glyph}
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="font-medium leading-tight">{item.trigger}</span>
                            <span className="truncate text-xs leading-tight text-muted-foreground">
                                {item.latex}
                            </span>
                        </span>
                    </button>
                ))
            )}
        </div>
    )
}
