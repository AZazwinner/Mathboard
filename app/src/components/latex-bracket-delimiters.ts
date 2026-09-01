// Converts LaTeX's \(...\)/\[...\] delimiters into $.../$$...$$ for remark-math.
// Must run on the raw string before parsing - CommonMark's backslash-escape rule strips the backslash during parsing, so a remark plugin would never see it.
// Skips fenced code blocks and inline code spans so backslash-bracket sequences in actual code aren't touched.
const FENCE = /(```[\s\S]*?```)/g
const INLINE_CODE = /(`[^`\n]*`)/g

function convertSegment(segment: string): string {
    return segment
        .replace(
            /\\\[([\s\S]+?)\\\]/g,
            // $$ only parses as display math on its own line; inline $$x$$ would parse as inline math instead.
            (_match, inner: string) => `\n\n$$\n${inner.trim()}\n$$\n\n`
        )
        .replace(/\\\((.+?)\\\)/g, (_match, inner: string) => `$${inner}$`)
}

export function convertLatexBracketDelimiters(source: string): string {
    return source
        .split(FENCE)
        .map((part, i) => {
            // Odd indices are the fenced blocks captured by split(), kept verbatim.
            if (i % 2 === 1) return part
            return part
                .split(INLINE_CODE)
                .map((sub, j) => (j % 2 === 1 ? sub : convertSegment(sub)))
                .join("")
        })
        .join("")
}
