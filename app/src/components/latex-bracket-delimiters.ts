


const FENCE = /(```[\s\S]*?```)/g
const INLINE_CODE = /(`[^`\n]*`)/g

function convertSegment(segment: string): string {
    return segment
        .replace(
            /\\\[([\s\S]+?)\\\]/g,

            (_match, inner: string) => `\n\n$$\n${inner.trim()}\n$$\n\n`
        )
        .replace(/\\\((.+?)\\\)/g, (_match, inner: string) => `$${inner}$`)
}

export function convertLatexBracketDelimiters(source: string): string {
    return source
        .split(FENCE)
        .map((part, i) => {

            if (i % 2 === 1) return part
            return part
                .split(INLINE_CODE)
                .map((sub, j) => (j % 2 === 1 ? sub : convertSegment(sub)))
                .join("")
        })
        .join("")
}
