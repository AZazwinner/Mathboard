// Converts LaTeX's own \(...\) (inline) and \[...\] (display) math
// delimiters into the $...$/$$...$$ forms remark-math understands.
//
// This has to run on the raw markdown STRING, before any parsing happens -
// it can't be done as a post-parse mdast-tree transform (a remark plugin),
// because CommonMark's own backslash-escape rule (part of the core spec:
// a backslash before ASCII punctuation like `(`/`[` escapes it to a literal
// character) consumes the leading backslash during the initial parse. By
// the time any remark plugin's tree-transform runs, a text node that
// contained "\(x\)" has already been reduced to plain "(x)" - the
// backslashes are simply gone, with no trace left for a later AST-walking
// plugin to match against. Rewriting the string first sidesteps that
// entirely: by the time remark-math's tokenizer sees the string, it's
// already valid native $...$ syntax.
//
// Skips over fenced code blocks and inline code spans so backslash-bracket
// sequences in actual code (e.g. `\(group\)` in a regex) aren't touched.
const FENCE = /(```[\s\S]*?```)/g
const INLINE_CODE = /(`[^`\n]*`)/g

function convertSegment(segment: string): string {
    return segment
        .replace(
            /\\\[([\s\S]+?)\\\]/g,
            // remark-math only treats $$ as *display* math when the fence
            // is alone on its own line with content on the following
            // line(s) - the same convention as fenced code blocks. $$x$$
            // all on one line parses as inline math instead, so the
            // replacement has to introduce real newlines around the fence.
            (_match, inner: string) => `\n\n$$\n${inner.trim()}\n$$\n\n`
        )
        .replace(/\\\((.+?)\\\)/g, (_match, inner: string) => `$${inner}$`)
}

export function convertLatexBracketDelimiters(source: string): string {
    return source
        .split(FENCE)
        .map((part, i) => {
            // split() with a capturing group interleaves the delimiter matches
            // back into the result at odd indices - those are the fenced
            // blocks themselves, kept verbatim
            if (i % 2 === 1) return part
            return part
                .split(INLINE_CODE)
                .map((sub, j) => (j % 2 === 1 ? sub : convertSegment(sub)))
                .join("")
        })
        .join("")
}
