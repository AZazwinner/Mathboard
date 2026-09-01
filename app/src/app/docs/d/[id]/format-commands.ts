import { EditorSelection } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

// Toggle-wraps every selection range in before/after markup, stripping it if already present.
export function toggleWrap(view: EditorView, before: string, after: string = before) {
    const { state } = view

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                const doc = state.doc

                const beforeText = doc.sliceString(Math.max(0, from - before.length), from)
                const afterText = doc.sliceString(to, Math.min(doc.length, to + after.length))

                if (beforeText === before && afterText === after) {
                    return {
                        changes: [
                            { from: from - before.length, to: from, insert: "" },
                            { from: to, to: to + after.length, insert: "" },
                        ],
                        range: EditorSelection.range(from - before.length, to - before.length),
                    }
                }

                return {
                    changes: [
                        { from, insert: before },
                        { from: to, insert: after },
                    ],
                    range: EditorSelection.range(from + before.length, to + before.length),
                }
            })
        )
    )
    view.focus()
}

// Toggles a line-prefix marker (e.g. "# " for a heading) on the line the
// selection starts on.
export function toggleLinePrefix(view: EditorView, prefix: string) {
    const { state } = view

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const line = state.doc.lineAt(range.from)
                const hasPrefix = line.text.startsWith(prefix)

                if (hasPrefix) {
                    const delta = -prefix.length
                    return {
                        changes: { from: line.from, to: line.from + prefix.length, insert: "" },
                        range: EditorSelection.range(range.from + delta, range.to + delta),
                    }
                }

                return {
                    changes: { from: line.from, insert: prefix },
                    range: EditorSelection.range(range.from + prefix.length, range.to + prefix.length),
                }
            })
        )
    )
    view.focus()
}

// Binds Tab to a fixed indent; returns true so CodeMirror doesn't fall through to native focus-shift behavior.
export function insertTab(view: EditorView): boolean {
    if (view.state.readOnly) return false

    const { state } = view
    const TAB = "    "

    view.dispatch(
        state.update(
            state.changeByRange((range) => ({
                changes: { from: range.from, to: range.to, insert: TAB },
                range: EditorSelection.cursor(range.from + TAB.length),
            }))
        )
    )
    return true
}

// Whether `pos` sits inside a ``` fenced region, via fence-marker parity before it.
export function isInsideCodeFence(doc: string, pos: number): boolean {
    const before = doc.slice(0, pos)
    const fenceCount = (before.match(/```/g) || []).length
    return fenceCount % 2 === 1
}

// Whether `pos` sits inside a `$$` display-math region, via `$$`-marker parity before it.
export function isInsideMathBlock(doc: string, pos: number): boolean {
    const before = doc.slice(0, pos)
    const delimCount = (before.match(/\$\$/g) || []).length
    return delimCount % 2 === 1
}

// Like isInsideMathBlock, but also distinguishes single-`$` inline math. Scanned in one pass since a `$` that's part of `$$` shouldn't also count as inline.
export function mathContextAt(doc: string, pos: number): "block" | "inline" | "text" {
    const before = doc.slice(0, pos)
    let inBlock = false
    let inInline = false
    for (let i = 0; i < before.length; i++) {
        if (before[i] !== "$") continue
        if (before[i + 1] === "$") {
            inBlock = !inBlock
            i++
        } else if (!inBlock) {
            inInline = !inInline
        }
    }
    if (inBlock) return "block"
    if (inInline) return "inline"
    return "text"
}

// Wraps the selection in a fenced code block. Unlike toggleWrap, doesn't detect/undo an existing fence.
export function toggleCodeBlock(view: EditorView) {
    const { state } = view
    const fence = "```"

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                const selected = state.doc.sliceString(from, to)
                const insert = `${fence}\n${selected}\n${fence}`

                return {
                    changes: { from, to, insert },
                    range: EditorSelection.range(from + fence.length + 1, from + fence.length + 1 + selected.length),
                }
            })
        )
    )
    view.focus()
}

// Read-only counterpart to toggleWrap, so the toolbar can show a button as "on".
export function isWrapped(view: EditorView, before: string, after: string = before): boolean {
    const { state } = view
    const { from, to } = state.selection.main
    const doc = state.doc

    const beforeText = doc.sliceString(Math.max(0, from - before.length), from)
    const afterText = doc.sliceString(to, Math.min(doc.length, to + after.length))
    return beforeText === before && afterText === after
}

// Read-only counterpart to toggleLinePrefix.
export function isLinePrefixed(view: EditorView, prefix: string): boolean {
    const line = view.state.doc.lineAt(view.state.selection.main.from)
    return line.text.startsWith(prefix)
}

// Wraps the selection in `$...$` for inline math.
export function insertInlineMath(view: EditorView) {
    toggleWrap(view, "$")
}

// Inserts a `$$ ... $$` block; with no selection, lands the cursor on the blank line in between.
export function insertBlockMath(view: EditorView) {
    const { state } = view

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                const selected = state.doc.sliceString(from, to)
                const insert = selected ? `$$\n${selected}\n$$` : "$$\n\n$$"
                const cursorPos = selected ? from + insert.length : from + 3

                return {
                    changes: { from, to, insert },
                    range: EditorSelection.cursor(cursorPos),
                }
            })
        )
    )
    view.focus()
}

