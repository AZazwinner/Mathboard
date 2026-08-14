import { EditorSelection } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

// Toggle-wraps every selection range in `before`/`after` markup (e.g. "**"
// for bold). If a range is already immediately surrounded by that markup,
// it's stripped instead - so re-clicking the same button undoes it.
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

// Inserts 4 spaces at each cursor (replacing the selection, if any), used
// to bind Tab to a fixed indent instead of the browser's default of moving
// focus off the editor. Returns a boolean (rather than being void, like the
// toolbar commands above) because it's wired in as a CodeMirror keymap
// `run` handler: returning true tells CodeMirror the key was handled, so it
// doesn't fall through to native Tab/focus-shift behavior.
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

// Whether `pos` sits inside a ``` fenced region of `doc` - counts fence
// markers before `pos` and checks parity, the same open/close convention
// toggleCodeBlock above writes (an odd count means the nearest preceding
// fence was an opener with no closer yet).
export function isInsideCodeFence(doc: string, pos: number): boolean {
    const before = doc.slice(0, pos)
    const fenceCount = (before.match(/```/g) || []).length
    return fenceCount % 2 === 1
}

// Wraps the selection in a fenced code block. Unlike toggleWrap, this
// doesn't attempt to detect/undo an existing fence - re-clicking nests
// another fence rather than stripping the old one.
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
