"use client"

import { useRef } from "react"
import type { EditorView } from "@codemirror/view"
import { Bold, Code, Divide, FunctionSquare, Grid3x3, Heading, Image as ImageIcon, Italic, Sigma, SquareCode, Strikethrough, Table } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    insertBlockMath,
    insertFraction,
    insertImageMarkdown,
    insertInlineMath,
    insertMatrix,
    insertTable,
    isLinePrefixed,
    isWrapped,
    MAX_IMAGE_BYTES,
    readImageAsDataUri,
    toggleCodeBlock,
    toggleLinePrefix,
    toggleWrap,
} from "./format-commands"

type ToolbarAction = {
    label: string
    icon: React.ComponentType<{ className?: string }>
    run: (view: EditorView) => void
    isActive?: (view: EditorView) => boolean
}

const TEXT_ACTIONS: ToolbarAction[] = [
    { label: "Bold", icon: Bold, run: (view) => toggleWrap(view, "**"), isActive: (view) => isWrapped(view, "**") },
    { label: "Italic", icon: Italic, run: (view) => toggleWrap(view, "_"), isActive: (view) => isWrapped(view, "_") },
    { label: "Strikethrough", icon: Strikethrough, run: (view) => toggleWrap(view, "~~"), isActive: (view) => isWrapped(view, "~~") },
    { label: "Heading", icon: Heading, run: (view) => toggleLinePrefix(view, "# "), isActive: (view) => isLinePrefixed(view, "# ") },
    { label: "Inline code", icon: Code, run: (view) => toggleWrap(view, "`"), isActive: (view) => isWrapped(view, "`") },
    { label: "Code block", icon: SquareCode, run: (view) => toggleCodeBlock(view) },
    { label: "Table", icon: Table, run: (view) => insertTable(view) },
]

const MATH_ACTIONS: ToolbarAction[] = [
    { label: "Inline math", icon: Sigma, run: (view) => insertInlineMath(view), isActive: (view) => isWrapped(view, "$") },
    { label: "Block equation", icon: FunctionSquare, run: (view) => insertBlockMath(view) },
    { label: "Fraction", icon: Divide, run: (view) => insertFraction(view) },
    { label: "Matrix", icon: Grid3x3, run: (view) => insertMatrix(view) },
]

function ToolbarButton({
    action,
    activeView,
    disabled,
}: {
    action: ToolbarAction
    activeView: EditorView | null
    disabled: boolean
}) {

    "use no memo"

    const isDisabled = disabled || !activeView
    const isActive = !isDisabled && activeView ? Boolean(action.isActive?.(activeView)) : false
    const { label, icon: Icon, run } = action

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            disabled={isDisabled}

            onMouseDown={(e) => e.preventDefault()}
            onClick={() => activeView && run(activeView)}
            className={cn(isActive && "bg-accent text-accent-foreground")}
        >
            <Icon className="w-4 h-4" />
        </Button>
    )
}


function ImageButton({
    activeView,
    disabled,
}: {
    activeView: EditorView | null
    disabled: boolean
}) {
    "use no memo"

    const inputRef = useRef<HTMLInputElement>(null)
    const isDisabled = disabled || !activeView

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file || !activeView) return

        if (file.size > MAX_IMAGE_BYTES) {
            window.alert(`Image is too large to embed (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB).`)
            return
        }

        const dataUri = await readImageAsDataUri(file)
        insertImageMarkdown(activeView, dataUri)
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Image"
                aria-label="Image"
                disabled={isDisabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
            >
                <ImageIcon className="w-4 h-4" />
            </Button>
        </>
    )
}

export function FormattingToolbar({
    activeView,
    disabled,
}: {
    activeView: EditorView | null
    disabled: boolean
}) {

    "use no memo"

    return (
        <div className="flex items-center gap-1 border-b px-4 py-2 bg-muted/20">
            {TEXT_ACTIONS.map((action) => (
                <ToolbarButton key={action.label} action={action} activeView={activeView} disabled={disabled} />
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            {MATH_ACTIONS.map((action) => (
                <ToolbarButton key={action.label} action={action} activeView={activeView} disabled={disabled} />
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            <ImageButton activeView={activeView} disabled={disabled} />
        </div>
    )
}