// Inserts an inline $\frac{}{}$ snippet, cursor placed inside the numerator. Needs the $ delimiters, or remark-math won't hand it to KaTeX.
export function insertFraction(view: EditorView) {
    const { state } = view
    const snippet = "$\\frac{}{}$"
    const NUMERATOR_OFFSET = "$\\frac{".length

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                return {
                    changes: { from, to, insert: snippet },
                    range: EditorSelection.cursor(from + NUMERATOR_OFFSET),
                }
            })
        )
    )
    view.focus()
}

// Common brace-less LaTeX commands, used by looksLikeLatex as a signal even when the text has no "{"/"^"/"_" (e.g. "x \to \infty").
const LATEX_SYMBOL_COMMANDS = new Set([
    "infty", "pi", "alpha", "beta", "gamma", "delta", "epsilon", "theta",
    "lambda", "mu", "sigma", "phi", "omega", "times", "cdot", "pm", "mp",
    "leq", "geq", "neq", "approx", "equiv", "sum", "prod", "int", "oint",
    "sqrt", "frac", "lim", "sin", "cos", "tan", "log", "ln", "exp",
    "forall", "exists", "in", "notin", "subset", "subseteq", "cup", "cap",
    "emptyset", "partial", "nabla", "to", "rightarrow", "leftarrow",
    "Rightarrow", "Leftrightarrow", "cdots", "ldots", "dots", "text",
    "mathbb", "mathcal", "mathrm", "left", "right", "begin", "end",
])

// Whether pasted plain text looks like bare LaTeX source rather than prose or a Windows path (which also contains backslashes). Requires a LaTeX command plus a further signal (braces, sub/superscript, or a known symbol name).
export function looksLikeLatex(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed || trimmed.includes("$")) return false
    if (/^[a-zA-Z]:\\/.test(trimmed) || trimmed.startsWith("\\\\")) return false

    // Already self-delimited with \[...\]/\(...\) - LatexRenderer normalizes those on its own, so wrapping in $$ here would nest delimiters KaTeX can't parse.
    if (/^\\\[[\s\S]*\\\]$/.test(trimmed) || /^\\\([\s\S]*\\\)$/.test(trimmed)) return false

    const commands = trimmed.match(/\\([a-zA-Z]+)/g)
    if (!commands || commands.length === 0) return false

    // An escaped brace ("\{") is a literal character, not LaTeX grouping, so only unescaped {}/^/_ counts as structure.
    const hasStructure = /(?<!\\)[{}^_]/.test(trimmed)
    const hasKnownSymbol = commands.some((cmd) => LATEX_SYMBOL_COMMANDS.has(cmd.slice(1)))
    return hasStructure || hasKnownSymbol
}

// Images have no server-side storage, so they're embedded as base64 data: URIs directly in the block text; capped since base64 inflates size ~33%.
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

// Raster MIME types only - excludes svg+xml (can carry scripts) and other data: URIs (XSS risk). Shared between imageWidget.ts and LatexRenderer's urlTransform.
export const SAFE_IMAGE_DATA_URI = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i

// Full markdown image syntax, source captured in group 2 - either a safe data: URI or a plain http(s) link.
export const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\((data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s)]+)\)/g

export function readImageAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"))
        reader.readAsDataURL(file)
    })
}

// Inserts `![alt](dataUri)` at the cursor, replacing the selection if any.
export function insertImageMarkdown(view: EditorView, dataUri: string, alt: string = "") {
    const { state } = view
    const snippet = `![${alt}](${dataUri})`

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                return {
                    changes: { from, to, insert: snippet },
                    range: EditorSelection.cursor(from + snippet.length),
                }
            })
        )
    )
    // imageWidget.ts renders this as an actual <img> inline even while focused, rather than raw base64 text.
    view.focus()
}

// Inserts a 3-column/2-row GFM markdown table template, cursor landing on the first header cell.
export function insertTable(view: EditorView) {
    const { state } = view
    const snippet = "| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |"
    const FIRST_CELL_OFFSET = "| ".length

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                return {
                    changes: { from, to, insert: snippet },
                    range: EditorSelection.range(from + FIRST_CELL_OFFSET, from + FIRST_CELL_OFFSET + "Header 1".length),
                }
            })
        )
    )
    view.focus()
}

// Inserts a 2x2 \begin{pmatrix} template as block math ($$...$$).
export function insertMatrix(view: EditorView) {
    const { state } = view
    const snippet = "$$\n\\begin{pmatrix}\n  a & b \\\\\n  c & d\n\\end{pmatrix}\n$$"

    view.dispatch(
        state.update(
            state.changeByRange((range) => {
                const { from, to } = range
                return {
                    changes: { from, to, insert: snippet },
                    range: EditorSelection.cursor(from + snippet.length),
                }
            })
        )
    )
    view.focus()
}
