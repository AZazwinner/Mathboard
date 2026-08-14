import { useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import type { Awareness } from "y-protocols/awareness.js"
import { EditorView, keymap } from "@codemirror/view"
import { EditorState, Prec } from "@codemirror/state"
import { defaultKeymap } from "@codemirror/commands"
import { yCollab } from "y-codemirror.next"
import LatexRenderer from "@/components/LatexRenderer"
import { insertTab, isInsideCodeFence } from "./format-commands"
import type { FocusRequest } from "./TextEditor"

export function BlockEditor({
    id,
    type,
    text,
    position,
    awareness,
    permission,
    insertBlock,
    deleteBlock,
    focusRequest,
    clearFocusRequest,
    requestFocus,
    containerRef,
    emptyDoc,
    onFocusView,
}: {
    id: string
    type: string
    text: Y.Text
    position: number
    awareness: Awareness
    permission: "owner" | "read" | "write"
    insertBlock: (position: number, id: string, type: string, content?: string) => void
    deleteBlock: (position: number) => void
    focusRequest: FocusRequest | null
    clearFocusRequest: () => void
    requestFocus: (index: number, atEnd?: boolean) => void
    containerRef: React.RefObject<HTMLDivElement | null>
    emptyDoc: boolean
    onFocusView?: (view: EditorView) => void
}) {
    const [isFocused, setIsFocused] = useState(false)
    const [previewText, setPreviewText] = useState(text.toString())
    const editorContainerRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)

    // Enter/Backspace need the *current* position + latest callbacks, but the
    // CodeMirror view itself is only constructed once per block (recreating
    // it on every sibling insert/delete would blow away cursor/undo state) -
    // so commands read through this ref instead of closing over stale props.
    const latest = useRef({ position, insertBlock, deleteBlock, requestFocus, onFocusView })
    latest.current = { position, insertBlock, deleteBlock, requestFocus, onFocusView }

    useEffect(() => {
        const unobserve = () => text.unobserve(onTextChange)
        const onTextChange = () => setPreviewText(text.toString())
        text.observe(onTextChange)
        return unobserve
    }, [text])

    // Constructs the CodeMirror view once per block. Declared *before* the
    // focus-request effect below so it always runs first within a commit -
    // by the time the focus effect reads viewRef.current, it's populated
    // (including across React Strict Mode's dev-only mount/cleanup/remount).
    useEffect(() => {
        if (!editorContainerRef.current) return

        const splitBlock = (view: EditorView): boolean => {
            if (view.state.readOnly) return false

            // inside a fenced code block, Enter should add a line to the
            // code rather than split into a new document block
            const { state } = view
            const pos = state.selection.main.head
            if (isInsideCodeFence(state.doc.toString(), pos)) {
                view.dispatch(state.replaceSelection("\n"))
                return true
            }

            // move everything after the cursor into the new block instead of
            // leaving it behind - previously the new block was always empty
            // and any text after the cursor stayed stuck in the old one
            const after = state.doc.toString().slice(pos)
            if (after.length > 0) {
                text.delete(pos, after.length)
            }

            const { position, insertBlock, requestFocus } = latest.current
            insertBlock(position + 1, crypto.randomUUID(), "paragraph", after)
            requestFocus(position + 1)
            return true
        }

        const mergeIntoPrevious = (view: EditorView): boolean => {
            if (view.state.readOnly) return false
            const { position, deleteBlock, requestFocus } = latest.current
            if (position === 0 || view.state.doc.length > 0) return false
            deleteBlock(position)
            requestFocus(position - 1, true)
            return true
        }

        const blockKeymap = Prec.highest(
            keymap.of([
                { key: "Enter", run: splitBlock },
                { key: "Shift-Enter", run: () => false },
                { key: "Backspace", run: mergeIntoPrevious },
                { key: "Tab", run: insertTab },
            ])
        )

        const ensureVisible = () => {
            const el = editorContainerRef.current
            const container = containerRef.current
            if (!el || !container) return

            const buffer = 120
            const elBottom = el.offsetTop + el.scrollHeight
            const containerBottom = container.scrollTop + container.clientHeight
            const distanceFromBottom = containerBottom - elBottom
            if (distanceFromBottom < buffer) {
                container.scrollTop += buffer - distanceFromBottom
            }
        }

        const state = EditorState.create({
            doc: text.toString(),
            extensions: [
                blockKeymap,
                keymap.of(defaultKeymap),
                EditorView.lineWrapping,
                EditorState.readOnly.of(permission === "read"),
                yCollab(text, awareness),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) ensureVisible()
                }),
                EditorView.theme({
                    "&": { fontSize: "1rem", fontFamily: "var(--font-serif, serif)" },
                    ".cm-content": { padding: "0.5rem 2.5rem" },
                    ".cm-line": { padding: 0, lineHeight: "1.625" },
                    "&.cm-focused": { outline: "none" },
                }),
            ],
        })

        const view = new EditorView({ state, parent: editorContainerRef.current })
        viewRef.current = view

        view.contentDOM.addEventListener("focus", () => {
            setIsFocused(true)
            latest.current.onFocusView?.(view)
        })
        view.contentDOM.addEventListener("blur", () => setIsFocused(false))

        return () => {
            view.destroy()
            viewRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text])

    // Handles both "focus a block just created by Enter" and "focus an
    // existing block after Backspace merges into it" uniformly, always
    // reading this block's own (always-current) viewRef - no cross-component
    // ref-array indexing that could point at a since-destroyed instance.
    useEffect(() => {
        if (!focusRequest || focusRequest.index !== position) return
        const view = viewRef.current
        if (!view) return

        view.focus()
        const pos = focusRequest.atEnd ? view.state.doc.length : 0
        view.dispatch({ selection: { anchor: pos, head: pos } })
        clearFocusRequest()
    }, [focusRequest, position, clearFocusRequest])

    useEffect(() => {
        if (emptyDoc && position === 0 && viewRef.current) {
            viewRef.current.focus()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="w-full flex justify-center">
            <div key={id} className="w-full max-w-4xl grid">
                <div
                    onClick={() => viewRef.current?.focus()}
                    className={`
                        col-start-1 row-start-1
                        text-base font-serif leading-relaxed whitespace-pre-wrap break-words
                        ${isFocused ? "hidden" : "block"}
                        z-0
                        px-10 py-2
                        rounded-md
                        cursor-text
                        transition-colors duration-150
                        hover:bg-muted/60
                    `}
                >
                    <LatexRenderer content={previewText} />
                </div>
                <div
                    ref={editorContainerRef}
                    className={`
                        col-start-1 row-start-1
                        w-full
                        z-10
                        ${isFocused ? "bg-gray-100" : "bg-transparent"}
                        ${isFocused ? "opacity-100" : "opacity-0 pointer-events-none max-h-0 overflow-hidden"}
                    `}
                />
            </div>
        </div>
    )
}
